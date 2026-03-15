import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'

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
  identity: { subject: string; email?: string; givenName?: string; familyName?: string; name?: string } | null
  db: ReturnType<typeof buildMockDb>
}) {
  return {
    auth: {
      getUserIdentity: async () => options.identity,
    },
    db: options.db,
  }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('convex/profiles upsert — ensureCurrentUserRecord idempotency', () => {
  const CLERK_A = 'clerk|user-a'
  const CLERK_B = 'clerk|user-b'

  beforeEach(() => {
    vi.resetModules()
  })

  async function getEnsure() {
    const mod = await import('../../../convex/userState')
    return mod.ensureCurrentUserRecord
  }

  // ── Upsert: calling twice for same user produces exactly one record ──

  it('createProfile twice for same user → only 1 record (no duplicate)', async () => {
    const ensureCurrentUserRecord = await getEnsure()
    const db = buildMockDb()
    const identity = { subject: CLERK_A, email: 'a@test.com', givenName: 'Alice', familyName: 'A', name: 'Alice A' }
    const ctx = buildMockCtx({ identity, db })

    // First call — creates profile
    const first = await ensureCurrentUserRecord(ctx)
    expect(first.user).toBeDefined()
    expect(first.user.clerkUserId).toBe(CLERK_A)
    expect(first.user.primaryEmail).toBe('a@test.com')
    expect(first.user.firstName).toBe('Alice')

    // Second call — same user, should return existing, not create duplicate
    const second = await ensureCurrentUserRecord(ctx)
    expect(second.user._id).toBe(first.user._id)

    // Verify exactly one userProfiles record
    const profileRecords = [...db._records.values()].filter(
      (r) => r._table === 'userProfiles' && r.clerkUserId === CLERK_A,
    )
    expect(profileRecords).toHaveLength(1)
  })

  // ── ensureCurrentUserRecord idempotency across multiple calls ──

  it('ensureCurrentUserRecord is idempotent — three calls, one record', async () => {
    const ensureCurrentUserRecord = await getEnsure()
    const db = buildMockDb()
    const identity = { subject: CLERK_B, email: 'b@test.com', name: 'Bob B' }
    const ctx = buildMockCtx({ identity, db })

    const r1 = await ensureCurrentUserRecord(ctx)
    const r2 = await ensureCurrentUserRecord(ctx)
    const r3 = await ensureCurrentUserRecord(ctx)

    // All return same user ID
    expect(r1.user._id).toBe(r2.user._id)
    expect(r2.user._id).toBe(r3.user._id)

    // Total profile count for this user is 1
    const all = [...db._records.values()].filter(
      (r) => r._table === 'userProfiles' && r.clerkUserId === CLERK_B,
    )
    expect(all).toHaveLength(1)
  })

  // ── Two different users get separate records ──

  it('different users get separate profile records', async () => {
    const ensureCurrentUserRecord = await getEnsure()
    const db = buildMockDb()

    const ctxA = buildMockCtx({ identity: { subject: CLERK_A, email: 'a@t.com' }, db })
    const ctxB = buildMockCtx({ identity: { subject: CLERK_B, email: 'b@t.com' }, db })

    const a = await ensureCurrentUserRecord(ctxA)
    const b = await ensureCurrentUserRecord(ctxB)

    expect(a.user._id).not.toBe(b.user._id)
    expect(a.user.clerkUserId).toBe(CLERK_A)
    expect(b.user.clerkUserId).toBe(CLERK_B)

    const profiles = [...db._records.values()].filter((r) => r._table === 'userProfiles')
    expect(profiles).toHaveLength(2)
  })

  // ── Unauthenticated → throws ConvexError ──

  it('ensureCurrentUserRecord throws when unauthenticated', async () => {
    const ensureCurrentUserRecord = await getEnsure()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: null, db })

    await expect(ensureCurrentUserRecord(ctx)).rejects.toThrow('Unauthenticated')
  })

  // ── Created record has migrationSource = 'convex' ──

  it('newly created profile has migrationSource "convex"', async () => {
    const ensureCurrentUserRecord = await getEnsure()
    const db = buildMockDb()
    const ctx = buildMockCtx({
      identity: { subject: CLERK_A, email: 'a@test.com', givenName: 'Alice' },
      db,
    })

    const { user } = await ensureCurrentUserRecord(ctx)
    expect(user.migrationSource).toBe('convex')
  })
})
