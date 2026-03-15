import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

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
    auth: { getUserIdentity: async () => options.identity },
    db: options.db,
  }
}

// ── Identities ─────────────────────────────────────────────────────────────

const userA = { subject: 'clerk|user_a', email: 'a@test.com' }
const userB = { subject: 'clerk|user_b', email: 'b@test.com' }

// ── Handlers helper ────────────────────────────────────────────────────────

async function getSnapshotHandlers() {
  const mod = await import('../../../convex/scheduleSnapshots')
  return {
    create: (mod.createCurrentScheduleSnapshot as any)._handler,
    list: (mod.listCurrentScheduleSnapshots as any)._handler,
    del: (mod.deleteCurrentScheduleSnapshot as any)._handler,
  }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('snapshot pagination — list / filter / delete / auth', () => {
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => { vi.useRealTimers() })

  it('create 3 snapshots → listSnapshots returns all 3 newest-first', async () => {
    const { create, list } = await getSnapshotHandlers()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: userA, db })

    vi.setSystemTime(NOW)
    await create(ctx, { name: 'Plan A', classIds: ['CS101'], totalCredits: 3 })
    vi.setSystemTime(NOW + 1000)
    await create(ctx, { name: 'Plan B', classIds: ['CS201', 'MATH101'], totalCredits: 7 })
    vi.setSystemTime(NOW + 2000)
    await create(ctx, { name: 'Plan C', classIds: ['ENG100'], totalCredits: 4 })

    const results = await list(ctx, {})
    expect(results).toHaveLength(3)
    expect(results[0].name).toBe('Plan C')
    expect(results[1].name).toBe('Plan B')
    expect(results[2].name).toBe('Plan A')
  })

  it('filter by userId → only own snapshots returned', async () => {
    const { create, list } = await getSnapshotHandlers()
    const db = buildMockDb()

    const ctxA = buildMockCtx({ identity: userA, db })
    const ctxB = buildMockCtx({ identity: userB, db })

    await create(ctxA, { name: 'A-snap', classIds: ['CS101'], totalCredits: 3 })
    await create(ctxB, { name: 'B-snap', classIds: ['ART200'], totalCredits: 3 })
    await create(ctxA, { name: 'A-snap-2', classIds: ['CS201'], totalCredits: 4 })

    const aResults = await list(ctxA, {})
    const bResults = await list(ctxB, {})

    expect(aResults).toHaveLength(2)
    expect(aResults.every((s: any) => s.userId === userA.subject)).toBe(true)
    expect(bResults).toHaveLength(1)
    expect(bResults[0].name).toBe('B-snap')
  })

  it('delete 1 snapshot → list returns 2', async () => {
    const { create, list, del } = await getSnapshotHandlers()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: userA, db })

    vi.setSystemTime(NOW)
    const snap1 = await create(ctx, { name: 'Keep-1', classIds: ['A'], totalCredits: 3 })
    vi.setSystemTime(NOW + 1000)
    const snap2 = await create(ctx, { name: 'Delete-me', classIds: ['B'], totalCredits: 3 })
    vi.setSystemTime(NOW + 2000)
    await create(ctx, { name: 'Keep-2', classIds: ['C'], totalCredits: 3 })

    await del(ctx, { id: snap2.id })

    const results = await list(ctx, {})
    expect(results).toHaveLength(2)
    expect(results.map((s: any) => s.name)).toEqual(['Keep-2', 'Keep-1'])
  })

  it('unauthenticated → list throws', async () => {
    const { list } = await getSnapshotHandlers()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: null, db })

    await expect(list(ctx, {})).rejects.toThrow(/[Uu]nauthenticated/)
  })

  it('snapshot has required fields: id, name, classIds, createdAt', async () => {
    const { create, list } = await getSnapshotHandlers()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: userA, db })

    await create(ctx, { name: 'Field Check', classIds: ['CS101', 'MATH200'], totalCredits: 7 })

    const results = await list(ctx, {})
    expect(results).toHaveLength(1)

    const snap = results[0]
    expect(snap).toMatchObject({
      id: expect.any(String),
      name: 'Field Check',
      classIds: ['CS101', 'MATH200'],
      createdAt: expect.any(Number),
      userId: userA.subject,
      totalCredits: 7,
      classCount: 2,
      migrationSource: 'convex',
    })
  })
})
