// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

// Mock the convex client module before importing helpers
vi.mock('./client', () => ({
  getConvexClient: vi.fn(() => null), // default: no client
}))
vi.mock('./api', () => ({
  convexApi: {
    chat: {
      listCurrentUserSessions: 'chat.listCurrentUserSessions',
      createSession: 'chat.createSession',
      deleteSession: 'chat.deleteSession',
      clearExploreSessions: 'chat.clearExploreSessions',
      getSessionMessages: 'chat.getSessionMessages',
      addMessage: 'chat.addMessage',
      sendCurrentExploreMessage: 'chat.sendCurrentExploreMessage',
    },
  },
}))
vi.mock('../runtimeConfig', () => ({
  getApiBaseUrl: vi.fn(() => '/api'),
  apiUrl: vi.fn((p: string) => `/api${p}`),
}))
vi.mock('./legacyBoundary', () => ({
  resolveLegacyApiBaseUrl: vi.fn((url: string) => url),
  toLegacyBoundaryError: vi.fn(() => null),
  LegacyBoundaryError: class extends Error {},
}))

import { listChatSessionsConvex, createChatSession, deleteChatSessionConvex, getSessionMessagesConvex } from './chatHelpers'
import { getConvexClient } from './client'

describe('chatHelpers — client unavailable (throws)', () => {
  it('listChatSessionsConvex throws when client is null', async () => {
    ;(getConvexClient as ReturnType<typeof vi.fn>).mockReturnValue(null)
    await expect(listChatSessionsConvex()).rejects.toThrow(/convex client is unavailable/i)
  })

  it('createChatSession throws when client is null', async () => {
    ;(getConvexClient as ReturnType<typeof vi.fn>).mockReturnValue(null)
    await expect(createChatSession('explore')).rejects.toThrow(/convex client is unavailable/i)
  })

  it('deleteChatSessionConvex throws when client is null', async () => {
    ;(getConvexClient as ReturnType<typeof vi.fn>).mockReturnValue(null)
    await expect(deleteChatSessionConvex('session-1')).rejects.toThrow(/convex client is unavailable/i)
  })

  it('getSessionMessagesConvex throws when client is null', async () => {
    ;(getConvexClient as ReturnType<typeof vi.fn>).mockReturnValue(null)
    await expect(getSessionMessagesConvex('session-1')).rejects.toThrow(/convex client is unavailable/i)
  })
})

describe('chatHelpers — with mock client', () => {
  it('listChatSessionsConvex calls client.query with correct function key', async () => {
    const mockQuery = vi.fn().mockResolvedValue([])
    ;(getConvexClient as ReturnType<typeof vi.fn>).mockReturnValue({ query: mockQuery, mutation: vi.fn() })
    await listChatSessionsConvex('explore')
    expect(mockQuery).toHaveBeenCalledWith('chat.listCurrentUserSessions', { scope: 'explore' })
  })

  it('createChatSession calls client.mutation', async () => {
    const mockMutation = vi.fn().mockResolvedValue('new-session-id')
    ;(getConvexClient as ReturnType<typeof vi.fn>).mockReturnValue({ query: vi.fn(), mutation: mockMutation })
    const id = await createChatSession('explore', 'My Chat')
    expect(mockMutation).toHaveBeenCalledWith('chat.createSession', { scope: 'explore', title: 'My Chat' })
    expect(id).toBe('new-session-id')
  })
})
