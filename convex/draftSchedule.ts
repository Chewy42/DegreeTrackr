import { mutationGeneric, queryGeneric } from 'convex/server'
import { v } from 'convex/values'

type DraftScheduleResult = {
  classIds: string[]
  updatedAt: number
}

async function requireIdentity(ctx: any): Promise<any> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthenticated — no user identity available.')
  }
  return identity
}

/**
 * Returns the user's current draft schedule, or null if none exists.
 */
export const getDraftSchedule = queryGeneric({
  args: {},
  handler: async (ctx): Promise<DraftScheduleResult | null> => {
    const identity = await requireIdentity(ctx)
    const record = await ctx.db
      .query('scheduleDrafts')
      .withIndex('by_userId', (q: any) => q.eq('userId', identity.subject))
      .first()
    if (!record) return null
    return { classIds: record.classIds as string[], updatedAt: record.updatedAt as number }
  },
})

/**
 * Upserts the user's current draft schedule classIds.
 */
export const saveDraftSchedule = mutationGeneric({
  args: { classIds: v.array(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('scheduleDrafts')
      .withIndex('by_userId', (q: any) => q.eq('userId', identity.subject))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { classIds: args.classIds, updatedAt: Date.now() })
    } else {
      await ctx.db.insert('scheduleDrafts', {
        userId: identity.subject,
        classIds: args.classIds,
        updatedAt: Date.now(),
      })
    }
  },
})
