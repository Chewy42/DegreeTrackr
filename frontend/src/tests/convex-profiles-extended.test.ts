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

// ── Mock dependencies before importing ─────────────────────────────────────

vi.mock('../../../convex/contracts', () => ({
  onboardingAnswersValidator: {},
  schedulingPreferencesValidator: {},
  userPreferencesValidator: {},
}))

vi.mock('../../../convex/legacyHydration', () => ({
  legacyHydrationArgsValidator: {},
  readLegacyJson: vi.fn(),
}))

// ── Suite ──────────────────────────────────────────────────────────────────

describe('convex/profile extended edge cases', () => {
  const CLERK_SUBJECT = 'clerk|user-ext-1'
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  async function getHandlers() {
    const mod = await import('../../../convex/profile')
    return {
      getCurrentSchedulingPreferences: (mod.getCurrentSchedulingPreferences as any)._handler,
      updateCurrentSchedulingPreferences: (mod.updateCurrentSchedulingPreferences as any)._handler,
      completeCurrentOnboarding: (mod.completeCurrentOnboarding as any)._handler,
      deleteCurrentUserAccount: (mod.deleteCurrentUserAccount as any)._handler,
    }
  }

  // ── Scheduling preferences: unauthenticated guard ─────────────────────

  describe('getCurrentSchedulingPreferences', () => {
    it('returns null for unauthenticated user', async () => {
      const { getCurrentSchedulingPreferences } = await getHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: null, db })

      const result = await getCurrentSchedulingPreferences(ctx, {})
      expect(result).toBeNull()
    })
  })

  // ── Scheduling preferences: create-on-first-update ────────────────────

  describe('updateCurrentSchedulingPreferences', () => {
    it('creates scheduling preferences record when none exist', async () => {
      const { updateCurrentSchedulingPreferences } = await getHandlers()
      const db = buildMockDb()
      const userId = await db.insert('userProfiles', { clerkUserId: CLERK_SUBJECT })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await updateCurrentSchedulingPreferences(ctx, {
        patch: { credit_load: 'heavy' },
      })
      expect(result.credit_load).toBe('heavy')

      // Verify a record was inserted into schedulingPreferences table
      const schedRecords = [...db._records.values()].filter(
        (r) => r._table === 'schedulingPreferences' && r.userId === userId,
      )
      expect(schedRecords).toHaveLength(1)
    })
  })

  // ── Onboarding completion persists scheduling answers ─────────────────

  describe('completeCurrentOnboarding', () => {
    it('marks onboardingComplete and persists scheduling answers', async () => {
      const { completeCurrentOnboarding } = await getHandlers()
      const db = buildMockDb()
      await db.insert('userProfiles', { clerkUserId: CLERK_SUBJECT })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await completeCurrentOnboarding(ctx, {
        answers: { planning_mode: 'upcoming_semester', credit_load: 'standard' },
      })

      expect(result.userPreferences.onboardingComplete).toBe(true)
      expect(result.schedulingPreferences).toMatchObject({
        planning_mode: 'upcoming_semester',
        credit_load: 'standard',
      })
    })
  })

  // ── Account deletion cascades across tables ───────────────────────────

  describe('deleteCurrentUserAccount', () => {
    it('cascades deletion across preferences, evaluations, and profile', async () => {
      const { deleteCurrentUserAccount } = await getHandlers()
      const db = buildMockDb()
      const userId = await db.insert('userProfiles', { clerkUserId: CLERK_SUBJECT })
      await db.insert('userPreferences', { userId, theme: 'dark' })
      await db.insert('programEvaluations', { userId, email: 'test@example.com' })

      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await deleteCurrentUserAccount(ctx, {})
      expect(result).toEqual({ deleted: true })

      // All records should be gone
      const remaining = [...db._records.values()]
      expect(remaining).toHaveLength(0)
    })
  })
})
