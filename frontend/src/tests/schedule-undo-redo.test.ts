import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock Convex db + auth ctx builder ──────────────────────────────────────

type MockRecord = Record<string, unknown> & { _id: string }

function buildMockDb(initialRecords: Map<string, MockRecord> = new Map()) {
  const records = new Map(initialRecords)
  let idCounter = 0

  const queryChain = (table: string) => {
    const tableRecords = [...records.values()].filter((r) => r._table === table)
    return {
      withIndex: (_indexName: string, filterFn?: (q: any) => any) => {
        let filtered = [...tableRecords]
        if (filterFn) {
          const constraints: Record<string, unknown> = {}
          const q = new Proxy(
            {},
            {
              get: (_target, _prop) => {
                return (field: string, value?: unknown) => {
                  if (_prop === 'eq') constraints[field] = value
                  return q
                }
              },
            },
          )
          filterFn(q)
          filtered = filtered.filter((item: any) => {
            for (const [key, val] of Object.entries(constraints)) {
              if (item[key] !== val) return false
            }
            return true
          })
        }
        return {
          collect: async () => filtered,
          first: async () => filtered[0] ?? null,
        }
      },
      collect: async () => tableRecords,
      first: async () => tableRecords[0] ?? null,
    }
  }

  return {
    query: (table: string) => queryChain(table),
    get: async (id: string) => records.get(id) ?? null,
    insert: async (table: string, data: Record<string, unknown>) => {
      const newId = `${table}-${++idCounter}`
      const record: MockRecord = { ...data, _id: newId, _table: table, _creationTime: Date.now() }
      records.set(newId, record)
      return newId
    },
    patch: async (id: string, data: Record<string, unknown>) => {
      const existing = records.get(id)
      if (existing) {
        records.set(id, { ...existing, ...data })
      }
    },
    delete: async (id: string) => {
      records.delete(id)
    },
    _records: records,
  }
}

function buildMockCtx(options: {
  identity: { subject: string; email?: string } | null
  db: ReturnType<typeof buildMockDb>
}) {
  return {
    auth: {
      getUserIdentity: async () => options.identity,
    },
    db: options.db,
  }
}

// ── Helpers: snapshot save + restore workflow ────────────────────────────────

async function saveSnapshot(
  ctx: ReturnType<typeof buildMockCtx>,
  snapshotMod: any,
  name: string,
  classIds: string[],
  totalCredits: number,
) {
  return snapshotMod.createCurrentScheduleSnapshot(ctx, { name, classIds, totalCredits })
}

