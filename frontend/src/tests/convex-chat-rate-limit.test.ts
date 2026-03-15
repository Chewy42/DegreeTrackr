import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { ConvexError } from 'convex/values'

// ── Mock Convex db + auth ctx builder ──────────────────────────────────────

type MockMessage = {
  _id: string
  sessionId: string
  sender: 'user' | 'assistant'
  content: string
  createdAt: number
}

type MockSession = {
  _id: string
  userId: string
  scope: 'explore' | 'onboarding' | 'general'
  title: string
  _creationTime: number
  lastMessageAt: number | null
  archivedAt?: number
}

function buildMockCtx(options: {
  identity: { subject: string } | null
  userProfile: Record<string, unknown> | null
  sessions?: MockSession[]
  messages?: MockMessage[]
}) {
  const sessions = options.sessions ?? []
  const messages = options.messages ?? []
  const userProfiles = options.userProfile ? [options.userProfile] : []

  const queryChain = (table: string) => {
    const items =
      table === 'chatSessions'
        ? sessions
        : table === 'chatMessages'
          ? messages
          : table === 'userProfiles'
            ? userProfiles
            : []

    return {
      withIndex: (_indexName: string, filterFn?: (q: any) => any) => {
        let filtered = [...items]
        if (filterFn) {
          const constraints: Record<string, unknown> = {}
          let gteField: string | null = null
          let gteValue: unknown = null
          const q = new Proxy(
            {},
            {
              get: (_target, _prop) => {
                return (field: string, value?: unknown) => {
                  if (_prop === 'eq') {
                    constraints[field] = value
                  } else if (_prop === 'gte') {
                    gteField = field
                    gteValue = value
                  }
                  return q
                }
              },
            },
          )
          filterFn(q)
          filtered = filtered.filter((item: any) => {
            for (const [key, val] of Object.entries(constraints)) {
              if (item[key] !== val) return false
            }
            if (gteField && gteValue != null) {
              if ((item as any)[gteField] < gteValue) return false
            }
            return true
          })
        }
        return {
          collect: async () => filtered,
          first: async () => filtered[0] ?? null,
        }
      },
      collect: async () => items,
      first: async () => items[0] ?? null,
    }
  }

  return {
    auth: {
      getUserIdentity: async () => options.identity,
    },
    db: {
      query: (table: string) => queryChain(table),
      get: async (id: string) =>
        sessions.find((s) => s._id === id) ??
        messages.find((m) => m._id === id) ??
        (options.userProfile && (options.userProfile as any)._id === id ? options.userProfile : null),
      insert: vi.fn().mockResolvedValue('new-id'),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
}

// ── Import handlers directly ───────────────────────────────────────────────

// We test the handler logic by importing the module and extracting exported
// Convex function definitions. The .handler property is the async function.
// Because the functions use `queryGeneric` / `actionGeneric` wrappers that
// return { handler, args }, we access `.handler` directly.

// Mock userState before importing chat module
vi.mock('../../../convex/userState', () => ({
  getCurrentUserState: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { user: null }
    const user = await ctx.db.query('userProfiles').withIndex('by_clerkUserId').first()
    return { user }
  },
  ensureCurrentUserRecord: async (ctx: any) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError('Unauthenticated — no user identity available.')
    const user = await ctx.db.query('userProfiles').withIndex('by_clerkUserId').first()
    if (!user) throw new ConvexError('Unauthenticated — no user identity available.')
    return { user }
  },
  getUserPreferencesRecord: async () => null,
  getSchedulingPreferencesRecord: async () => null,
}))

vi.mock('../../../convex/legacyHydration', () => ({
  legacyHydrationArgsValidator: {},
  readLegacyJson: vi.fn(),
  requestLegacyJson: vi.fn(),
}))

vi.mock('../../../convex/contracts', () => ({
  chatScopeValidator: {},
}))

// ── Suite ──────────────────────────────────────────────────────────────────

