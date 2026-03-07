import { afterEach, describe, expect, it, vi } from 'vitest'

// ── Mock the Convex client singleton ────────────────────────────────
const mockQuery = vi.fn()
const mockMutation = vi.fn()
const mockAction = vi.fn()

vi.mock('./client', () => {
  let clientEnabled = false
  return {
    getConvexClient: () =>
      clientEnabled ? { query: mockQuery, mutation: mockMutation, action: mockAction } : null,
    resetConvexClientForTests: () => {
      clientEnabled = false
    },
    __enableClient: () => {
      clientEnabled = true
    },
  }
})

import { resetConvexClientForTests } from './client'
import {
  addChatMessage,
  clearExploreSessionsConvex,
  createChatSession,
  deleteChatSessionConvex,
  getSessionMessagesConvex,
  listChatSessionsConvex,
  sendCurrentExploreMessageConvex,
  sendExploreUserMessage,
} from './chatHelpers'

// Cast to access test helper
const clientModule = await import('./client') as any
function enableConvex() {
  clientModule.__enableClient()
}

afterEach(() => {
  resetConvexClientForTests()
  mockQuery.mockReset()
  mockMutation.mockReset()
  mockAction.mockReset()
})

describe('chatHelpers', () => {
  it('throws when Convex client is unavailable', async () => {
    await expect(listChatSessionsConvex()).rejects.toThrow('Convex client is unavailable.')
  })

  it('listChatSessionsConvex calls query with scope', async () => {
    enableConvex()
    const sessions = [{ _id: 's1', title: 'Explore', scope: 'explore', lastMessageAt: 100, createdAt: 50 }]
    mockQuery.mockResolvedValue(sessions)

    const result = await listChatSessionsConvex('explore')

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery.mock.calls[0]?.[1]).toEqual({ scope: 'explore' })
    expect(result).toEqual(sessions)
  })

  it('listChatSessionsConvex passes empty object when no scope', async () => {
    enableConvex()
    mockQuery.mockResolvedValue([])

    await listChatSessionsConvex()

    expect(mockQuery.mock.calls[0]?.[1]).toEqual({})
  })

  it('createChatSession calls mutation with scope and title', async () => {
    enableConvex()
    mockMutation.mockResolvedValue('new-session-id')

    const result = await createChatSession('explore', 'My Chat')

    expect(mockMutation).toHaveBeenCalledTimes(1)
    expect(mockMutation.mock.calls[0]?.[1]).toEqual({ scope: 'explore', title: 'My Chat' })
    expect(result).toBe('new-session-id')
  })

  it('deleteChatSessionConvex calls mutation', async () => {
    enableConvex()
    mockMutation.mockResolvedValue(undefined)

    await deleteChatSessionConvex('session-to-delete')

    expect(mockMutation).toHaveBeenCalledTimes(1)
    expect(mockMutation.mock.calls[0]?.[1]).toEqual({ sessionId: 'session-to-delete' })
  })

  it('clearExploreSessionsConvex passes keepSessionId when provided', async () => {
    enableConvex()
    mockMutation.mockResolvedValue(undefined)

    await clearExploreSessionsConvex('keep-me')

    expect(mockMutation.mock.calls[0]?.[1]).toEqual({ keepSessionId: 'keep-me' })
  })

  it('clearExploreSessionsConvex passes empty object when no keepSessionId', async () => {
    enableConvex()
    mockMutation.mockResolvedValue(undefined)

    await clearExploreSessionsConvex()

    expect(mockMutation.mock.calls[0]?.[1]).toEqual({})
  })

  it('getSessionMessagesConvex returns messages', async () => {
    enableConvex()
    const messages = [
      { _id: 'm1', role: 'user' as const, content: 'Hello', createdAt: 100 },
      { _id: 'm2', role: 'assistant' as const, content: 'Hi there', createdAt: 200 },
    ]
    mockQuery.mockResolvedValue(messages)

    const result = await getSessionMessagesConvex('session-1')

    expect(mockQuery.mock.calls[0]?.[1]).toEqual({ sessionId: 'session-1' })
    expect(result).toEqual(messages)
  })

  it('addChatMessage calls mutation with correct args', async () => {
    enableConvex()
    mockMutation.mockResolvedValue('msg-id-1')

    const result = await addChatMessage('s1', 'user', 'Hello world')

    expect(mockMutation.mock.calls[0]?.[1]).toEqual({
      sessionId: 's1',
      sender: 'user',
      content: 'Hello world',
    })
    expect(result).toBe('msg-id-1')
  })

  it('sendExploreUserMessage creates session when none provided', async () => {
    enableConvex()
    mockMutation
      .mockResolvedValueOnce('new-sess') // createSession
      .mockResolvedValueOnce('msg-1')    // addMessage

    const result = await sendExploreUserMessage(null, 'What courses?')

    expect(mockMutation).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ sessionId: 'new-sess', userMessageId: 'msg-1' })
  })

  it('sendExploreUserMessage uses existing session', async () => {
    enableConvex()
    mockMutation.mockResolvedValueOnce('msg-2')

    const result = await sendExploreUserMessage('existing-sess', 'Tell me more')

    expect(mockMutation).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ sessionId: 'existing-sess', userMessageId: 'msg-2' })
  })

  it('sendCurrentExploreMessageConvex calls legacy bridge action with resolved api base url', async () => {
    enableConvex()
    mockAction.mockResolvedValue({
      session: {
        id: 'chat-1',
        scope: 'explore',
        title: 'Explore My Options',
        createdAt: 123,
        lastMessageAt: 456,
        legacySessionId: 'legacy-1',
      },
      messages: [
        { id: 'm1', role: 'user', content: 'Hello', createdAt: 111 },
        { id: 'm2', role: 'assistant', content: 'Hi', createdAt: 222 },
      ],
      suggestions: ['What courses do I need?'],
    })

    const result = await sendCurrentExploreMessageConvex({
      jwt: 'jwt-token',
      message: 'Hello',
      sessionId: 'chat-1',
      apiBaseUrl: 'http://localhost:5000/api',
    })

    expect(mockAction).toHaveBeenCalledTimes(1)
    expect(mockAction.mock.calls[0]?.[1]).toEqual({
      jwt: 'jwt-token',
      apiBaseUrl: 'http://localhost:5000/api',
      message: 'Hello',
      sessionId: 'chat-1',
    })
    expect(result.session.legacySessionId).toBe('legacy-1')
  })
})