async function restoreSnapshot(
  ctx: ReturnType<typeof buildMockCtx>,
  snapshotMod: any,
  draftMod: any,
  snapshotId: string,
) {
  const snapshot = await ctx.db.get(snapshotId)
  if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`)
  await draftMod.saveDraftSchedule(ctx, { classIds: snapshot.classIds as string[] })
}

async function getDraftClassIds(
  ctx: ReturnType<typeof buildMockCtx>,
  draftMod: any,
): Promise<string[]> {
  const draft = await draftMod.getDraftSchedule(ctx)
  return draft ? draft.classIds : []
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('schedule undo/redo via snapshot save+restore (DT141)', () => {
  const CLERK_USER = 'clerk|undo-redo'

  beforeEach(() => {
    vi.resetModules()
  })

  async function getMods() {
    const [snapshotMod, draftMod] = await Promise.all([
      import('../../../convex/scheduleSnapshots'),
      import('../../../convex/draftSchedule'),
    ])
    return { snapshotMod, draftMod }
  }

  // 1. Save snapshot with courses=[CS101] → restore it → schedule returns [CS101]
  it('save snapshot then restore → draft matches snapshot classIds', async () => {
    const { snapshotMod, draftMod } = await getMods()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: { subject: CLERK_USER }, db })

    // Set initial draft
    await draftMod.saveDraftSchedule(ctx, { classIds: ['CS101'] })

    // Save snapshot capturing [CS101]
    const snap = await saveSnapshot(ctx, snapshotMod, 'before-change', ['CS101'], 3)

    // Modify draft to something else
    await draftMod.saveDraftSchedule(ctx, { classIds: ['CS101', 'ENG200'] })
    expect(await getDraftClassIds(ctx, draftMod)).toEqual(['CS101', 'ENG200'])

    // Restore snapshot → draft should be [CS101] again
    await restoreSnapshot(ctx, snapshotMod, draftMod, snap.id)
    expect(await getDraftClassIds(ctx, draftMod)).toEqual(['CS101'])
  })

  // 2. Save A with [CS101], add MATH201, save B → restore A → MATH201 gone
  it('restore older snapshot A removes courses added after it', async () => {
    const { snapshotMod, draftMod } = await getMods()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: { subject: CLERK_USER }, db })

    await draftMod.saveDraftSchedule(ctx, { classIds: ['CS101'] })
    const snapA = await saveSnapshot(ctx, snapshotMod, 'snap-A', ['CS101'], 3)

    await draftMod.saveDraftSchedule(ctx, { classIds: ['CS101', 'MATH201'] })
    await saveSnapshot(ctx, snapshotMod, 'snap-B', ['CS101', 'MATH201'], 7)

    // Restore A → MATH201 should be gone
    await restoreSnapshot(ctx, snapshotMod, draftMod, snapA.id)
    const ids = await getDraftClassIds(ctx, draftMod)
    expect(ids).toEqual(['CS101'])
    expect(ids).not.toContain('MATH201')
  })

  // 3. Restore snapshot B again → MATH201 back
  it('restore newer snapshot B brings back removed courses', async () => {
    const { snapshotMod, draftMod } = await getMods()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: { subject: CLERK_USER }, db })

    await draftMod.saveDraftSchedule(ctx, { classIds: ['CS101'] })
    const snapA = await saveSnapshot(ctx, snapshotMod, 'snap-A', ['CS101'], 3)
    await draftMod.saveDraftSchedule(ctx, { classIds: ['CS101', 'MATH201'] })
    const snapB = await saveSnapshot(ctx, snapshotMod, 'snap-B', ['CS101', 'MATH201'], 7)

    // Restore A first
    await restoreSnapshot(ctx, snapshotMod, draftMod, snapA.id)
    expect(await getDraftClassIds(ctx, draftMod)).toEqual(['CS101'])

    // Restore B → MATH201 is back
    await restoreSnapshot(ctx, snapshotMod, draftMod, snapB.id)
    expect(await getDraftClassIds(ctx, draftMod)).toEqual(['CS101', 'MATH201'])
  })

  // 4. Snapshot restore is atomic (all courses replaced, not merged)
  it('restore replaces all classIds atomically — no merge with current draft', async () => {
    const { snapshotMod, draftMod } = await getMods()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: { subject: CLERK_USER }, db })

    // Draft starts with [BIO300, CHEM400]
    await draftMod.saveDraftSchedule(ctx, { classIds: ['BIO300', 'CHEM400'] })

    // Snapshot captures completely different set [CS101]
    const snap = await saveSnapshot(ctx, snapshotMod, 'atomic-test', ['CS101'], 3)

    // Add more courses to draft
    await draftMod.saveDraftSchedule(ctx, { classIds: ['BIO300', 'CHEM400', 'PHYS500'] })

    // Restore snapshot → should be exactly [CS101], not merged
    await restoreSnapshot(ctx, snapshotMod, draftMod, snap.id)
    const ids = await getDraftClassIds(ctx, draftMod)
    expect(ids).toEqual(['CS101'])
    expect(ids).not.toContain('BIO300')
    expect(ids).not.toContain('CHEM400')
    expect(ids).not.toContain('PHYS500')
  })

  // 5. Restore non-existent snapshotId → throws error
  it('restore with non-existent snapshotId throws', async () => {
    const { snapshotMod, draftMod } = await getMods()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: { subject: CLERK_USER }, db })

    await expect(
      restoreSnapshot(ctx, snapshotMod, draftMod, 'scheduleSnapshots-9999'),
    ).rejects.toThrow('Snapshot not found')
  })
})
