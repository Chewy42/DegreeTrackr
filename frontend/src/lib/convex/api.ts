import { makeFunctionReference } from 'convex/server'

import type { UserPreferences } from '../../auth/AuthContext'
import type {
  ChatScope,
  OnboardingCompletionResult,
  ProgramEvaluationMutationPayload,
  ProgramEvaluationPayload,
  SchedulingPreferencesFormValues,
} from './contracts'

type NoArgs = Record<string, never>

export type ChatSessionSummary = {
  _id: string
  title: string
  scope: ChatScope
  lastMessageAt: number | null
  createdAt: number
}

export type ChatMessageEntry = {
  _id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

export type SyncedChatSession = {
  id: string
  scope: ChatScope
  title: string
  createdAt: number
  lastMessageAt: number | null
  legacySessionId?: string
}

export type SyncedChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

export type ScheduleSnapshotResult = {
  id: string
  userId: string
  name: string
  classIds: string[]
  totalCredits: number
  classCount: number
  createdAt: number
  migrationSource: 'convex'
}

export type SendCurrentExploreMessageResult = {
  session: SyncedChatSession
  messages: SyncedChatMessage[]
  suggestions: string[]
}

export const convexApi = {
  profile: {
    getCurrentUserPreferences: makeFunctionReference<'query', NoArgs, UserPreferences | null>('profile:getCurrentUserPreferences'),
    hydrateCurrentUserPreferencesFromLegacy: makeFunctionReference<
      'action',
      { jwt: string; apiBaseUrl: string },
      UserPreferences
    >('profile:hydrateCurrentUserPreferencesFromLegacy'),
    syncCurrentUserPreferencesFromLegacy: makeFunctionReference<
      'mutation',
      { preferences: Partial<UserPreferences> },
      UserPreferences
    >('profile:syncCurrentUserPreferencesFromLegacy'),
    updateCurrentUserPreferences: makeFunctionReference<'mutation', { patch: Partial<UserPreferences> }, UserPreferences>(
      'profile:updateCurrentUserPreferences',
    ),
    getCurrentSchedulingPreferences: makeFunctionReference<'query', NoArgs, SchedulingPreferencesFormValues | null>(
      'profile:getCurrentSchedulingPreferences',
    ),
    hydrateCurrentSchedulingPreferencesFromLegacy: makeFunctionReference<
      'action',
      { jwt: string; apiBaseUrl: string },
      SchedulingPreferencesFormValues
    >('profile:hydrateCurrentSchedulingPreferencesFromLegacy'),
    syncCurrentSchedulingPreferencesFromLegacy: makeFunctionReference<
      'mutation',
      { preferences: SchedulingPreferencesFormValues },
      SchedulingPreferencesFormValues
    >('profile:syncCurrentSchedulingPreferencesFromLegacy'),
    updateCurrentSchedulingPreferences: makeFunctionReference<
      'mutation',
      { patch: SchedulingPreferencesFormValues },
      SchedulingPreferencesFormValues
    >('profile:updateCurrentSchedulingPreferences'),
    completeCurrentOnboarding: makeFunctionReference<
      'mutation',
      { answers: SchedulingPreferencesFormValues },
      OnboardingCompletionResult
    >('profile:completeCurrentOnboarding'),
  },
  evaluations: {
    getCurrentProgramEvaluation: makeFunctionReference<'query', NoArgs, ProgramEvaluationPayload | null>(
      'evaluations:getCurrentProgramEvaluation',
    ),
    hydrateCurrentProgramEvaluationFromLegacy: makeFunctionReference<
      'action',
      { jwt: string; apiBaseUrl: string },
      ProgramEvaluationPayload | null
    >('evaluations:hydrateCurrentProgramEvaluationFromLegacy'),
    syncCurrentProgramEvaluationFromLegacy: makeFunctionReference<
      'mutation',
      { payload: ProgramEvaluationMutationPayload },
      ProgramEvaluationPayload
    >('evaluations:syncCurrentProgramEvaluationFromLegacy'),
    replaceCurrentProgramEvaluationFromUpload: makeFunctionReference<
      'mutation',
      { payload: ProgramEvaluationMutationPayload },
      ProgramEvaluationPayload
    >('evaluations:replaceCurrentProgramEvaluationFromUpload'),
    clearCurrentProgramEvaluation: makeFunctionReference<'mutation', NoArgs, UserPreferences>(
      'evaluations:clearCurrentProgramEvaluation',
    ),
  },
  chat: {
    listCurrentUserSessions: makeFunctionReference<
      'query',
      { scope?: ChatScope },
      ChatSessionSummary[]
    >('chat:listCurrentUserSessions'),
    getSessionMessages: makeFunctionReference<
      'query',
      { sessionId: string },
      ChatMessageEntry[]
    >('chat:getSessionMessages'),
    createSession: makeFunctionReference<
      'mutation',
      { scope: ChatScope; title?: string },
      string
    >('chat:createSession'),
    addMessage: makeFunctionReference<
      'mutation',
      { sessionId: string; sender: 'user' | 'assistant' | 'system'; content: string },
      string
    >('chat:addMessage'),
    deleteSession: makeFunctionReference<
      'mutation',
      { sessionId: string },
      void
    >('chat:deleteSession'),
    clearExploreSessions: makeFunctionReference<
      'mutation',
      { keepSessionId?: string },
      void
    >('chat:clearExploreSessions'),
    sendCurrentExploreMessage: makeFunctionReference<
      'action',
      { jwt: string; apiBaseUrl: string; message: string; sessionId?: string },
      SendCurrentExploreMessageResult
    >('chat:sendCurrentExploreMessage'),
  },
  scheduleSnapshots: {
    listCurrentScheduleSnapshots: makeFunctionReference<
      'query',
      NoArgs,
      ScheduleSnapshotResult[]
    >('scheduleSnapshots:listCurrentScheduleSnapshots'),
    createCurrentScheduleSnapshot: makeFunctionReference<
      'mutation',
      { name: string; classIds: string[]; totalCredits: number },
      ScheduleSnapshotResult
    >('scheduleSnapshots:createCurrentScheduleSnapshot'),
    deleteCurrentScheduleSnapshot: makeFunctionReference<
      'mutation',
      { id: string },
      void
    >('scheduleSnapshots:deleteCurrentScheduleSnapshot'),
  },
} as const