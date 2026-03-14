import { actionGeneric, makeFunctionReference, mutationGeneric, queryGeneric } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import { chatScopeValidator } from './contracts'
import { legacyHydrationArgsValidator, readLegacyJson, requestLegacyJson } from './legacyHydration'
import { ensureCurrentUserRecord, getCurrentUserState, getUserPreferencesRecord } from './userState'

const onboardingAnswersValidator = v.object({
  planning_mode: v.optional(v.union(v.literal('upcoming_semester'), v.literal('four_year_plan'), v.literal('view_progress'))),
  credit_load: v.optional(v.union(v.literal('light'), v.literal('standard'), v.literal('heavy'))),
  schedule_preference: v.optional(v.union(v.literal('mornings'), v.literal('afternoons'), v.literal('flexible'))),
  work_status: v.optional(v.union(v.literal('none'), v.literal('part_time'), v.literal('full_time'))),
  priority: v.optional(v.union(v.literal('major'), v.literal('electives'), v.literal('graduate'))),
})

const getCurrentChatSessionRef = makeFunctionReference<'query', { sessionId: string }, ChatSessionDetail | null>('chat:getCurrentChatSession')
const syncCurrentChatSessionFromLegacyRef = makeFunctionReference<
  'mutation',
  {
    scope: 'explore' | 'onboarding' | 'general'
    title: string
    legacySessionId: string
    messages: LegacyChatMessage[]
    existingSessionId?: string
  },
  ChatSessionDetail
>('chat:syncCurrentChatSessionFromLegacy')

type ChatSessionSummary = {
  id: string
  scope: 'explore' | 'onboarding' | 'general'
  title: string
  createdAt: number
  lastMessageAt: number | null
  legacySessionId?: string
}

type ChatMessagePayload = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

type ChatSessionDetail = {
  session: ChatSessionSummary
  messages: ChatMessagePayload[]
}

type LegacyChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type LegacyChatResponse = {
  session_id: string
  messages?: LegacyChatMessage[]
  suggestions?: string[]
}

type LegacyChatSession = {
  id: string
  title: string
  created_at?: string
}

const DEFAULT_ONBOARDING_FLOW_STATE = {
  sessionId: null,
  answers: {},
  currentQuestionIndex: 0,
  isComplete: false,
} as const

function buildChatSessionSummary(session: any): ChatSessionSummary {
  return {
    id: session._id,
    scope: session.scope,
    title: session.title,
    createdAt: session._creationTime,
    lastMessageAt: session.lastMessageAt ?? null,
    ...(session.legacySessionId ? { legacySessionId: session.legacySessionId } : {}),
  }
}

function buildChatMessagePayload(message: any): ChatMessagePayload {
  return {
    id: message._id,
    role: message.sender,
    content: message.content,
    createdAt: message.createdAt,
  }
}

async function listSessionMessages(ctx: any, sessionId: any) {
  return ctx.db
    .query('chatMessages')
    .withIndex('by_sessionId_and_createdAt', (query: any) => query.eq('sessionId', sessionId))
    .collect()
}

async function deleteSessionMessages(ctx: any, sessionId: any) {
  const messages = await listSessionMessages(ctx, sessionId)
  for (const message of messages) {
    await ctx.db.delete(message._id)
  }
}

async function getOwnedSession(ctx: any, userId: any, sessionId: string) {
  const session = await ctx.db.get(sessionId as any)
  if (!session || session.userId !== userId || session.archivedAt) {
    return null
  }
  return session
}

async function findScopedSessionByLegacyId(ctx: any, userId: any, scope: 'explore' | 'onboarding' | 'general', legacySessionId: string) {
  const sessions = await ctx.db
    .query('chatSessions')
    .withIndex('by_userId_and_scope', (query: any) => query.eq('userId', userId).eq('scope', scope))
    .collect()

  return sessions.find((session: any) => !session.archivedAt && session.legacySessionId === legacySessionId) ?? null
}

async function findCurrentOnboardingSession(ctx: any, userId: any) {
  const sessions = await ctx.db
    .query('chatSessions')
    .withIndex('by_userId_and_scope', (query: any) => query.eq('userId', userId).eq('scope', 'onboarding'))
    .collect()

  return sessions
    .filter((session: any) => !session.archivedAt)
    .sort((left: any, right: any) => (right.lastMessageAt ?? right._creationTime) - (left.lastMessageAt ?? left._creationTime))[0] ?? null
}

function toLegacyScope(title: string): 'explore' | 'onboarding' | 'general' {
  if (title === 'Onboarding') {
    return 'onboarding'
  }
  if (title === 'Explore My Options') {
    return 'explore'
  }
  return 'general'
}

