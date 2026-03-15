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

describe('convex/userState — default/update/auth/isolation/persist (DT140)', () => {
  const CLERK_A = 'clerk|state-a'
  const CLERK_B = 'clerk|state-b'

  beforeEach(() => {
    vi.resetModules()
  })

  async function getMod() {
    return import('../../../convex/userState')
  }

  // 1. Default state for new user → returns defined object (not null/crash)
  it('getCurrentUserState returns a defined object for a new user with no profile', async () => {
    const { getCurrentUserState } = await getMod()
    const db = buildMockDb()
    const ctx = buildMockCtx({
      identity: { subject: CLERK_A, email: 'a@test.com' },
      db,
    })

    const result = await getCurrentUserState(ctx)
    expect(result).toBeDefined()
    expect(result).toHaveProperty('user')
    expect(result.user).toBeNull()
  })

  // 2. Update a preference field → returns updated value on subsequent read
  it('ensureCurrentUserRecord creates profile, patch updates it, subsequent read reflects change', async () => {
    const { ensureCurrentUserRecord, getCurrentUserState } = await getMod()
    const db = buildMockDb()
    const ctx = buildMockCtx({
      identity: { subject: CLERK_A, email: 'a@test.com', givenName: 'Alice' },
      db,
    })

    const { user } = await ensureCurrentUserRecord(ctx)
    expect(user.firstName).toBe('Alice')

    // Simulate updating a field via db.patch
    await db.patch(user._id, { firstName: 'Alicia' })

    // Subsequent read should reflect the update
    const state = await getCurrentUserState(ctx)
    expect(state.user).not.toBeNull()
    expect(state.user.firstName).toBe('Alicia')
  })

  // 3. Auth guard → unauthenticated access returns empty/null
  it('getCurrentUserState returns { user: null } for unauthenticated context', async () => {
    const { getCurrentUserState } = await getMod()
    const db = buildMockDb()
    const ctx = buildMockCtx({ identity: null, db })

    const result = await getCurrentUserState(ctx)
    expect(result.user).toBeNull()
  })

  // 4. Two users → each gets their own state (isolation)
  it('two users get isolated state — each sees only their own profile', async () => {
    const { ensureCurrentUserRecord, getCurrentUserState } = await getMod()
    const db = buildMockDb()

    const ctxA = buildMockCtx({ identity: { subject: CLERK_A, email: 'a@t.com', givenName: 'Alice' }, db })
    const ctxB = buildMockCtx({ identity: { subject: CLERK_B, email: 'b@t.com', givenName: 'Bob' }, db })

    await ensureCurrentUserRecord(ctxA)
    await ensureCurrentUserRecord(ctxB)

    const stateA = await getCurrentUserState(ctxA)
    const stateB = await getCurrentUserState(ctxB)

    expect(stateA.user.clerkUserId).toBe(CLERK_A)
    expect(stateB.user.clerkUserId).toBe(CLERK_B)
    expect(stateA.user._id).not.toBe(stateB.user._id)
    expect(stateA.user.firstName).toBe('Alice')
    expect(stateB.user.firstName).toBe('Bob')
  })

  // 5. State persists across mock function calls (read after write)
  it('state persists across calls — ensureCurrentUserRecord then getCurrentUserState returns same record', async () => {
    const { ensureCurrentUserRecord, getCurrentUserState } = await getMod()
    const db = buildMockDb()
    const ctx = buildMockCtx({
      identity: { subject: CLERK_A, email: 'a@test.com', name: 'Alice A' },
      db,
    })

    const { user: created } = await ensureCurrentUserRecord(ctx)
    const { user: read } = await getCurrentUserState(ctx)

    expect(read).not.toBeNull()
    expect(read._id).toBe(created._id)
    expect(read.clerkUserId).toBe(CLERK_A)
    expect(read.primaryEmail).toBe('a@test.com')
    expect(read.displayName).toBe('Alice A')
  })
})
