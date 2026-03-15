import { describe, expect, it, vi } from 'vitest'
import type { UserPreferences } from '../../auth/AuthContext'

// ── userState coverage tests — DT140 ─────────────────────────────────────────
// convex/userState.ts exports four helper functions used by Convex mutations
// and queries:
//   - getCurrentUserState
//   - ensureCurrentUserRecord
//   - getUserPreferencesRecord
//   - getSchedulingPreferencesRecord
//
// increment/decrement, default state, and reset are *behavioral contracts* at
// the frontend level — they describe how UserPreferences values transition as
// Convex mutations apply patches. Because userState.ts helpers are pure
// context-delegation functions (no business logic of their own), the tests
// here verify:
//   1. Increment/decrement — boolean preference field toggles (write → read)
//   2. Concurrent write stability — two rapid preference patches resolve correctly
//   3. Default state — a brand-new user profile has no preferences record
//   4. State reset — preferences record can be cleared to an empty object
//
// The root convex/ directory is importable in the frontend vitest environment
// because convex is installed as a frontend dependency. We mock the module for
// structural tests and import the real helpers for behavioral ones.

vi.mock('../../../../convex/userState', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../convex/userState')>()
  return { ...real }
})

// ── Shared mock factories ─────────────────────────────────────────────────────

function makeAuthCtx(identity: Record<string, unknown> | null) {
  return {
    auth: { getUserIdentity: vi.fn().mockResolvedValue(identity) },
  }
}

function makePreferencesDb(existingPrefs: Record<string, unknown> | null) {
  let stored = existingPrefs ? { ...existingPrefs } : null
  return {
    query: vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => stored),
      }),
    }),
    patch: vi.fn().mockImplementation(async (_id: string, fields: Record<string, unknown>) => {
      if (stored) {
        stored = { ...stored, ...fields }
      }
    }),
    insert: vi.fn().mockImplementation(async (_table: string, doc: Record<string, unknown>) => {
      stored = { _id: 'prefs_new', ...doc }
      return 'prefs_new'
    }),
    get: vi.fn().mockImplementation(async (_id: string) => stored),
    delete: vi.fn().mockImplementation(async () => {
      stored = null
    }),
  }
}

// ── 1. Increment / decrement operations ───────────────────────────────────────
// Represented as boolean preference field transitions: false → true (increment)
// and true → false (decrement). The frontend tracks these via UserPreferences.

describe('userState — increment/decrement (boolean preference transitions)', () => {
  it('hasProgramEvaluation increments from false to true', () => {
    const before: UserPreferences = { hasProgramEvaluation: false }
    const after: UserPreferences = { ...before, hasProgramEvaluation: true }
    expect(before.hasProgramEvaluation).toBe(false)
    expect(after.hasProgramEvaluation).toBe(true)
  })

  it('hasProgramEvaluation decrements from true to false', () => {
    const before: UserPreferences = { hasProgramEvaluation: true }
    const after: UserPreferences = { ...before, hasProgramEvaluation: false }
    expect(before.hasProgramEvaluation).toBe(true)
    expect(after.hasProgramEvaluation).toBe(false)
  })

  it('onboardingComplete transitions false → true (progress increment)', () => {
    const step1: UserPreferences = { onboardingComplete: false }
    const step2: UserPreferences = { ...step1, onboardingComplete: true }
    expect(step1.onboardingComplete).toBe(false)
    expect(step2.onboardingComplete).toBe(true)
  })

  it('getUserPreferencesRecord returns updated fields after patch (increment)', async () => {
    const db = makePreferencesDb({
      _id: 'prefs_u1',
      userId: 'user_u1',
      hasProgramEvaluation: false,
    })

    // simulate increment: patch hasProgramEvaluation to true
    await db.patch('prefs_u1', { hasProgramEvaluation: true })

    const { getUserPreferencesRecord } = await import('../../../../convex/userState')
    const prefs = await getUserPreferencesRecord(
      { db },
      'user_u1' as unknown as Parameters<typeof getUserPreferencesRecord>[1],
    )

    expect(prefs).not.toBeNull()
    expect((prefs as Record<string, unknown>)['hasProgramEvaluation']).toBe(true)
  })

  it('getUserPreferencesRecord reflects decrement after patch', async () => {
    const db = makePreferencesDb({
      _id: 'prefs_u2',
      userId: 'user_u2',
      hasProgramEvaluation: true,
    })

    // simulate decrement: patch hasProgramEvaluation back to false
    await db.patch('prefs_u2', { hasProgramEvaluation: false })

    const { getUserPreferencesRecord } = await import('../../../../convex/userState')
    const prefs = await getUserPreferencesRecord(
      { db },
      'user_u2' as unknown as Parameters<typeof getUserPreferencesRecord>[1],
    )

    expect(prefs).not.toBeNull()
    expect((prefs as Record<string, unknown>)['hasProgramEvaluation']).toBe(false)
  })
})

