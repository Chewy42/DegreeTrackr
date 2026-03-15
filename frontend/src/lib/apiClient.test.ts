import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'

// ── Globals setup ────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  globalThis.fetch = originalFetch
})

function mockFetch(impl: (...args: any[]) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as any
}

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('apiClient — auth header', () => {
  it('includes Authorization: Bearer <token> when jwt is provided', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const authHeader = (opts.headers as Record<string, string>)['Authorization']
      return jsonResponse({ authHeader })
    })

    const result = await apiClient.get<{ authHeader: string }>('/api/test', 'my-jwt-token')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.authHeader).toBe('Bearer my-jwt-token')
    }
  })

  it('omits Authorization header when jwt is not provided', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const hasAuth = 'Authorization' in (opts.headers as Record<string, string>)
      return jsonResponse({ hasAuth })
    })

    const result = await apiClient.get<{ hasAuth: boolean }>('/api/test')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hasAuth).toBe(false)
    }
  })
})

describe('apiClient — 401 response', () => {
  it('returns error with shouldSignOut: true on 401', async () => {
    mockFetch(async () => jsonResponse({ error: 'Token expired' }, 401))

    const result = await apiClient.get('/api/protected', 'expired-token')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
      expect(result.shouldSignOut).toBe(true)
      expect(result.error).toBe('Token expired')
    }
  })

  it('does not retry on 401', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ error: 'Unauthorized' }, 401))
    globalThis.fetch = fetchSpy as any

    await apiClient.get('/api/protected', 'bad-token')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('apiClient — network error', () => {
  it('returns typed error (not generic) on network failure', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    const resultPromise = apiClient.get('/api/test')

    // Advance past retry delays: 1s + 2s + 4s
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 1_000)

    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to fetch')
    }
  })
})

describe('apiClient — timeout', () => {
  it('aborts after default 30s timeout', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      // Wait for the abort signal
      return new Promise<Response>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })

    const resultPromise = apiClient.get('/api/slow')

    // Advance past the 30s timeout + retry delays
    // Default retries = 3, so 4 attempts total with delays between
    // Each attempt has 30s timeout + retry delays (1s, 2s, 4s)
    await vi.advanceTimersByTimeAsync(30_000 + 1_000 + 30_000 + 2_000 + 30_000 + 4_000 + 30_000 + 1_000)

    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Request timed out')
    }
  })
})

describe('apiClient — 503 retry', () => {
  it('retries on 503 and returns error after exhausting retries', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ error: 'Service unavailable' }, 503))
    globalThis.fetch = fetchSpy as any

    const resultPromise = apiClient.get('/api/down')

    // Advance through retry delays: 1s + 2s + 4s
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 1_000)

    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(503)
      expect(result.error).toBe('Service unavailable')
    }

    // 1 initial + 3 retries = 4 total
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('succeeds on retry if second attempt returns 200', async () => {
    let attempt = 0
    mockFetch(async () => {
      attempt++
      if (attempt === 1) return jsonResponse({}, 503)
      return jsonResponse({ ok: true })
    })

    const resultPromise = apiClient.get<{ ok: boolean }>('/api/flaky')

    // Advance past first retry delay
    await vi.advanceTimersByTimeAsync(1_500)

    const result = await resultPromise

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ok).toBe(true)
    }
  })
})
