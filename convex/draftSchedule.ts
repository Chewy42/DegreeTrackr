import { mutationGeneric, queryGeneric } from 'convex/server'
import { ConvexError, v } from 'convex/values'

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

// ── Conflict detection helpers ──────────────────────────────────────────────

const timeSlotValidator = v.object({
  startTime: v.number(),
  endTime: v.number(),
})

const classOccurrenceValidator = v.object({
  classId: v.string(),
  code: v.string(),
  days: v.object({
    M: v.array(timeSlotValidator),
    Tu: v.array(timeSlotValidator),
    W: v.array(timeSlotValidator),
    Th: v.array(timeSlotValidator),
    F: v.array(timeSlotValidator),
    Sa: v.array(timeSlotValidator),
    Su: v.array(timeSlotValidator),
  }),
})

type ClassOccurrence = {
  classId: string
  code: string
  days: Record<string, Array<{ startTime: number; endTime: number }>>
}

function detectFirstConflict(
  occurrences: ClassOccurrence[],
): { code1: string; code2: string } | null {
  const dayKeys = ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'] as const
  for (let i = 0; i < occurrences.length; i++) {
    for (let j = i + 1; j < occurrences.length; j++) {
      const a = occurrences[i]!
      const b = occurrences[j]!
      for (const day of dayKeys) {
        const slotsA = a.days[day] ?? []
        const slotsB = b.days[day] ?? []
        for (const sa of slotsA) {
          for (const sb of slotsB) {
            if (sa.startTime < sb.endTime && sa.endTime > sb.startTime) {
              return { code1: a.code, code2: b.code }
            }
          }
        }
      }
    }
  }
  return null
}

// ── Queries ─────────────────────────────────────────────────────────────────

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

// ── Mutations ───────────────────────────────────────────────────────────────

/**
 * Upserts the user's current draft schedule classIds.
 *
 * When `classOccurrences` is provided, the mutation validates that no two
 * classes overlap in day+time range before saving. This is an opt-in
 * server-side safety net — the frontend also validates conflicts locally.
 */
export const saveDraftSchedule = mutationGeneric({
  args: {
    classIds: v.array(v.string()),
    classOccurrences: v.optional(v.array(classOccurrenceValidator)),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await requireIdentity(ctx)

    // Server-side conflict detection when occurrence data is provided
    if (args.classOccurrences && args.classOccurrences.length > 1) {
      const conflict = detectFirstConflict(args.classOccurrences as ClassOccurrence[])
      if (conflict) {
        throw new ConvexError(
          `Time slot conflict: ${conflict.code1} and ${conflict.code2} overlap`,
        )
      }
    }

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