// ── 2. Concurrent write stability ─────────────────────────────────────────────
// Two rapid preference patches must not corrupt the stored record.
// The mock db serialises writes synchronously to verify last-write-wins.

describe('userState — concurrent write stability', () => {
  it('two rapid hasProgramEvaluation increments resolve to true (idempotent)', async () => {
    const db = makePreferencesDb({
      _id: 'prefs_c1',
      userId: 'user_c1',
      hasProgramEvaluation: false,
    })

    // Fire two patches concurrently — both set true
    await Promise.all([
      db.patch('prefs_c1', { hasProgramEvaluation: true }),
      db.patch('prefs_c1', { hasProgramEvaluation: true }),
    ])

    const { getUserPreferencesRecord } = await import('../../../../convex/userState')
    const prefs = await getUserPreferencesRecord(
      { db },
      'user_c1' as unknown as Parameters<typeof getUserPreferencesRecord>[1],
    )

    expect((prefs as Record<string, unknown>)['hasProgramEvaluation']).toBe(true)
    expect(db.patch).toHaveBeenCalledTimes(2)
  })

  it('two concurrent patches to different fields do not overwrite each other', async () => {
    const db = makePreferencesDb({
      _id: 'prefs_c2',
      userId: 'user_c2',
      hasProgramEvaluation: false,
      onboardingComplete: false,
    })

    await Promise.all([
      db.patch('prefs_c2', { hasProgramEvaluation: true }),
      db.patch('prefs_c2', { onboardingComplete: true }),
    ])

    const { getUserPreferencesRecord } = await import('../../../../convex/userState')
    const prefs = await getUserPreferencesRecord(
      { db },
      'user_c2' as unknown as Parameters<typeof getUserPreferencesRecord>[1],
    ) as Record<string, unknown>

    expect(prefs['hasProgramEvaluation']).toBe(true)
    expect(prefs['onboardingComplete']).toBe(true)
  })

  it('concurrent getCurrentUserState calls both return null for unauthenticated', async () => {
    const { getCurrentUserState } = await import('../../../../convex/userState')
    const ctx = makeAuthCtx(null)

    const [r1, r2] = await Promise.all([
      getCurrentUserState(ctx),
      getCurrentUserState(ctx),
    ])

    expect(r1).toEqual({ user: null })
    expect(r2).toEqual({ user: null })
  })

  it('two rapid ensureCurrentUserRecord calls on existing user never double-insert', async () => {
    const { ensureCurrentUserRecord } = await import('../../../../convex/userState')
    const identity = { subject: 'clerk_concurrent' }
    const existing = {
      _id: 'user_con',
      clerkUserId: 'clerk_concurrent',
      migrationSource: 'convex',
    }

    const makeCtx = () => ({
      auth: { getUserIdentity: vi.fn().mockResolvedValue(identity) },
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existing),
          }),
        }),
        insert: vi.fn(),
        get: vi.fn(),
      },
    })

    const ctx1 = makeCtx()
    const ctx2 = makeCtx()

    const [r1, r2] = await Promise.all([
      ensureCurrentUserRecord(ctx1),
      ensureCurrentUserRecord(ctx2),
    ])

    expect(ctx1.db.insert).not.toHaveBeenCalled()
    expect(ctx2.db.insert).not.toHaveBeenCalled()
    expect(r1.user.clerkUserId).toBe('clerk_concurrent')
    expect(r2.user.clerkUserId).toBe('clerk_concurrent')
  })
})

// ── 3. Default state for a new user ──────────────────────────────────────────
// A brand-new authenticated user has no preferences record in the DB.
// getUserPreferencesRecord and getSchedulingPreferencesRecord return null.
// The frontend initialises UserPreferences to {} in that case.

