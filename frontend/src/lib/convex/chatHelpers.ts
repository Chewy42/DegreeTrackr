import { getApiBaseUrl } from '../runtimeConfig'
import { resolveLegacyApiBaseUrl, toLegacyBoundaryError } from './legacyBoundary'
import type { ChatMessageEntry, ChatSessionSummary, SendCurrentExploreMessageResult } from './api'
import { convexApi } from './api'
import { getConvexClient } from './client'

/**
 * Convex-backed chat data helpers.
 *
 * These helpers wrap the Convex chat mutations/queries so components
 * can call simple async functions instead of directly touching the
 * Convex client. Each helper validates the client is available and
 * throws a clear error if it isn't.
 */

function requireClient() {
  const client = getConvexClient()
  if (!client) throw new Error('Convex client is unavailable.')
  return client
}

// ── Session helpers ─────────────────────────────────────────────────

export async function listChatSessionsConvex(
  scope?: 'onboarding' | 'explore' | 'general',
): Promise<ChatSessionSummary[]> {
  const client = requireClient()
  return client.query(convexApi.chat.listCurrentUserSessions, scope ? { scope } : {})
}

export async function createChatSession(
  scope: 'onboarding' | 'explore' | 'general',
  title?: string,
): Promise<string> {
  const client = requireClient()
  return client.mutation(convexApi.chat.createSession, { scope, title })
}

export async function deleteChatSessionConvex(sessionId: string): Promise<void> {
  const client = requireClient()
  await client.mutation(convexApi.chat.deleteSession, { sessionId })
}

export async function clearExploreSessionsConvex(keepSessionId?: string): Promise<void> {
  const client = requireClient()
  await client.mutation(convexApi.chat.clearExploreSessions, keepSessionId ? { keepSessionId } : {})
}

// ── Message helpers ─────────────────────────────────────────────────

export async function getSessionMessagesConvex(sessionId: string): Promise<ChatMessageEntry[]> {
  const client = requireClient()
  return client.query(convexApi.chat.getSessionMessages, { sessionId })
}

export async function addChatMessage(
  sessionId: string,
  sender: 'user' | 'assistant' | 'system',
  content: string,
): Promise<string> {
  const client = requireClient()
  return client.mutation(convexApi.chat.addMessage, { sessionId, sender, content })
}

// ── Convenience: send user message and persist both sides ───────────

export type SendExploreMessageResult = {
  sessionId: string
  userMessageId: string
}

/**
 * Persists a user message in an existing or new explore session.
 * Returns the sessionId (may be newly created) and the stored message id.
 *
 * AI response generation is handled separately; this only covers
 * the data-persistence side.
 */
export async function sendExploreUserMessage(
  sessionId: string | null,
  userText: string,
): Promise<SendExploreMessageResult> {
  const resolvedSessionId = sessionId ?? (await createChatSession('explore'))
  const userMessageId = await addChatMessage(resolvedSessionId, 'user', userText)
  return { sessionId: resolvedSessionId, userMessageId }
}

export async function sendCurrentExploreMessageConvex(args: {
  jwt: string
  message: string
  sessionId?: string
  apiBaseUrl?: string
}): Promise<SendCurrentExploreMessageResult> {
  const client = requireClient()

  try {
    return await client.action(convexApi.chat.sendCurrentExploreMessage, {
      jwt: args.jwt,
      apiBaseUrl: resolveLegacyApiBaseUrl(args.apiBaseUrl ?? getApiBaseUrl()),
      message: args.message,
      ...(args.sessionId ? { sessionId: args.sessionId } : {}),
    })
  } catch (error) {
    throw toLegacyBoundaryError(error) ?? error
  }
}