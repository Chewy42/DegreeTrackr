import { v } from 'convex/values'

export const migrationSourceValidator = v.union(v.literal('legacy-flask'), v.literal('convex'))

export const chatScopeValidator = v.union(
  v.literal('onboarding'),
  v.literal('explore'),
  v.literal('general'),
)

export const onboardingAnswersValidator = v.object({
  planning_mode: v.optional(
    v.union(v.literal('upcoming_semester'), v.literal('four_year_plan'), v.literal('view_progress')),
  ),
  credit_load: v.optional(v.union(v.literal('light'), v.literal('standard'), v.literal('heavy'))),
  schedule_preference: v.optional(v.union(v.literal('mornings'), v.literal('afternoons'), v.literal('flexible'))),
  work_status: v.optional(v.union(v.literal('none'), v.literal('part_time'), v.literal('full_time'))),
  priority: v.optional(v.union(v.literal('major'), v.literal('electives'), v.literal('graduate'))),
})

export const userPreferencesValidator = v.object({
  theme: v.optional(v.union(v.literal('light'), v.literal('dark'))),
  landingView: v.optional(v.union(v.literal('dashboard'), v.literal('schedule'), v.literal('explore'))),
  hasProgramEvaluation: v.optional(v.boolean()),
  onboardingComplete: v.optional(v.boolean()),
})

export const schedulingPreferencesValidator = v.object({
  planning_mode: v.optional(
    v.union(v.literal('upcoming_semester'), v.literal('four_year_plan'), v.literal('view_progress')),
  ),
  credit_load: v.optional(v.union(v.literal('light'), v.literal('standard'), v.literal('heavy'))),
  schedule_preference: v.optional(v.union(v.literal('mornings'), v.literal('afternoons'), v.literal('flexible'))),
  work_status: v.optional(v.union(v.literal('none'), v.literal('part_time'), v.literal('full_time'))),
  priority: v.optional(v.union(v.literal('major'), v.literal('electives'), v.literal('graduate'))),
})