describe('convex/chat rate limit + auth guard', () => {
  const USER_ID = 'user-001'
  const CLERK_SUBJECT = 'clerk|abc'
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => { vi.useRealTimers() })

  // Dynamically import so mocks are resolved
  async function getHandlers() {
    const mod = await import('../../../convex/chat')
    return {
      checkExploreRateLimit: (mod.checkExploreRateLimit as any)._handler,
      sendCurrentExploreMessage: (mod.sendCurrentExploreMessage as any)._handler,
    }
  }

  it('sendMessage allowed when under rate limit (first message in window)', async () => {
    const { checkExploreRateLimit } = await getHandlers()

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      userProfile: { _id: USER_ID, clerkUserId: CLERK_SUBJECT },
      sessions: [
        {
          _id: 'session-1',
          userId: USER_ID,
          scope: 'explore',
          title: 'Explore My Options',
          _creationTime: NOW - 120_000,
          lastMessageAt: null,
        },
      ],
      messages: [], // no messages at all → under limit
    })

    const result = await checkExploreRateLimit(ctx, {})
    expect(result).toEqual({ allowed: true })
  })

  it('sendMessage blocked when at rate limit (N+1 call returns not allowed)', async () => {
    const { checkExploreRateLimit } = await getHandlers()

    // Create 10 user messages within the window (limit is 10)
    const recentMessages: MockMessage[] = Array.from({ length: 10 }, (_, i) => ({
      _id: `msg-${i}`,
      sessionId: 'session-1',
      sender: 'user' as const,
      content: `message ${i}`,
      createdAt: NOW - 30_000 + i * 1000, // all within the 60s window
    }))

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      userProfile: { _id: USER_ID, clerkUserId: CLERK_SUBJECT },
      sessions: [
        {
          _id: 'session-1',
          userId: USER_ID,
          scope: 'explore',
          title: 'Explore My Options',
          _creationTime: NOW - 120_000,
          lastMessageAt: NOW - 1000,
        },
      ],
      messages: recentMessages,
    })

    const result = await checkExploreRateLimit(ctx, {})
    expect(result).toEqual({ allowed: false })
  })

  it('rate limit resets after window expires (message succeeds again)', async () => {
    const { checkExploreRateLimit } = await getHandlers()

    // 10 messages that are older than the 60s window
    const oldMessages: MockMessage[] = Array.from({ length: 10 }, (_, i) => ({
      _id: `msg-old-${i}`,
      sessionId: 'session-1',
      sender: 'user' as const,
      content: `old message ${i}`,
      createdAt: NOW - 120_000 + i * 1000, // all outside the 60s window
    }))

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      userProfile: { _id: USER_ID, clerkUserId: CLERK_SUBJECT },
      sessions: [
        {
          _id: 'session-1',
          userId: USER_ID,
          scope: 'explore',
          title: 'Explore My Options',
          _creationTime: NOW - 200_000,
          lastMessageAt: NOW - 120_000,
        },
      ],
      messages: oldMessages,
    })

    const result = await checkExploreRateLimit(ctx, {})
    expect(result).toEqual({ allowed: true })
  })

  it('auth guard: unauthenticated sendCurrentExploreMessage throws immediately', async () => {
    const { sendCurrentExploreMessage } = await getHandlers()

    const ctx = buildMockCtx({
      identity: null,
      userProfile: null,
    })
    // actionGeneric handlers receive a ctx with runQuery/runMutation,
    // but ensureCurrentUserRecord (called via the action's flow) checks auth first.
    // For the action handler, the rate-limit check runs first via runQuery.
    // We simulate the action ctx with runQuery that rejects for unauthed users.
    const actionCtx = {
      ...ctx,
      runQuery: vi.fn().mockRejectedValue(new ConvexError('Unauthenticated — no user identity available.')),
      runMutation: vi.fn(),
    }

    await expect(
      sendCurrentExploreMessage(actionCtx, {
        message: 'Hello',
        apiBaseUrl: 'http://localhost:3000',
        jwt: 'test',
      }),
    ).rejects.toThrow()
  })
})