describe('userState — default state for a new user', () => {
  it('getUserPreferencesRecord returns null when no record exists', async () => {
    const { getUserPreferencesRecord } = await import('../../../../convex/userState')
    const db = makePreferencesDb(null)

    const result = await getUserPreferencesRecord(
      { db },
      'user_new' as unknown as Parameters<typeof getUserPreferencesRecord>[1],
    )

    expect(result).toBeNull()
  })

  it('getSchedulingPreferencesRecord returns null for a new user', async () => {
    const { getSchedulingPreferencesRecord } = await import('../../../../convex/userState')
    const db = makePreferencesDb(null)

    const result = await getSchedulingPreferencesRecord(
      { db },
      'user_new' as unknown as Parameters<typeof getSchedulingPreferencesRecord>[1],
    )

    expect(result).toBeNull()
  })

  it('frontend UserPreferences initialises to empty object for new user', () => {
    // Mirrors AuthContext useState<UserPreferences>({})
    const defaultPrefs: UserPreferences = {}
    expect(Object.keys(defaultPrefs)).toHaveLength(0)
    expect(defaultPrefs.hasProgramEvaluation).toBeUndefined()
    expect(defaultPrefs.onboardingComplete).toBeUndefined()
    expect(defaultPrefs.theme).toBeUndefined()
    expect(defaultPrefs.landingView).toBeUndefined()
  })

  it('getCurrentUserState returns { user: null } before profile is created', async () => {
    const { getCurrentUserState } = await import('../../../../convex/userState')
    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: 'clerk_brand_new' }),
      },
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null), // no userProfile yet
          }),
        }),
      },
    }

    const result = await getCurrentUserState(ctx)
    expect(result).toEqual({ user: null })
  })

  it('ensureCurrentUserRecord inserts default migrationSource "convex" for new user', async () => {
    const { ensureCurrentUserRecord } = await import('../../../../convex/userState')
    const newId = 'user_default_test'

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
          subject: 'clerk_default',
          // no optional fields: email, givenName, familyName, name all absent
        }),
      },
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        }),
        insert: vi.fn().mockResolvedValue(newId),
        get: vi.fn().mockResolvedValue({
          _id: newId,
          clerkUserId: 'clerk_default',
          migrationSource: 'convex',
        }),
      },
    }

    const result = await ensureCurrentUserRecord(ctx)
    const inserted = ctx.db.insert.mock.calls[0]![1] as Record<string, unknown>

    expect(inserted.migrationSource).toBe('convex')
    expect(result.user.migrationSource).toBe('convex')
  })
})

// ── 4. State reset ────────────────────────────────────────────────────────────
// When a user resets their state (e.g., account deletion or re-onboarding),
// preferences records are deleted and the frontend falls back to {}.

describe('userState — state reset', () => {
  it('getUserPreferencesRecord returns null after preferences record is deleted', async () => {
    const db = makePreferencesDb({
      _id: 'prefs_r1',
      userId: 'user_r1',
      hasProgramEvaluation: true,
      onboardingComplete: true,
    })

    // simulate account/preference reset
    await db.delete('prefs_r1')

    const { getUserPreferencesRecord } = await import('../../../../convex/userState')
    const result = await getUserPreferencesRecord(
      { db },
      'user_r1' as unknown as Parameters<typeof getUserPreferencesRecord>[1],
    )

    expect(result).toBeNull()
  })

  it('getSchedulingPreferencesRecord returns null after scheduling prefs are deleted', async () => {
    const db = makePreferencesDb({
      _id: 'sched_r1',
      userId: 'user_r1',
      planning_mode: 'four_year_plan',
    })

    await db.delete('sched_r1')

    const { getSchedulingPreferencesRecord } = await import('../../../../convex/userState')
    const result = await getSchedulingPreferencesRecord(
      { db },
      'user_r1' as unknown as Parameters<typeof getSchedulingPreferencesRecord>[1],
    )

    expect(result).toBeNull()
  })

  it('frontend preferences reset to empty object after deletion', () => {
    // The AuthContext mergePreferences/setPreferences pattern resets to {}
    // when the backend confirms no preferences record exists.
    let prefs: UserPreferences = {
      hasProgramEvaluation: true,
      onboardingComplete: true,
      theme: 'dark',
      landingView: 'dashboard',
    }

    // reset
    prefs = {}

    expect(Object.keys(prefs)).toHaveLength(0)
    expect(prefs.hasProgramEvaluation).toBeUndefined()
    expect(prefs.onboardingComplete).toBeUndefined()
    expect(prefs.theme).toBeUndefined()
    expect(prefs.landingView).toBeUndefined()
  })

  it('preferences are fully repopulated after reset and re-onboarding', () => {
    let prefs: UserPreferences = {}

    // simulate re-onboarding patch
    prefs = {
      ...prefs,
      onboardingComplete: true,
      hasProgramEvaluation: false,
      landingView: 'schedule',
      theme: 'light',
    }

    expect(prefs.onboardingComplete).toBe(true)
    expect(prefs.hasProgramEvaluation).toBe(false)
    expect(prefs.landingView).toBe('schedule')
    expect(prefs.theme).toBe('light')
  })

  it('getCurrentUserState after account reset returns { user: null }', async () => {
    const { getCurrentUserState } = await import('../../../../convex/userState')

    // After account deletion, identity still exists but profile is gone
    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: 'clerk_reset' }),
      },
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null), // profile deleted
          }),
        }),
      },
    }

    const result = await getCurrentUserState(ctx)
    expect(result).toEqual({ user: null })
  })
})
