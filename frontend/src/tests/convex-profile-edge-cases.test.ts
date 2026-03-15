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

// We do NOT mock userState — we let it run against our mock db so that
// ensureCurrentUserRecord and getCurrentUserState work naturally.

// ── Suite ──────────────────────────────────────────────────────────────────

describe('convex/profile edge cases', () => {
  const CLERK_SUBJECT = 'clerk|user-1'
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  async function getHandlers() {
    const mod = await import('../../../convex/profile')
    return {
      getCurrentUserProfile: (mod.getCurrentUserProfile as any)._handler,
      updateCurrentUserProfile: (mod.updateCurrentUserProfile as any)._handler,
      getCurrentUserPreferences: (mod.getCurrentUserPreferences as any)._handler,
      updateCurrentUserPreferences: (mod.updateCurrentUserPreferences as any)._handler,
    }
  }

  describe('getCurrentUserProfile', () => {
    it('returns null for unauthenticated user (no identity)', async () => {
      const { getCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: null, db })

      const result = await getCurrentUserProfile(ctx, {})
      expect(result).toBeNull()
    })

    it('returns null for unknown userId (authenticated but no profile record)', async () => {
      const { getCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await getCurrentUserProfile(ctx, {})
      expect(result).toBeNull()
    })

    it('returns profile when user exists', async () => {
      const { getCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      // Seed a user profile
      await db.insert('userProfiles', {
        clerkUserId: CLERK_SUBJECT,
        primaryEmail: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        displayName: 'Test User',
      })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await getCurrentUserProfile(ctx, {})
      expect(result).not.toBeNull()
      expect(result.clerkUserId).toBe(CLERK_SUBJECT)
      expect(result.firstName).toBe('Test')
    })
  })

  describe('updateCurrentUserProfile', () => {
    it('owner can update their own profile', async () => {
      const { updateCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      await db.insert('userProfiles', {
        clerkUserId: CLERK_SUBJECT,
        primaryEmail: 'test@example.com',
        firstName: 'Original',
        lastName: 'Name',
        displayName: 'Original Name',
      })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await updateCurrentUserProfile(ctx, {
        patch: { firstName: 'Updated' },
      })
      expect(result.firstName).toBe('Updated')
    })

    it('unauthenticated user throws immediately', async () => {
      const { updateCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: null, db })

      await expect(
        updateCurrentUserProfile(ctx, { patch: { firstName: 'Hacker' } }),
      ).rejects.toThrow()
    })

    it('throws on empty string field value', async () => {
      const { updateCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      await db.insert('userProfiles', {
        clerkUserId: CLERK_SUBJECT,
        primaryEmail: 'test@example.com',
      })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      await expect(
        updateCurrentUserProfile(ctx, { patch: { firstName: '   ' } }),
      ).rejects.toThrow(/must not be an empty string/)
    })

    it('throws when field exceeds 200 character limit', async () => {
      const { updateCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      await db.insert('userProfiles', {
        clerkUserId: CLERK_SUBJECT,
      })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const longName = 'A'.repeat(201)
      await expect(
        updateCurrentUserProfile(ctx, { patch: { displayName: longName } }),
      ).rejects.toThrow(/exceeds 200 character limit/)
    })
  })

  describe('getCurrentUserPreferences', () => {
    it('returns null for unauthenticated user', async () => {
      const { getCurrentUserPreferences } = await getHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({ identity: null, db })

      const result = await getCurrentUserPreferences(ctx, {})
      expect(result).toBeNull()
    })

    it('returns null when user exists but has no preferences record', async () => {
      const { getCurrentUserPreferences } = await getHandlers()
      const db = buildMockDb()
      await db.insert('userProfiles', { clerkUserId: CLERK_SUBJECT })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await getCurrentUserPreferences(ctx, {})
      expect(result).toBeNull()
    })
  })

  describe('ownership isolation', () => {
    it('user A cannot see user B profile via getCurrentUserProfile', async () => {
      const { getCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      // Seed user B's profile
      await db.insert('userProfiles', {
        clerkUserId: 'clerk|user-B',
        primaryEmail: 'b@example.com',
        firstName: 'UserB',
      })
      // Authenticate as user A (no profile of their own)
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await getCurrentUserProfile(ctx, {})
      // User A has no profile — should get null, not user B's data
      expect(result).toBeNull()
    })

    it('user A update does not touch user B profile', async () => {
      const { updateCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      await db.insert('userProfiles', {
        clerkUserId: 'clerk|user-B',
        firstName: 'OriginalB',
      })
      // User A authenticates — ensureCurrentUserRecord auto-creates their profile
      const ctx = buildMockCtx({
        identity: { subject: CLERK_SUBJECT, email: 'a@example.com', givenName: 'UserA' },
        db,
      })

      await updateCurrentUserProfile(ctx, { patch: { firstName: 'UpdatedA' } })

      // Verify user B's name is untouched
      const bRecords = [...db._records.values()].filter(
        (r) => r._table === 'userProfiles' && r.clerkUserId === 'clerk|user-B',
      )
      expect(bRecords).toHaveLength(1)
      expect(bRecords[0].firstName).toBe('OriginalB')
    })
  })

  describe('auto-provisioning via ensureCurrentUserRecord', () => {
    it('creates a new profile on first mutation for unknown user', async () => {
      const { updateCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      const ctx = buildMockCtx({
        identity: { subject: CLERK_SUBJECT, email: 'new@example.com', givenName: 'New', familyName: 'User', name: 'New User' },
        db,
      })

      const result = await updateCurrentUserProfile(ctx, { patch: { displayName: 'Newbie' } })
      expect(result.displayName).toBe('Newbie')
      expect(result.clerkUserId).toBe(CLERK_SUBJECT)

      // Verify exactly one profile record was created
      const profiles = [...db._records.values()].filter(
        (r) => r._table === 'userProfiles' && r.clerkUserId === CLERK_SUBJECT,
      )
      expect(profiles).toHaveLength(1)
    })
  })

  describe('null field handling', () => {
    it('returns null for missing optional profile fields', async () => {
      const { getCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      // Profile with only clerkUserId — no names, no email
      await db.insert('userProfiles', { clerkUserId: CLERK_SUBJECT })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await getCurrentUserProfile(ctx, {})
      expect(result).not.toBeNull()
      expect(result.primaryEmail).toBeNull()
      expect(result.firstName).toBeNull()
      expect(result.lastName).toBeNull()
      expect(result.displayName).toBeNull()
    })

    it('update preserves unpatched fields as-is', async () => {
      const { updateCurrentUserProfile } = await getHandlers()
      const db = buildMockDb()
      await db.insert('userProfiles', {
        clerkUserId: CLERK_SUBJECT,
        firstName: 'Keep',
        lastName: 'This',
      })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await updateCurrentUserProfile(ctx, { patch: { displayName: 'NewDisplay' } })
      expect(result.displayName).toBe('NewDisplay')
      expect(result.firstName).toBe('Keep')
      expect(result.lastName).toBe('This')
    })
  })

  describe('updateCurrentUserPreferences', () => {
    it('creates preferences with defaults when none exist', async () => {
      const { updateCurrentUserPreferences } = await getHandlers()
      const db = buildMockDb()
      const userId = await db.insert('userProfiles', { clerkUserId: CLERK_SUBJECT })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await updateCurrentUserPreferences(ctx, {
        patch: { theme: 'dark' },
      })
      expect(result.theme).toBe('dark')

      // Verify record was inserted into userPreferences table
      const prefRecords = [...db._records.values()].filter(
        (r) => r._table === 'userPreferences' && r.userId === userId,
      )
      expect(prefRecords).toHaveLength(1)
    })

    it('updates existing preferences without creating duplicates', async () => {
      const { updateCurrentUserPreferences } = await getHandlers()
      const db = buildMockDb()
      const userId = await db.insert('userProfiles', { clerkUserId: CLERK_SUBJECT })
      await db.insert('userPreferences', { userId, theme: 'light' })
      const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, db })

      const result = await updateCurrentUserPreferences(ctx, {
        patch: { theme: 'dark' },
      })
      expect(result.theme).toBe('dark')

      // Still only one preferences record
      const prefRecords = [...db._records.values()].filter(
        (r) => r._table === 'userPreferences' && r.userId === userId,
      )
      expect(prefRecords).toHaveLength(1)
    })
  })
})
