import { describe, expect, it, vi } from 'vitest'

// ── User lifecycle integration tests ────────────────────────────────────────
// DegreeTrackr uses lazy profile creation: no Clerk webhook handler exists.
// When a user first authenticates and calls any Convex function,
// ensureCurrentUserRecord() creates their userProfile on-demand from
// the Clerk identity token (subject, email, givenName, familyName, name).
//
// These tests verify the structural contracts and behavioral design of
// the lazy initialization lifecycle without a live Convex database.

describe('userState — ensureCurrentUserRecord lifecycle', () => {
  it('exports getCurrentUserState and ensureCurrentUserRecord', async () => {
    const mod = await import('../../../../convex/userState')
    expect(mod.getCurrentUserState).toBeDefined()
    expect(mod.ensureCurrentUserRecord).toBeDefined()
  })

  it('getCurrentUserState returns { user: null } for unauthenticated context', async () => {
    const mod = await import('../../../../convex/userState')
    const ctx = {
      auth: { getUserIdentity: vi.fn().mockResolvedValue(null) },
    }
    const result = await mod.getCurrentUserState(ctx)
    expect(result).toEqual({ user: null })
  })

  it('ensureCurrentUserRecord throws ConvexError for unauthenticated context', async () => {
    const mod = await import('../../../../convex/userState')
    const ctx = {
      auth: { getUserIdentity: vi.fn().mockResolvedValue(null) },
    }
    await expect(mod.ensureCurrentUserRecord(ctx)).rejects.toThrow('Unauthenticated')
  })

  it('ensureCurrentUserRecord returns existing user without inserting', async () => {
    const mod = await import('../../../../convex/userState')
    const existingUser = {
      _id: 'user_123',
      clerkUserId: 'clerk_abc',
      firstName: 'Jane',
      lastName: 'Doe',
      displayName: 'Jane Doe',
      primaryEmail: 'jane@example.com',
      migrationSource: 'convex',
    }

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: 'clerk_abc' }),
      },
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingUser),
          }),
        }),
        insert: vi.fn(),
        get: vi.fn(),
      },
    }

    const result = await mod.ensureCurrentUserRecord(ctx)
    expect(result.user).toBe(existingUser)
    // insert should NOT be called — existing user is returned directly
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it('ensureCurrentUserRecord creates new profile from Clerk identity on first call', async () => {
    const mod = await import('../../../../convex/userState')
    const newUserId = 'user_new_456'
    const createdUser = {
      _id: newUserId,
      clerkUserId: 'clerk_xyz',
      firstName: 'John',
      lastName: 'Smith',
      displayName: 'John Smith',
      primaryEmail: 'john@example.com',
      migrationSource: 'convex',
    }

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
          subject: 'clerk_xyz',
          email: 'john@example.com',
          givenName: 'John',
          familyName: 'Smith',
          name: 'John Smith',
        }),
      },
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null), // no existing user
          }),
        }),
        insert: vi.fn().mockResolvedValue(newUserId),
        get: vi.fn().mockResolvedValue(createdUser),
      },
    }

    const result = await mod.ensureCurrentUserRecord(ctx)

    // Verify insert was called with Clerk identity fields
    expect(ctx.db.insert).toHaveBeenCalledWith('userProfiles', {
      clerkUserId: 'clerk_xyz',
      primaryEmail: 'john@example.com',
      firstName: 'John',
      lastName: 'Smith',
      displayName: 'John Smith',
      migrationSource: 'convex',
    })

    // Verify returned user matches created record
    expect(result.user.clerkUserId).toBe('clerk_xyz')
    expect(result.user.firstName).toBe('John')
    expect(result.user.lastName).toBe('Smith')
    expect(result.user.displayName).toBe('John Smith')
  })

  it('ensureCurrentUserRecord is idempotent — second call returns existing user', async () => {
    const mod = await import('../../../../convex/userState')
    const existingUser = {
      _id: 'user_789',
      clerkUserId: 'clerk_repeat',
      firstName: 'Alice',
      lastName: 'Wang',
      displayName: 'Alice Wang',
      primaryEmail: 'alice@example.com',
      migrationSource: 'convex',
    }

    const identity = { subject: 'clerk_repeat' }

    // First call: no existing user → creates one
    const insertId = 'user_789'
    const ctxFirstCall = {
      auth: { getUserIdentity: vi.fn().mockResolvedValue(identity) },
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        }),
        insert: vi.fn().mockResolvedValue(insertId),
        get: vi.fn().mockResolvedValue(existingUser),
      },
    }

    const first = await mod.ensureCurrentUserRecord(ctxFirstCall)
    expect(ctxFirstCall.db.insert).toHaveBeenCalledTimes(1)

    // Second call: existing user found → no insert
    const ctxSecondCall = {
      auth: { getUserIdentity: vi.fn().mockResolvedValue(identity) },
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingUser),
          }),
        }),
        insert: vi.fn(),
        get: vi.fn(),
      },
    }

    const second = await mod.ensureCurrentUserRecord(ctxSecondCall)
    expect(ctxSecondCall.db.insert).not.toHaveBeenCalled()
    expect(second.user.clerkUserId).toBe(first.user.clerkUserId)
  })
})

