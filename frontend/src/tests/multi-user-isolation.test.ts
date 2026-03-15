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

// ── Mock dependencies before importing ─────────────────────────────────────

vi.mock('../../../convex/contracts', () => ({
  onboardingAnswersValidator: {},
  schedulingPreferencesValidator: {},
  userPreferencesValidator: {},
  chatScopeValidator: {},
}))

vi.mock('../../../convex/legacyHydration', () => ({
  legacyHydrationArgsValidator: {},
  readLegacyJson: vi.fn(),
  requestLegacyJson: vi.fn(),
}))

// ── Identities ─────────────────────────────────────────────────────────────

const userA = { subject: 'clerk|user_a', email: 'a@test.com', givenName: 'Alice', name: 'Alice A' }
const userB = { subject: 'clerk|user_b', email: 'b@test.com', givenName: 'Bob', name: 'Bob B' }

// ── Suite ──────────────────────────────────────────────────────────────────

describe('multi-user data isolation (per entity)', () => {
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => { vi.useRealTimers() })

  // ── Profile isolation ──────────────────────────────────────────────────

  describe('profile isolation', () => {
    async function getProfileHandlers() {
      const mod = await import('../../../convex/profile')
      return {
        getCurrentUserProfile: (mod.getCurrentUserProfile as any)._handler,
        updateCurrentUserProfile: (mod.updateCurrentUserProfile as any)._handler,
      }
    }

    it('userA creates profile → userB getCurrentUserProfile returns null', async () => {
      const { getCurrentUserProfile, updateCurrentUserProfile } = await getProfileHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      await updateCurrentUserProfile(ctxA, { patch: { firstName: 'Alice' } })

      const ctxB = buildMockCtx({ identity: userB, db })
      const profileB = await getCurrentUserProfile(ctxB, {})
      expect(profileB).toBeNull()
    })

    it('userB cannot update userA profile (update scoped to own identity)', async () => {
      const { getCurrentUserProfile, updateCurrentUserProfile } = await getProfileHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      await updateCurrentUserProfile(ctxA, { patch: { firstName: 'Alice' } })

      const ctxB = buildMockCtx({ identity: userB, db })
      await updateCurrentUserProfile(ctxB, { patch: { firstName: 'Evil' } })

      // userA profile unchanged
      const profileA = await getCurrentUserProfile(ctxA, {})
      expect(profileA.firstName).toBe('Alice')

      // userB got their own profile created
      const profileB = await getCurrentUserProfile(ctxB, {})
      expect(profileB.firstName).toBe('Evil')
      expect(profileB.clerkUserId).toBe(userB.subject)
    })
  })

  // ── Draft schedule isolation ───────────────────────────────────────────

  describe('draft schedule isolation', () => {
    async function getDraftHandlers() {
      const mod = await import('../../../convex/draftSchedule')
      return {
        getDraftSchedule: (mod.getDraftSchedule as any)._handler,
        saveDraftSchedule: (mod.saveDraftSchedule as any)._handler,
      }
    }

    it('userA saves draft → userB getDraftSchedule returns null', async () => {
      const { getDraftSchedule, saveDraftSchedule } = await getDraftHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      await saveDraftSchedule(ctxA, { classIds: ['CS101', 'MATH200', 'ENG150'] })

      const ctxB = buildMockCtx({ identity: userB, db })
      const draftB = await getDraftSchedule(ctxB, {})
      expect(draftB).toBeNull()
    })

    it('both users maintain independent draft schedules', async () => {
      const { getDraftSchedule, saveDraftSchedule } = await getDraftHandlers()
      const db = buildMockDb()

      const ctxA = buildMockCtx({ identity: userA, db })
      await saveDraftSchedule(ctxA, { classIds: ['CS101'] })

      const ctxB = buildMockCtx({ identity: userB, db })
      await saveDraftSchedule(ctxB, { classIds: ['BIO200', 'CHEM110'] })

      // Mutate userB draft
      await saveDraftSchedule(ctxB, { classIds: ['BIO200'] })

      const draftA = await getDraftSchedule(ctxA, {})
      expect(draftA!.classIds).toEqual(['CS101'])

      const draftB = await getDraftSchedule(ctxB, {})
      expect(draftB!.classIds).toEqual(['BIO200'])
    })
  })

  // ── Evaluation isolation ─────────────────────────────────────────────

  describe('evaluation isolation', () => {
    async function getEvalHandlers() {
      const mod = await import('../../../convex/evaluations')
      return {
        getCurrentProgramEvaluation: (mod.getCurrentProgramEvaluation as any)._handler,
        replaceCurrentProgramEvaluationFromUpload: (mod.replaceCurrentProgramEvaluationFromUpload as any)._handler,
      }
    }

    it('userA uploads evaluation → userB getCurrentProgramEvaluation returns null', async () => {
      const { getCurrentProgramEvaluation, replaceCurrentProgramEvaluationFromUpload } = await getEvalHandlers()
      const db = buildMockDb()

      // userA needs a profile record for evaluation to attach to
      await db.insert('userProfiles', { clerkUserId: userA.subject, primaryEmail: userA.email })

      const ctxA = buildMockCtx({ identity: userA, db })
      await replaceCurrentProgramEvaluationFromUpload(ctxA, {
        payload: {
          email: userA.email,
          original_filename: 'transcript.pdf',
          file_size_bytes: 2048,
        },
      })

      // Verify userA sees their evaluation
      const evalA = await getCurrentProgramEvaluation(ctxA, {})
      expect(evalA).not.toBeNull()
      expect(evalA!.email).toBe(userA.email)

      // userB has no profile → evaluation returns null
      const ctxB = buildMockCtx({ identity: userB, db })
      const evalB = await getCurrentProgramEvaluation(ctxB, {})
      expect(evalB).toBeNull()
    })

    it('userB with own profile still cannot see userA evaluation', async () => {
      const { getCurrentProgramEvaluation, replaceCurrentProgramEvaluationFromUpload } = await getEvalHandlers()
      const db = buildMockDb()

      // Both users have profiles
      await db.insert('userProfiles', { clerkUserId: userA.subject, primaryEmail: userA.email })
      await db.insert('userProfiles', { clerkUserId: userB.subject, primaryEmail: userB.email })

      const ctxA = buildMockCtx({ identity: userA, db })
      await replaceCurrentProgramEvaluationFromUpload(ctxA, {
        payload: {
          email: userA.email,
          original_filename: 'eval_a.pdf',
          file_size_bytes: 1024,
        },
      })

      // userB queries → null (evaluation scoped to userA's profile id)
      const ctxB = buildMockCtx({ identity: userB, db })
      const evalB = await getCurrentProgramEvaluation(ctxB, {})
      expect(evalB).toBeNull()
    })
  })

  // ── Chat session isolation ───────────────────────────────────────────

  describe('chat session isolation', () => {
    async function getChatHandlers() {
      const mod = await import('../../../convex/chat')
      return {
        listCurrentChatSessions: (mod.listCurrentChatSessions as any)._handler,
        getCurrentChatSession: (mod.getCurrentChatSession as any)._handler,
        syncCurrentChatSessionFromLegacy: (mod.syncCurrentChatSessionFromLegacy as any)._handler,
      }
    }

    it('userA sends chat → userB listCurrentChatSessions returns empty', async () => {
      const { listCurrentChatSessions, syncCurrentChatSessionFromLegacy } = await getChatHandlers()
      const db = buildMockDb()

      // userA needs a profile
      await db.insert('userProfiles', { clerkUserId: userA.subject, primaryEmail: userA.email })

      const ctxA = buildMockCtx({ identity: userA, db })
      await syncCurrentChatSessionFromLegacy(ctxA, {
        scope: 'explore',
        title: 'Career Exploration',
        legacySessionId: 'legacy-001',
        messages: [
          { role: 'user', content: 'What classes should I take?' },
          { role: 'assistant', content: 'Here are some suggestions...' },
        ],
      })

      // Verify userA can list their session
      const sessionsA = await listCurrentChatSessions(ctxA, { scope: 'explore' })
      expect(sessionsA).toHaveLength(1)
      expect(sessionsA[0].title).toBe('Career Exploration')

      // userB has no profile → empty list
      const ctxB = buildMockCtx({ identity: userB, db })
      const sessionsB = await listCurrentChatSessions(ctxB, { scope: 'explore' })
      expect(sessionsB).toHaveLength(0)
    })

    it('userB with own profile cannot read userA chat session', async () => {
      const { listCurrentChatSessions, getCurrentChatSession, syncCurrentChatSessionFromLegacy } = await getChatHandlers()
      const db = buildMockDb()

      // Both users have profiles
      await db.insert('userProfiles', { clerkUserId: userA.subject, primaryEmail: userA.email })
      await db.insert('userProfiles', { clerkUserId: userB.subject, primaryEmail: userB.email })

      // userA creates a chat session
      const ctxA = buildMockCtx({ identity: userA, db })
      const resultA = await syncCurrentChatSessionFromLegacy(ctxA, {
        scope: 'explore',
        title: 'My Private Chat',
        legacySessionId: 'legacy-002',
        messages: [
          { role: 'user', content: 'Secret academic plans' },
          { role: 'assistant', content: 'Here is your plan...' },
        ],
      })

      // userB lists their sessions → empty (no cross-user leakage)
      const ctxB = buildMockCtx({ identity: userB, db })
      const sessionsB = await listCurrentChatSessions(ctxB, { scope: 'explore' })
      expect(sessionsB).toHaveLength(0)

      // userB tries to read userA session by ID → null (ownership check)
      const sessionDetail = await getCurrentChatSession(ctxB, { sessionId: resultA.session.id })
      expect(sessionDetail).toBeNull()
    })

    it('both users have independent chat histories', async () => {
      const { listCurrentChatSessions, syncCurrentChatSessionFromLegacy } = await getChatHandlers()
      const db = buildMockDb()

      await db.insert('userProfiles', { clerkUserId: userA.subject, primaryEmail: userA.email })
      await db.insert('userProfiles', { clerkUserId: userB.subject, primaryEmail: userB.email })

      const ctxA = buildMockCtx({ identity: userA, db })
      await syncCurrentChatSessionFromLegacy(ctxA, {
        scope: 'explore',
        title: 'Alice Chat',
        legacySessionId: 'legacy-a1',
        messages: [{ role: 'user', content: 'Hello from Alice' }],
      })

      const ctxB = buildMockCtx({ identity: userB, db })
      await syncCurrentChatSessionFromLegacy(ctxB, {
        scope: 'explore',
        title: 'Bob Chat',
        legacySessionId: 'legacy-b1',
        messages: [{ role: 'user', content: 'Hello from Bob' }],
      })

      const sessionsA = await listCurrentChatSessions(ctxA, { scope: 'explore' })
      expect(sessionsA).toHaveLength(1)
      expect(sessionsA[0].title).toBe('Alice Chat')

      const sessionsB = await listCurrentChatSessions(ctxB, { scope: 'explore' })
      expect(sessionsB).toHaveLength(1)
      expect(sessionsB[0].title).toBe('Bob Chat')
    })
  })
})
