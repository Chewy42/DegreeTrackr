import { mutationGeneric, queryGeneric } from 'convex/server'
import { v } from 'convex/values'

// ── Local type aliases ─────────────────────────────────────────────────────

type ScheduleSnapshotResult = {
  id: string
  userId: string
  name: string
  classIds: string[]
  totalCredits: number
  classCount: number
  createdAt: number
  migrationSource: 'convex'
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function requireIdentity(ctx: any): Promise<any> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthenticated — no user identity available.')
  }
  return identity
}

function toResult(record: any): ScheduleSnapshotResult {
  return {
    id: record._id as string,
    userId: record.userId as string,
    name: record.name as string,
    classIds: record.classIds as string[],
    totalCredits: record.totalCredits as number,
    classCount: (record.classIds as string[]).length,
    createdAt: record.createdAt as number,
    migrationSource: 'convex',
  }
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * List all schedule snapshots for the current user, newest first.
 */
export const listCurrentScheduleSnapshots = queryGeneric({
  args: {},
  handler: async (ctx): Promise<ScheduleSnapshotResult[]> => {
    const identity = await requireIdentity(ctx)
    const records = await ctx.db
      .query('scheduleSnapshots')
      .withIndex('by_userId', (q: any) => q.eq('userId', identity.subject))
      .collect()
    records.sort((a: any, b: any) => b.createdAt - a.createdAt)
    return records.map(toResult)
  },
})

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new schedule snapshot for the current user.
 */
export const createCurrentScheduleSnapshot = mutationGeneric({
  args: {
    name: v.string(),
    classIds: v.array(v.string()),
    totalCredits: v.number(),
  },
  handler: async (ctx, args): Promise<ScheduleSnapshotResult> => {
    const identity = await requireIdentity(ctx)
    const newId = await ctx.db.insert('scheduleSnapshots', {
      userId: identity.subject,
      name: args.name,
      classIds: args.classIds,
      totalCredits: args.totalCredits,
      createdAt: Date.now(),
      migrationSource: 'convex' as const,
    })
    const record = await ctx.db.get(newId)
    return toResult(record)
  },
})

/**
 * Delete a schedule snapshot by ID. Verifies ownership before deleting.
 */
export const deleteCurrentScheduleSnapshot = mutationGeneric({
  args: { id: v.id('scheduleSnapshots') },
  handler: async (ctx, args): Promise<void> => {
    const identity = await requireIdentity(ctx)
    const record = await ctx.db.get(args.id)
    if (!record) {
      // Already deleted — treat as success
      return
    }
    if (record.userId !== identity.subject) {
      throw new Error('Unauthorized — snapshot does not belong to the current user.')
    }
    await ctx.db.delete(args.id)
  },
})
