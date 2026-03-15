import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const migrationSource = v.union(v.literal('legacy-flask'), v.literal('convex'))

const onboardingAnswers = v.object({
  planning_mode: v.optional(
    v.union(v.literal('upcoming_semester'), v.literal('four_year_plan'), v.literal('view_progress')),
  ),
  credit_load: v.optional(v.union(v.literal('light'), v.literal('standard'), v.literal('heavy'))),
  schedule_preference: v.optional(v.union(v.literal('mornings'), v.literal('afternoons'), v.literal('flexible'))),
  work_status: v.optional(v.union(v.literal('none'), v.literal('part_time'), v.literal('full_time'))),
  priority: v.optional(v.union(v.literal('major'), v.literal('electives'), v.literal('graduate'))),
})

export default defineSchema({
  // ── User identity ──────────────────────────────────────────────────────────
  userProfiles: defineTable({
    clerkUserId: v.string(),
    primaryEmail: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    migrationSource,
  }).index('by_clerkUserId', ['clerkUserId']),

  // ── App preferences ────────────────────────────────────────────────────────
  userPreferences: defineTable({
    userId: v.id('userProfiles'),
    theme: v.optional(v.union(v.literal('light'), v.literal('dark'))),
    landingView: v.optional(v.union(v.literal('dashboard'), v.literal('schedule'), v.literal('explore'))),
    hasProgramEvaluation: v.optional(v.boolean()),
    onboardingComplete: v.optional(v.boolean()),
  }).index('by_userId', ['userId']),

  // ── Scheduling preferences ─────────────────────────────────────────────────
  schedulingPreferences: defineTable({
    userId: v.id('userProfiles'),
    planning_mode: v.optional(
      v.union(v.literal('upcoming_semester'), v.literal('four_year_plan'), v.literal('view_progress')),
    ),
    credit_load: v.optional(v.union(v.literal('light'), v.literal('standard'), v.literal('heavy'))),
    schedule_preference: v.optional(v.union(v.literal('mornings'), v.literal('afternoons'), v.literal('flexible'))),
    work_status: v.optional(v.union(v.literal('none'), v.literal('part_time'), v.literal('full_time'))),
    priority: v.optional(v.union(v.literal('major'), v.literal('electives'), v.literal('graduate'))),
  }).index('by_userId', ['userId']),

  // ── Chat sessions ──────────────────────────────────────────────────────────
  chatSessions: defineTable({
    userId: v.id('userProfiles'),
    scope: v.union(v.literal('onboarding'), v.literal('explore'), v.literal('general')),
    title: v.string(),
    legacySessionId: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    migrationSource,
    archivedAt: v.optional(v.number()),
    onboardingAnswers: v.optional(onboardingAnswers),
    onboardingStep: v.optional(v.number()),
  })
    .index('by_userId_and_scope', ['userId', 'scope'])
    .index('by_userId', ['userId'])
    .index('by_lastMessageAt', ['lastMessageAt']),

  // ── Chat messages ──────────────────────────────────────────────────────────
  chatMessages: defineTable({
    sessionId: v.id('chatSessions'),
    sender: v.union(v.literal('user'), v.literal('assistant'), v.literal('system')),
    content: v.string(),
    createdAt: v.number(),
  }).index('by_sessionId_and_createdAt', ['sessionId', 'createdAt']),

  // ── Schedule snapshots ─────────────────────────────────────────────────────
  scheduleSnapshots: defineTable({
    userId: v.string(), // Clerk user ID (identity.subject)
    name: v.string(),
    classIds: v.array(v.string()),
    totalCredits: v.number(),
    createdAt: v.number(), // epoch ms
    migrationSource,
  })
    .index('by_userId', ['userId'])
    .index('by_createdAt', ['createdAt']),

  // ── Schedule drafts (auto-saved current schedule) ──────────────────────────
  scheduleDrafts: defineTable({
    userId: v.string(), // Clerk user ID (identity.subject)
    classIds: v.array(v.string()),
    updatedAt: v.number(), // epoch ms
  }).index('by_userId', ['userId']),

  // ── Program evaluations ────────────────────────────────────────────────────
  programEvaluations: defineTable({
    userId: v.id('userProfiles'),
    email: v.optional(v.string()),
    uploadedAt: v.optional(v.number()),
    originalFilename: v.optional(v.string()),
    parsedData: v.optional(v.any()),
    storagePath: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    migrationSource,
  }).index('by_userId', ['userId']),
})
