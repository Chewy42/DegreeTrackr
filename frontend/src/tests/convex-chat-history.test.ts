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
  identity: { subject: string; email?: string; givenName?: string; name?: string } | null
  db: ReturnType<typeof buildMockDb>
}) {
  return {
    auth: { getUserIdentity: async () => options.identity },
    db: options.db,
  }
}

// ── Mock dependencies before importing ─────────────────────────────────────

vi.mock('../../../convex/contracts', () => ({
  chatScopeValidator: {},
  onboardingAnswersValidator: {},
  schedulingPreferencesValidator: {},
  userPreferencesValidator: {},
}))

vi.mock('../../../convex/legacyHydration', () => ({
  legacyHydrationArgsValidator: {},
  readLegacyJson: vi.fn(),
  requestLegacyJson: vi.fn(),
}))

// ── Identities ─────────────────────────────────────────────────────────────

const userA = { subject: 'clerk|user_a', email: 'a@test.com', givenName: 'Alice', name: 'Alice A' }
const userB = { subject: 'clerk|user_b', email: 'b@test.com', givenName: 'Bob', name: 'Bob B' }

// ── Handlers helper ────────────────────────────────────────────────────────

async function getChatHandlers() {
  const mod = await import('../../../convex/chat')
  return {
    syncCurrentChatSessionFromLegacy: (mod.syncCurrentChatSessionFromLegacy as any)._handler,
    getCurrentChatSession: (mod.getCurrentChatSession as any)._handler,
    deleteCurrentChatSession: (mod.deleteCurrentChatSession as any)._handler,
    clearCurrentChatSessions: (mod.clearCurrentChatSessions as any)._handler,
    listCurrentChatSessions: (mod.listCurrentChatSessions as any)._handler,
  }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('convex/chat message history CRUD', () => {
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => { vi.useRealTimers() })

  // Helper: seed a user profile + sync a session with N messages
  async function seedSession(
    db: ReturnType<typeof buildMockDb>,
    identity: typeof userA,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) {
    // Ensure user profile exists
    const existingProfile = [...db._records.values()].find(
      (r) => r._table === 'userProfiles' && r.clerkUserId === identity.subject,
    )
    if (!existingProfile) {
      await db.insert('userProfiles', {
        clerkUserId: identity.subject,
        primaryEmail: identity.email,
      })
    }

    const handlers = await getChatHandlers()
    const ctx = buildMockCtx({ identity, db })
    return handlers.syncCurrentChatSessionFromLegacy(ctx, {
      scope: 'general',
      title: 'Test Session',
      legacySessionId: `legacy-${identity.subject}-${Date.now()}`,
      messages,
    })
  }

  // ── Send 5 messages → getChatHistory returns all 5 ────────────────────

  describe('send and retrieve messages', () => {
    it('sends 5 messages → getChatHistory returns all 5 in chronological order', async () => {
      const handlers = await getChatHandlers()
      const db = buildMockDb()

      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
        { role: 'user' as const, content: 'What classes should I take?' },
        { role: 'assistant' as const, content: 'Here are some options...' },
        { role: 'user' as const, content: 'Thanks!' },
      ]

      const synced = await seedSession(db, userA, messages)

      // Read back via getCurrentChatSession
      const ctx = buildMockCtx({ identity: userA, db })
      const result = await handlers.getCurrentChatSession(ctx, { sessionId: synced.session.id })

      expect(result).not.toBeNull()
      expect(result!.messages).toHaveLength(5)

      // Verify chronological order (createdAt ascending)
      for (let i = 1; i < result!.messages.length; i++) {
        expect(result!.messages[i].createdAt).toBeGreaterThan(result!.messages[i - 1].createdAt)
      }
    })

    it('messages have correct role, content, and createdAt fields', async () => {
      const handlers = await getChatHandlers()
      const db = buildMockDb()

      const messages = [
        { role: 'user' as const, content: 'First message' },
        { role: 'assistant' as const, content: 'Second message' },
        { role: 'user' as const, content: 'Third message' },
        { role: 'assistant' as const, content: 'Fourth message' },
        { role: 'user' as const, content: 'Fifth message' },
      ]

      const synced = await seedSession(db, userA, messages)
      const ctx = buildMockCtx({ identity: userA, db })
      const result = await handlers.getCurrentChatSession(ctx, { sessionId: synced.session.id })

      expect(result!.messages).toHaveLength(5)

      // Each message should have the expected shape
      for (const [i, msg] of result!.messages.entries()) {
        expect(msg).toMatchObject({
          id: expect.any(String),
          role: messages[i].role,
          content: messages[i].content,
          createdAt: expect.any(Number),
        })
      }
    })
  })

  // ── Delete one session → 4 remain ────────────────────────────────────

  describe('delete session', () => {
    it('delete one session → listCurrentChatSessions excludes it', async () => {
      const handlers = await getChatHandlers()
      const db = buildMockDb()

      // Create two sessions
      const session1 = await seedSession(db, userA, [
        { role: 'user', content: 'Session 1 msg' },
      ])

      vi.setSystemTime(NOW + 5000)
      await seedSession(db, userA, [
        { role: 'user', content: 'Session 2 msg' },
      ])

      // List → should have 2
      const ctx = buildMockCtx({ identity: userA, db })
      const before = await handlers.listCurrentChatSessions(ctx, { scope: 'general' })
      expect(before).toHaveLength(2)

      // Delete session 1
      await handlers.deleteCurrentChatSession(ctx, { sessionId: session1.session.id })

      // List → should have 1
      const after = await handlers.listCurrentChatSessions(ctx, { scope: 'general' })
      expect(after).toHaveLength(1)

      // The deleted session should not be retrievable
      const deleted = await handlers.getCurrentChatSession(ctx, { sessionId: session1.session.id })
      expect(deleted).toBeNull()
    })
  })

  // ── Clear all sessions → empty ───────────────────────────────────────

  describe('clear all sessions', () => {
    it('clearCurrentChatSessions → listCurrentChatSessions returns empty', async () => {
      const handlers = await getChatHandlers()
      const db = buildMockDb()

      // Create 3 sessions
      await seedSession(db, userA, [{ role: 'user', content: 'Msg A' }])
      vi.setSystemTime(NOW + 1000)
      await seedSession(db, userA, [{ role: 'user', content: 'Msg B' }])
      vi.setSystemTime(NOW + 2000)
      await seedSession(db, userA, [{ role: 'user', content: 'Msg C' }])

      const ctx = buildMockCtx({ identity: userA, db })

      // Verify 3 exist
      const before = await handlers.listCurrentChatSessions(ctx, { scope: 'general' })
      expect(before).toHaveLength(3)

      // Clear all
      const clearResult = await handlers.clearCurrentChatSessions(ctx, { scope: 'general' })
      expect(clearResult.cleared).toBe(3)

      // List → empty
      const after = await handlers.listCurrentChatSessions(ctx, { scope: 'general' })
      expect(after).toHaveLength(0)
    })
  })

  // ── Auth guard: cross-user isolation ─────────────────────────────────

  describe('auth guard — cross-user isolation', () => {
    it('userA sessions are not visible to userB', async () => {
      const handlers = await getChatHandlers()
      const db = buildMockDb()

      // userA creates a session with messages
      const sessionA = await seedSession(db, userA, [
        { role: 'user', content: 'Private to A' },
        { role: 'assistant', content: 'Only A sees this' },
      ])

      // userB tries to read userA session directly → null
      const ctxB = buildMockCtx({ identity: userB, db })
      const result = await handlers.getCurrentChatSession(ctxB, { sessionId: sessionA.session.id })
      expect(result).toBeNull()

      // userB lists their own sessions → empty
      const sessionsB = await handlers.listCurrentChatSessions(ctxB, { scope: 'general' })
      expect(sessionsB).toHaveLength(0)
    })

    it('both users have independent session lists', async () => {
      const handlers = await getChatHandlers()
      const db = buildMockDb()

      await seedSession(db, userA, [{ role: 'user', content: 'A msg 1' }])
      vi.setSystemTime(NOW + 1000)
      await seedSession(db, userA, [{ role: 'user', content: 'A msg 2' }])

      vi.setSystemTime(NOW + 2000)
      await seedSession(db, userB, [{ role: 'user', content: 'B msg 1' }])

      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      const sessionsA = await handlers.listCurrentChatSessions(ctxA, { scope: 'general' })
      const sessionsB = await handlers.listCurrentChatSessions(ctxB, { scope: 'general' })

      expect(sessionsA).toHaveLength(2)
      expect(sessionsB).toHaveLength(1)
    })

    it('userB clearing sessions does not affect userA sessions', async () => {
      const handlers = await getChatHandlers()
      const db = buildMockDb()

      await seedSession(db, userA, [{ role: 'user', content: 'A stays' }])
      vi.setSystemTime(NOW + 1000)
      await seedSession(db, userB, [{ role: 'user', content: 'B goes' }])

      const ctxA = buildMockCtx({ identity: userA, db })
      const ctxB = buildMockCtx({ identity: userB, db })

      // userB clears their sessions
      await handlers.clearCurrentChatSessions(ctxB, { scope: 'general' })

      // userA sessions unaffected
      const sessionsA = await handlers.listCurrentChatSessions(ctxA, { scope: 'general' })
      expect(sessionsA).toHaveLength(1)

      // userB sessions cleared
      const sessionsB = await handlers.listCurrentChatSessions(ctxB, { scope: 'general' })
      expect(sessionsB).toHaveLength(0)
    })
  })
})
