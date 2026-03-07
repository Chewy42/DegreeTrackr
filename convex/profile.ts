import { actionGeneric, makeFunctionReference, mutationGeneric, queryGeneric } from 'convex/server'
import { v } from 'convex/values'

import {
  onboardingAnswersValidator,
  schedulingPreferencesValidator,
  userPreferencesValidator,
} from './contracts'
import { legacyHydrationArgsValidator, readLegacyJson } from './legacyHydration'
import {
  ensureCurrentUserRecord,
  getCurrentUserState,
  getSchedulingPreferencesRecord,
  getUserPreferencesRecord,
} from './userState'

// ── Internal function references (for action → mutation calls) ─────────────

const syncCurrentUserPreferencesFromLegacyRef = makeFunctionReference<
  'mutation',
  { preferences: Partial<UserPreferences> },
  UserPreferences
>('profile:syncCurrentUserPreferencesFromLegacy')

const syncCurrentSchedulingPreferencesFromLegacyRef = makeFunctionReference<
  'mutation',
  { preferences: SchedulingPreferencesFormValues },
  SchedulingPreferencesFormValues
>('profile:syncCurrentSchedulingPreferencesFromLegacy')

// ── Local type aliases (keep module self-contained) ────────────────────────

type UserPreferences = {
  theme?: 'light' | 'dark'
  landingView?: 'dashboard' | 'schedule' | 'explore'
  hasProgramEvaluation?: boolean
  onboardingComplete?: boolean
}

type SchedulingPreferencesFormValues = {
  planning_mode?: 'upcoming_semester' | 'four_year_plan' | 'view_progress'
  credit_load?: 'light' | 'standard' | 'heavy'
  schedule_preference?: 'mornings' | 'afternoons' | 'flexible'
  work_status?: 'none' | 'part_time' | 'full_time'
  priority?: 'major' | 'electives' | 'graduate'
}

type OnboardingCompletionResult = {
  userPreferences: UserPreferences
  schedulingPreferences: SchedulingPreferencesFormValues | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toUserPreferences(record: any): UserPreferences {
  return {
    ...(record.theme !== undefined ? { theme: record.theme } : {}),
    ...(record.landingView !== undefined ? { landingView: record.landingView } : {}),
    ...(record.hasProgramEvaluation !== undefined ? { hasProgramEvaluation: record.hasProgramEvaluation } : {}),
    ...(record.onboardingComplete !== undefined ? { onboardingComplete: record.onboardingComplete } : {}),
  }
}

function toSchedulingPreferences(record: any): SchedulingPreferencesFormValues {
  return {
    ...(record.planning_mode !== undefined ? { planning_mode: record.planning_mode } : {}),
    ...(record.credit_load !== undefined ? { credit_load: record.credit_load } : {}),
    ...(record.schedule_preference !== undefined ? { schedule_preference: record.schedule_preference } : {}),
    ...(record.work_status !== undefined ? { work_status: record.work_status } : {}),
    ...(record.priority !== undefined ? { priority: record.priority } : {}),
  }
}

// ── User profile ───────────────────────────────────────────────────────────

export const getCurrentUserProfile = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const { user } = await getCurrentUserState(ctx)
    if (!user) {
      return null
    }
    return {
      id: user._id as string,
      clerkUserId: user.clerkUserId as string,
      primaryEmail: (user.primaryEmail ?? null) as string | null,
      firstName: (user.firstName ?? null) as string | null,
      lastName: (user.lastName ?? null) as string | null,
      displayName: (user.displayName ?? null) as string | null,
    }
  },
})