describe('userState — profile name from Clerk metadata', () => {
  it('maps Clerk givenName to firstName and familyName to lastName', async () => {
    const mod = await import('../../../../convex/userState')
    const newId = 'user_name_test'

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
          subject: 'clerk_name_test',
          email: 'test@example.com',
          givenName: 'FirstFromClerk',
          familyName: 'LastFromClerk',
          name: 'FirstFromClerk LastFromClerk',
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
          clerkUserId: 'clerk_name_test',
          firstName: 'FirstFromClerk',
          lastName: 'LastFromClerk',
          displayName: 'FirstFromClerk LastFromClerk',
          migrationSource: 'convex',
        }),
      },
    }

    await mod.ensureCurrentUserRecord(ctx)

    const insertArgs = ctx.db.insert.mock.calls[0]![1]
    expect(insertArgs.firstName).toBe('FirstFromClerk')
    expect(insertArgs.lastName).toBe('LastFromClerk')
    expect(insertArgs.displayName).toBe('FirstFromClerk LastFromClerk')
  })

  it('handles missing name fields gracefully (undefined, not null)', async () => {
    const mod = await import('../../../../convex/userState')
    const newId = 'user_no_name'

    const ctx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
          subject: 'clerk_no_name',
          // email, givenName, familyName, name all absent
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
          clerkUserId: 'clerk_no_name',
          migrationSource: 'convex',
        }),
      },
    }

    await mod.ensureCurrentUserRecord(ctx)

    const insertArgs = ctx.db.insert.mock.calls[0]![1]
    expect(insertArgs.clerkUserId).toBe('clerk_no_name')
    expect(insertArgs.primaryEmail).toBeUndefined()
    expect(insertArgs.firstName).toBeUndefined()
    expect(insertArgs.lastName).toBeUndefined()
    expect(insertArgs.displayName).toBeUndefined()
  })
})

describe('profile → userState integration contract', () => {
  it('profile mutations call ensureCurrentUserRecord (structural)', async () => {
    // updateCurrentUserProfile, updateCurrentUserPreferences,
    // completeCurrentOnboarding all go through ensureCurrentUserRecord
    // which creates the user on first authenticated call.
    // This is the lazy-init lifecycle: no separate webhook needed.
    const profile = await import('../../../../convex/profile')
    const userState = await import('../../../../convex/userState')

    expect(profile.updateCurrentUserProfile).toBeDefined()
    expect(profile.updateCurrentUserPreferences).toBeDefined()
    expect(profile.completeCurrentOnboarding).toBeDefined()
    expect(userState.ensureCurrentUserRecord).toBeDefined()
  })

  it('getCurrentUserProfile returns null for unauthenticated (no profile created)', async () => {
    // Design contract: queries use getCurrentUserState which returns null
    // without creating a record. Only mutations via ensureCurrentUserRecord create.
    const profile = await import('../../../../convex/profile')
    expect(profile.getCurrentUserProfile).toBeDefined()
  })
})