export const listCurrentChatSessions = queryGeneric({
  args: { scope: chatScopeValidator },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserState(ctx)
    if (!user) {
      return []
    }

    const sessions = await ctx.db
      .query('chatSessions')
      .withIndex('by_userId_and_scope', (query: any) => query.eq('userId', user._id).eq('scope', args.scope))
      .collect()

    return sessions
      .filter((session: any) => !session.archivedAt)
      .sort((left: any, right: any) => (right.lastMessageAt ?? right._creationTime) - (left.lastMessageAt ?? left._creationTime))
      .map(buildChatSessionSummary)
  },
})

export const getCurrentChatSession = queryGeneric({
  args: { sessionId: v.id('chatSessions') },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserState(ctx)
    if (!user) {
      return null
    }

    const session = await getOwnedSession(ctx, user._id, args.sessionId)
    if (!session) {
      return null
    }

    const messages = await listSessionMessages(ctx, session._id)
    return {
      session: buildChatSessionSummary(session),
      messages: messages.map(buildChatMessagePayload),
    }
  },
})

export const getCurrentOnboardingFlowState = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const { user } = await getCurrentUserState(ctx)
    if (!user) {
      return DEFAULT_ONBOARDING_FLOW_STATE
    }

    const session = await findCurrentOnboardingSession(ctx, user._id)
    const preferences = await getUserPreferencesRecord(ctx, user._id)

    return {
      sessionId: session?._id ?? null,
      answers: session?.onboardingAnswers ?? {},
      currentQuestionIndex: session?.onboardingStep ?? 0,
      isComplete: preferences?.onboardingComplete ?? false,
    }
  },
})

// RATE LIMIT: syncCurrentChatSessionFromLegacy should be rate-limited per user once
// native Convex rate limiting is wired in (high write volume during migration).
export const syncCurrentChatSessionFromLegacy = mutationGeneric({
  args: {
    scope: chatScopeValidator,
    title: v.string(),
    legacySessionId: v.string(),
    existingSessionId: v.optional(v.id('chatSessions')),
    messages: v.array(
      v.object({
        role: v.union(v.literal('user'), v.literal('assistant'), v.literal('system')),
        content: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureCurrentUserRecord(ctx)
    if (!args.title.trim()) {
      throw new ConvexError('Session title must not be empty.')
    }
    if (!args.legacySessionId.trim()) {
      throw new ConvexError('Legacy session ID must not be empty.')
    }
    if (args.messages.length > 500) {
      throw new ConvexError('Message batch too large — maximum 500 messages per sync.')
    }
    for (const msg of args.messages) {
      if (msg.content.length > 50_000) {
        throw new ConvexError('Individual message content exceeds 50,000 character limit.')
      }
    }
    const now = Date.now()
    const requestedSession = args.existingSessionId
      ? await getOwnedSession(ctx, user._id, args.existingSessionId)
      : null
    const legacySession = await findScopedSessionByLegacyId(ctx, user._id, args.scope, args.legacySessionId)
    const existingSession = requestedSession ?? legacySession

    const sessionId = existingSession?._id ?? (await ctx.db.insert('chatSessions', {
      userId: user._id,
      scope: args.scope,
      title: args.title,
      legacySessionId: args.legacySessionId,
      lastMessageAt: now,
      migrationSource: 'legacy-flask',
    }))

    if (existingSession) {
      await ctx.db.patch(existingSession._id, {
        title: args.title,
        legacySessionId: args.legacySessionId,
        lastMessageAt: now,
        migrationSource: 'legacy-flask',
      })
    }

    await deleteSessionMessages(ctx, sessionId)

    const messageCount = args.messages.length
    const firstCreatedAt = now - messageCount * 1000
    for (const [index, message] of args.messages.entries()) {
      await ctx.db.insert('chatMessages', {
        sessionId,
        sender: message.role,
        content: message.content,
        createdAt: firstCreatedAt + index * 1000,
      })
    }

    const session = await ctx.db.get(sessionId)
    const messages = await listSessionMessages(ctx, sessionId)
    if (!session) {
      throw new ConvexError('Unable to load the synchronized chat session.')
    }

    return {
      session: buildChatSessionSummary(session),
      messages: messages.map(buildChatMessagePayload),
    }
  },
})

export const saveCurrentOnboardingFlow = mutationGeneric({
  args: {
    answers: onboardingAnswersValidator,
    currentQuestionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await ensureCurrentUserRecord(ctx)
    const now = Date.now()
    const session = await findCurrentOnboardingSession(ctx, user._id)

    if (session) {
      await ctx.db.patch(session._id, {
        title: 'Onboarding',
        onboardingAnswers: args.answers,
        onboardingStep: args.currentQuestionIndex,
        lastMessageAt: now,
        migrationSource: 'convex',
      })
    } else {
      await ctx.db.insert('chatSessions', {
        userId: user._id,
        scope: 'onboarding',
        title: 'Onboarding',
        onboardingAnswers: args.answers,
        onboardingStep: args.currentQuestionIndex,
        lastMessageAt: now,
        migrationSource: 'convex',
      })
    }

    return {
      sessionId: session?._id ?? null,
      answers: args.answers,
      currentQuestionIndex: args.currentQuestionIndex,
      isComplete: false,
    }
  },
})

export const resetCurrentOnboardingFlow = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    const { user } = await ensureCurrentUserRecord(ctx)

    const sessions = await ctx.db
      .query('chatSessions')
      .withIndex('by_userId_and_scope', (query: any) => query.eq('userId', user._id).eq('scope', 'onboarding'))
      .collect()

    for (const session of sessions) {
      await deleteSessionMessages(ctx, session._id)
      await ctx.db.delete(session._id)
    }

    return DEFAULT_ONBOARDING_FLOW_STATE
  },
})

