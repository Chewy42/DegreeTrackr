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

describe('convex/scheduleSnapshots CRUD', () => {
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  // ── createSnapshot ───────────────────────────────────────────────────

  describe('createSnapshot', () => {
    it('creates with title + data and returns new ID', async () => {
      const { create } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: userA, db })

      const result = await create(ctx, {
        name: 'Fall 2026',
        classIds: ['CS101', 'MATH200'],
        totalCredits: 7,
      })

      expect(result).toMatchObject({
        id: expect.any(String),
        userId: userA.subject,
        name: 'Fall 2026',
        classIds: ['CS101', 'MATH200'],
        totalCredits: 7,
        classCount: 2,
        migrationSource: 'convex',
      })
      expect(result.id).toBeTruthy()
    })

    it('rejects unauthenticated call', async () => {
      const { create } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: null, db })

      await expect(
        create(ctx, { name: 'X', classIds: [], totalCredits: 0 }),
      ).rejects.toThrow(/[Uu]nauthenticated/)
    })
  })

  // ── listSnapshots ────────────────────────────────────────────────────

  describe('listSnapshots', () => {
    it('returns all snapshots for the auth user, sorted newest-first', async () => {
      const { create, list } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: userA, db })

      vi.setSystemTime(NOW)
      await create(ctx, { name: 'Older', classIds: ['A'], totalCredits: 3 })
      vi.setSystemTime(NOW + 1000)
      await create(ctx, { name: 'Newer', classIds: ['B'], totalCredits: 4 })

      const results = await list(ctx, {})
      expect(results).toHaveLength(2)
      expect(results[0].name).toBe('Newer')
      expect(results[1].name).toBe('Older')
    })

    it('returns empty list for user with no snapshots', async () => {
      const { list } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: userB, db })

      const results = await list(ctx, {})
      expect(results).toEqual([])
    })

    it('auth guard — rejects unauthenticated', async () => {
      const { list } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: null, db })

      await expect(list(ctx, {})).rejects.toThrow(/[Uu]nauthenticated/)
    })
  })

  // ── restoreSnapshot (get by ID) ──────────────────────────────────────

  describe('restoreSnapshot (read-back by ID)', () => {
    it('returns correct data for a given snapshot ID', async () => {
      const { create, list } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: userA, db })

      const created = await create(ctx, {
        name: 'Spring Plan',
        classIds: ['CS201', 'ENG102'],
        totalCredits: 6,
      })

      // List and find by ID to verify data round-trips
      const all = await list(ctx, {})
      const found = all.find((s: any) => s.id === created.id)
      expect(found).toBeDefined()
      expect(found!.name).toBe('Spring Plan')
      expect(found!.classIds).toEqual(['CS201', 'ENG102'])
      expect(found!.totalCredits).toBe(6)
    })

    it('other user cannot see snapshot via list', async () => {
      const { create, list } = await getSnapshotHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      await create(ctxA, { name: 'Private', classIds: ['X'], totalCredits: 1 })

      const ctxB = buildMockCtx({ identity: userB, db })
      const bList = await list(ctxB, {})
      expect(bList).toHaveLength(0)
    })
  })

  // ── deleteSnapshot ───────────────────────────────────────────────────

  describe('deleteSnapshot', () => {
    it('removes record — subsequent list excludes it', async () => {
      const { create, list, del } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: userA, db })

      const snap = await create(ctx, { name: 'Doomed', classIds: ['D'], totalCredits: 2 })
      expect(await list(ctx, {})).toHaveLength(1)

      await del(ctx, { id: snap.id })
      expect(await list(ctx, {})).toHaveLength(0)
    })

    it('deleting already-deleted snapshot is a no-op (idempotent)', async () => {
      const { create, del } = await getSnapshotHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: userA, db })

      const snap = await create(ctx, { name: 'Gone', classIds: [], totalCredits: 0 })
      await del(ctx, { id: snap.id })
      // Second delete should not throw
      await expect(del(ctx, { id: snap.id })).resolves.toBeUndefined()
    })
  })

  // ── deleteSnapshot other user ────────────────────────────────────────

  describe('deleteSnapshot ownership', () => {
    it('throws when another user tries to delete (ownership check)', async () => {
      const { create, del } = await getSnapshotHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      const snap = await create(ctxA, { name: 'Protected', classIds: ['P'], totalCredits: 3 })

      const ctxB = buildMockCtx({ identity: userB, db })
      await expect(del(ctxB, { id: snap.id })).rejects.toThrow(/[Uu]nauthorized/)
    })

    it('owner can still delete their own snapshot', async () => {
      const { create, list, del } = await getSnapshotHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      const snap = await create(ctxA, { name: 'Mine', classIds: ['M'], totalCredits: 1 })
      await del(ctxA, { id: snap.id })

      expect(await list(ctxA, {})).toHaveLength(0)
    })
  })
})
