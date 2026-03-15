import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Explore chat rate-limit tests ────────────────────────────────────────────
// checkExploreRateLimit (convex/chat.ts) enforces a sliding-window limit of
// 10 user messages per 60 seconds across all non-archived 'explore' sessions.
// sendCurrentExploreMessage checks the rate limit before sending and throws
// a ConvexError when the limit is exceeded.
//
// These tests verify the rate-limit logic at the handler level.

const EXPLORE_RATE_LIMIT_WINDOW_MS = 60_000
const EXPLORE_RATE_LIMIT_MAX = 10

class ConvexError extends Error {
  data: string
  constructor(message: string) {
    super(message)
    this.name = 'ConvexError'
    this.data = message
  }
}

// ── Mock rate-limit handler (mirrors checkExploreRateLimit logic) ─────────────

interface MockMessage {
  sender: 'user' | 'assistant'
  createdAt: number
}

interface MockSession {
  _id: string
  userId: string
  scope: string
  archivedAt: number | null
}

let mockSessions: MockSession[] = []
let mockMessages: Map<string, MockMessage[]> = new Map()
let mockNow = Date.now()

function resetMockState() {
  mockSessions = []
  mockMessages = new Map()
  mockNow = Date.now()
}

function addUserMessage(sessionId: string, createdAt: number) {
  const msgs = mockMessages.get(sessionId) ?? []
  msgs.push({ sender: 'user', createdAt })
  mockMessages.set(sessionId, msgs)
}

function addAssistantMessage(sessionId: string, createdAt: number) {
  const msgs = mockMessages.get(sessionId) ?? []
  msgs.push({ sender: 'assistant', createdAt })
  mockMessages.set(sessionId, msgs)
}

function ensureSession(sessionId: string, userId = 'user-1') {
  if (!mockSessions.find(s => s._id === sessionId)) {
    mockSessions.push({ _id: sessionId, userId, scope: 'explore', archivedAt: null })
  }
}

/** Mirrors the core logic of checkExploreRateLimit */
function checkExploreRateLimit(userId: string): { allowed: boolean } {
  const windowStart = mockNow - EXPLORE_RATE_LIMIT_WINDOW_MS

  const userSessions = mockSessions.filter(
    s => s.userId === userId && s.scope === 'explore' && !s.archivedAt,
  )

  let recentUserMessages = 0
  for (const session of userSessions) {
    const msgs = mockMessages.get(session._id) ?? []
    recentUserMessages += msgs.filter(
      m => m.sender === 'user' && m.createdAt >= windowStart,
    ).length
  }

  return { allowed: recentUserMessages < EXPLORE_RATE_LIMIT_MAX }
}

/** Mirrors the rate-limit gate in sendCurrentExploreMessage */
function sendMessage(userId: string, message: string) {
  if (!message.trim()) throw new ConvexError('Message must not be empty.')
  if (message.length > 10_000) throw new ConvexError('Message exceeds 10,000 character limit.')

  const rateCheck = checkExploreRateLimit(userId)
  if (!rateCheck.allowed) {
    throw new ConvexError(
      'You are sending messages too quickly. Please wait a moment and try again.',
    )
  }

  // In production this would call the legacy bridge; here we just return success
  return { ok: true }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('explore chat rate limit — checkExploreRateLimit', () => {
  beforeEach(() => {
    resetMockState()
    ensureSession('session-1')
  })

  it('allows the first message within the rate limit window', () => {
    const result = checkExploreRateLimit('user-1')
    expect(result.allowed).toBe(true)
  })

  it('allows up to 9 messages within the window (below the 10 limit)', () => {
    for (let i = 0; i < 9; i++) {
      addUserMessage('session-1', mockNow - 30_000 + i * 1000)
    }
    expect(checkExploreRateLimit('user-1').allowed).toBe(true)
  })

  it('rejects the 11th message within the window (at the 10 limit)', () => {
    for (let i = 0; i < 10; i++) {
      addUserMessage('session-1', mockNow - 30_000 + i * 1000)
    }
    expect(checkExploreRateLimit('user-1').allowed).toBe(false)
  })

  it('allows messages again after the window expires', () => {
    // Add 10 messages that are now outside the 60s window
    for (let i = 0; i < 10; i++) {
      addUserMessage('session-1', mockNow - 90_000 + i * 1000)
    }
    // All 10 are older than windowStart → allowed
    expect(checkExploreRateLimit('user-1').allowed).toBe(true)
  })

  it('counts only user messages — assistant messages do not affect the limit', () => {
    for (let i = 0; i < 10; i++) {
      addAssistantMessage('session-1', mockNow - 30_000 + i * 1000)
    }
    // 0 user messages → allowed
    expect(checkExploreRateLimit('user-1').allowed).toBe(true)
  })

  it('counts messages across multiple non-archived explore sessions', () => {
    ensureSession('session-2')
    for (let i = 0; i < 6; i++) {
      addUserMessage('session-1', mockNow - 30_000 + i * 1000)
    }
    for (let i = 0; i < 4; i++) {
      addUserMessage('session-2', mockNow - 20_000 + i * 1000)
    }
    // 6 + 4 = 10 → not allowed
    expect(checkExploreRateLimit('user-1').allowed).toBe(false)
  })

  it('excludes archived sessions from the count', () => {
    mockSessions[0]!.archivedAt = mockNow - 120_000
    for (let i = 0; i < 10; i++) {
      addUserMessage('session-1', mockNow - 30_000 + i * 1000)
    }
    // Session is archived → messages not counted
    expect(checkExploreRateLimit('user-1').allowed).toBe(true)
  })

  it('does not count messages from other users', () => {
    ensureSession('session-other', 'user-2')
    for (let i = 0; i < 10; i++) {
      addUserMessage('session-other', mockNow - 30_000 + i * 1000)
    }
    // user-1 has no messages → allowed
    expect(checkExploreRateLimit('user-1').allowed).toBe(true)
  })
})

describe('explore chat rate limit — sendCurrentExploreMessage gate', () => {
  beforeEach(() => {
    resetMockState()
    ensureSession('session-1')
  })

  it('first send succeeds within the rate limit window', () => {
    expect(() => sendMessage('user-1', 'Hello')).not.toThrow()
  })

  it('throws ConvexError with rate limit message when limit is exceeded', () => {
    for (let i = 0; i < 10; i++) {
      addUserMessage('session-1', mockNow - 30_000 + i * 1000)
    }
    expect(() => sendMessage('user-1', 'One more'))
      .toThrow('You are sending messages too quickly. Please wait a moment and try again.')
  })

  it('send succeeds after the window expires', () => {
    for (let i = 0; i < 10; i++) {
      addUserMessage('session-1', mockNow - 90_000 + i * 1000)
    }
    expect(() => sendMessage('user-1', 'Back again')).not.toThrow()
  })

  it('rate limit does not apply to reads — checkExploreRateLimit is a query, not a mutation', () => {
    // checkExploreRateLimit is defined as queryGeneric, meaning reads are
    // unrestricted. Only sendCurrentExploreMessage (an action) gates on it.
    // Verify the query always returns a result shape regardless of message count.
    for (let i = 0; i < 20; i++) {
      addUserMessage('session-1', mockNow - 30_000 + i * 100)
    }
    const result = checkExploreRateLimit('user-1')
    expect(result).toHaveProperty('allowed')
    // The query itself never throws — it just returns { allowed: false }
    expect(result.allowed).toBe(false)
  })
})