export const deleteCurrentChatSession = mutationGeneric({
  args: { sessionId: v.id('chatSessions') },
  handler: async (ctx, args) => {
    const { user } = await ensureCurrentUserRecord(ctx)

    const session = await getOwnedSession(ctx, user._id, args.sessionId)
    if (!session) {
      return { deleted: false }
    }

    await deleteSessionMessages(ctx, session._id)
    await ctx.db.delete(session._id)
    return { deleted: true }
  },
})

export const clearCurrentChatSessions = mutationGeneric({
  args: { scope: chatScopeValidator, keepSessionId: v.optional(v.id('chatSessions')) },
  handler: async (ctx, args) => {
    const { user } = await ensureCurrentUserRecord(ctx)

    const sessions = await ctx.db
      .query('chatSessions')
      .withIndex('by_userId_and_scope', (query: any) => query.eq('userId', user._id).eq('scope', args.scope))
      .collect()

    let cleared = 0
    for (const session of sessions) {
      if (args.keepSessionId && session._id === args.keepSessionId) {
        continue
      }
      await deleteSessionMessages(ctx, session._id)
      await ctx.db.delete(session._id)
      cleared += 1
    }

    return { cleared }
  },
})

export const hydrateCurrentChatSessionsFromLegacy = actionGeneric({
  args: {
    ...legacyHydrationArgsValidator,
    scope: chatScopeValidator,
  },
  handler: async (ctx, args) => {
    const sessions = (await readLegacyJson<LegacyChatSession[]>('/chat/sessions', args)) ?? []
    const hydratedSessions: ChatSessionSummary[] = []

    for (const session of sessions) {
      if (toLegacyScope(session.title) !== args.scope) {
        continue
      }

      const history = await readLegacyJson<{ messages?: LegacyChatMessage[] }>(`/chat/history/${session.id}`, args)
      const syncedSession = await ctx.runMutation(syncCurrentChatSessionFromLegacyRef, {
        scope: args.scope,
        title: session.title,
        legacySessionId: session.id,
        messages: history?.messages ?? [],
      })
      hydratedSessions.push(syncedSession.session)
    }

    return hydratedSessions.sort((left, right) => (right.lastMessageAt ?? right.createdAt) - (left.lastMessageAt ?? left.createdAt))
  },
})

// RATE LIMIT: sendCurrentExploreMessage must be rate-limited per user (e.g. 10 req/min)
// before this function is exposed beyond the legacy bridge path.
export const sendCurrentExploreMessage = actionGeneric({
  args: {
    ...legacyHydrationArgsValidator,
    message: v.string(),
    sessionId: v.optional(v.id('chatSessions')),
  },
  handler: async (ctx, args) => {
    if (!args.message.trim()) {
      throw new ConvexError('Message must not be empty.')
    }
    if (args.message.length > 10_000) {
      throw new ConvexError('Message exceeds 10,000 character limit.')
    }
    const existingSession = args.sessionId ? await ctx.runQuery(getCurrentChatSessionRef, { sessionId: args.sessionId }) : null

    const response = await requestLegacyJson<LegacyChatResponse>('/chat/explore', args, {
      method: 'POST',
      body: JSON.stringify({
        message: args.message,
        ...(existingSession?.session.legacySessionId ? { session_id: existingSession.session.legacySessionId } : {}),
      }),
    })

    if (!response?.session_id) {
      throw new Error('Legacy explore bridge did not return a session identifier.')
    }

    const syncedSession = await ctx.runMutation(syncCurrentChatSessionFromLegacyRef, {
      scope: 'explore',
      title: 'Explore My Options',
      legacySessionId: response.session_id,
      messages: response.messages ?? [],
      ...(existingSession?.session.id ? { existingSessionId: existingSession.session.id } : {}),
    })

    return {
      ...syncedSession,
      suggestions: response.suggestions ?? [],
    }
  },
})

