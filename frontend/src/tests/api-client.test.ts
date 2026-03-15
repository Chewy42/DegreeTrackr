import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../lib/apiClient'

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('apiClient GET — DT195', () => {
  it('returns correct response data on successful GET', async () => {
    mockFetch(async () => jsonResponse({ items: [1, 2, 3] }))

    const result = await apiClient.get<{ items: number[] }>('/api/items')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items).toEqual([1, 2, 3])
    }
  })
})

describe('apiClient POST — DT195', () => {
  it('sends correct body and returns response', async () => {
    mockFetch(async (_url: string, opts: RequestInit) => {
      const sent = JSON.parse(opts.body as string)
      return jsonResponse({ received: sent })
    })

    const body = { name: 'CS101', credits: 3 }
    const result = await apiClient.post<{ received: typeof body }>('/api/courses', body)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.received).toEqual(body)
    }
    expect((globalThis.fetch as any).mock.calls[0][1].method).toBe('POST')
  })
})

describe('apiClient network error — DT195', () => {
  it('returns error state on network failure', async () => {
    mockFetch(async () => { throw new TypeError('Failed to fetch') })

    const resultPromise = apiClient.get('/api/down')

    // Advance past retry delays: 1s + 2s + 4s
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000 + 1_000)

    const result = await resultPromise

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Failed to fetch')
    }
  })
})

describe('apiClient 401 — DT195', () => {
  it('returns auth error with shouldSignOut on 401', async () => {
    mockFetch(async () => jsonResponse({ error: 'Session expired' }, 401))

    const result = await apiClient.get('/api/protected', 'stale-token')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.status).toBe(401)
      expect(result.shouldSignOut).toBe(true)
      expect(result.error).toBe('Session expired')
    }
  })
})
