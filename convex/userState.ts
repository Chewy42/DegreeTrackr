// User state resolution helpers used across Convex modules.
// All ctx parameters are typed as `any` to remain compatible with both
// queryGeneric / mutationGeneric / actionGeneric contexts.

export async function getCurrentUserState(ctx: any): Promise<{ user: any | null }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    return { user: null }
  }

  const user = await ctx.db
    .query('userProfiles')
    .withIndex('by_clerkUserId', (q: any) => q.eq('clerkUserId', identity.subject))
    .first()

  return { user: user ?? null }
}

export async function ensureCurrentUserRecord(ctx: any): Promise<{ user: any }> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthenticated — no user identity available.')
  }

  const existing = await ctx.db
    .query('userProfiles')
    .withIndex('by_clerkUserId', (q: any) => q.eq('clerkUserId', identity.subject))
    .first()

  if (existing) {
    return { user: existing }
  }

  const newId = await ctx.db.insert('userProfiles', {
    clerkUserId: identity.subject,
    primaryEmail: identity.email ?? undefined,
    firstName: identity.givenName ?? undefined,
    lastName: identity.familyName ?? undefined,
    displayName: identity.name ?? undefined,
    migrationSource: 'convex' as const,
  })

  const user = await ctx.db.get(newId)
  if (!user) {
    throw new Error('Failed to create user profile record.')
  }

  return { user }
}

export async function getUserPreferencesRecord(ctx: any, userId: any): Promise<any | null> {
  return ctx.db
    .query('userPreferences')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .first()
}

export async function getSchedulingPreferencesRecord(ctx: any, userId: any): Promise<any | null> {
  return ctx.db
    .query('schedulingPreferences')
    .withIndex('by_userId', (q: any) => q.eq('userId', userId))
    .first()
}