export const updateCurrentUserProfile = mutationGeneric({
  args: {
    patch: v.object({
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      displayName: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureCurrentUserRecord(ctx)
    await ctx.db.patch(user._id, args.patch)
    const updated = await ctx.db.get(user._id)
    return {
      id: updated._id as string,
      clerkUserId: updated.clerkUserId as string,
      primaryEmail: (updated.primaryEmail ?? null) as string | null,
      firstName: (updated.firstName ?? null) as string | null,
      lastName: (updated.lastName ?? null) as string | null,
      displayName: (updated.displayName ?? null) as string | null,
    }
  },
})

// ── User preferences ───────────────────────────────────────────────────────

export const getCurrentUserPreferences = queryGeneric({
  args: {},
  handler: async (ctx): Promise<UserPreferences | null> => {
    const { user } = await getCurrentUserState(ctx)
    if (!user) {
      return null
    }
    const record = await getUserPreferencesRecord(ctx, user._id)
    if (!record) {
      return null
    }
    return toUserPreferences(record)
  },
})

export const updateCurrentUserPreferences = mutationGeneric({
  args: { patch: userPreferencesValidator },
  handler: async (ctx, args): Promise<UserPreferences> => {
    const { user } = await ensureCurrentUserRecord(ctx)
    const existing = await getUserPreferencesRecord(ctx, user._id)
    if (existing) {
      await ctx.db.patch(existing._id, args.patch)
      const updated = await ctx.db.get(existing._id)
      return toUserPreferences(updated)
    }
    const newId = await ctx.db.insert('userPreferences', { userId: user._id, ...args.patch })
    const record = await ctx.db.get(newId)
    return toUserPreferences(record)
  },
})

export const syncCurrentUserPreferencesFromLegacy = mutationGeneric({
  args: { preferences: userPreferencesValidator },
  handler: async (ctx, args): Promise<UserPreferences> => {
    const { user } = await ensureCurrentUserRecord(ctx)
    const existing = await getUserPreferencesRecord(ctx, user._id)
    if (existing) {
      await ctx.db.patch(existing._id, args.preferences)
      const updated = await ctx.db.get(existing._id)
      return toUserPreferences(updated)
    }
    const newId = await ctx.db.insert('userPreferences', { userId: user._id, ...args.preferences })
    const record = await ctx.db.get(newId)
    return toUserPreferences(record)
  },
})

export const hydrateCurrentUserPreferencesFromLegacy = actionGeneric({
  args: legacyHydrationArgsValidator,
  handler: async (ctx, args): Promise<UserPreferences> => {
    const data = await readLegacyJson<UserPreferences>('/auth/preferences', args)
    return ctx.runMutation(syncCurrentUserPreferencesFromLegacyRef, {
      preferences: data ?? {},
    })
  },
})

// ── Scheduling preferences ─────────────────────────────────────────────────

export const getCurrentSchedulingPreferences = queryGeneric({
  args: {},
  handler: async (ctx): Promise<SchedulingPreferencesFormValues | null> => {
    const { user } = await getCurrentUserState(ctx)
    if (!user) {
      return null
    }
    const record = await getSchedulingPreferencesRecord(ctx, user._id)
    if (!record) {
      return null
    }
    return toSchedulingPreferences(record)
  },
})

export const updateCurrentSchedulingPreferences = mutationGeneric({
  args: { patch: schedulingPreferencesValidator },
  handler: async (ctx, args): Promise<SchedulingPreferencesFormValues> => {
    const { user } = await ensureCurrentUserRecord(ctx)
    const existing = await getSchedulingPreferencesRecord(ctx, user._id)
    if (existing) {
      await ctx.db.patch(existing._id, args.patch)
      const updated = await ctx.db.get(existing._id)
      return toSchedulingPreferences(updated)
    }
    const newId = await ctx.db.insert('schedulingPreferences', { userId: user._id, ...args.patch })
    const record = await ctx.db.get(newId)
    return toSchedulingPreferences(record)
  },
})

export const syncCurrentSchedulingPreferencesFromLegacy = mutationGeneric({
  args: { preferences: schedulingPreferencesValidator },
  handler: async (ctx, args): Promise<SchedulingPreferencesFormValues> => {
    const { user } = await ensureCurrentUserRecord(ctx)
    const existing = await getSchedulingPreferencesRecord(ctx, user._id)
    if (existing) {
      await ctx.db.patch(existing._id, args.preferences)
      const updated = await ctx.db.get(existing._id)
      return toSchedulingPreferences(updated)
    }
    const newId = await ctx.db.insert('schedulingPreferences', { userId: user._id, ...args.preferences })
    const record = await ctx.db.get(newId)
    return toSchedulingPreferences(record)
  },
})

export const hydrateCurrentSchedulingPreferencesFromLegacy = actionGeneric({
  args: legacyHydrationArgsValidator,
  handler: async (ctx, args): Promise<SchedulingPreferencesFormValues> => {
    const data = await readLegacyJson<SchedulingPreferencesFormValues>('/auth/scheduling-preferences', args)
    return ctx.runMutation(syncCurrentSchedulingPreferencesFromLegacyRef, {
      preferences: data ?? {},
    })
  },
})

// ── Onboarding completion ──────────────────────────────────────────────────

export const completeCurrentOnboarding = mutationGeneric({
  args: { answers: onboardingAnswersValidator },
  handler: async (ctx, args): Promise<OnboardingCompletionResult> => {
    const { user } = await ensureCurrentUserRecord(ctx)

    // Mark onboarding complete in preferences
    const existing = await getUserPreferencesRecord(ctx, user._id)
    if (existing) {
      await ctx.db.patch(existing._id, { onboardingComplete: true })
    } else {
      await ctx.db.insert('userPreferences', { userId: user._id, onboardingComplete: true })
    }

    // Persist scheduling preferences from the onboarding answers
    const existingSched = await getSchedulingPreferencesRecord(ctx, user._id)
    if (existingSched) {
      await ctx.db.patch(existingSched._id, args.answers)
    } else {
      await ctx.db.insert('schedulingPreferences', { userId: user._id, ...args.answers })
    }

    const updatedPrefs = await getUserPreferencesRecord(ctx, user._id)
    const updatedSched = await getSchedulingPreferencesRecord(ctx, user._id)

    return {
      userPreferences: toUserPreferences(updatedPrefs),
      schedulingPreferences: updatedSched ? toSchedulingPreferences(updatedSched) : null,
    }
  },
})
