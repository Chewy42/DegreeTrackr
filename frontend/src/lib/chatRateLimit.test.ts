// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  checkRateLimit,
  sendMessage,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type MessageRecord,
} from './chatRateLimit'

const USER = 'user-alice'
const OTHER = 'user-bob'
const NOW = 1_700_000_000_000

function makeMessages(count: number, userId: string, startTs = NOW - 1000): MessageRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    userId,
    timestamp: startTs + i * 100,
  }))
}

describe('checkRateLimit', () => {
  it('allows when no messages exist', () => {
    const { allowed, count } = checkRateLimit([], USER, NOW)
    expect(allowed).toBe(true)
    expect(count).toBe(0)
  })

  it(`allows when count is below ${RATE_LIMIT_MAX}`, () => {
    const msgs = makeMessages(RATE_LIMIT_MAX - 1, USER)
    const { allowed } = checkRateLimit(msgs, USER, NOW)
    expect(allowed).toBe(true)
  })

  it(`blocks at exactly ${RATE_LIMIT_MAX} messages`, () => {
    const msgs = makeMessages(RATE_LIMIT_MAX, USER)
    const { allowed } = checkRateLimit(msgs, USER, NOW)
    expect(allowed).toBe(false)
  })

  it('only counts messages within the window', () => {
    const oldMsg = { userId: USER, timestamp: NOW - RATE_LIMIT_WINDOW_MS - 1 }
    const recentMsgs = makeMessages(RATE_LIMIT_MAX - 1, USER)
    const { allowed, count } = checkRateLimit([oldMsg, ...recentMsgs], USER, NOW)
    expect(allowed).toBe(true)
    expect(count).toBe(RATE_LIMIT_MAX - 1)
  })

  it('does not count messages from other users', () => {
    const otherMsgs = makeMessages(RATE_LIMIT_MAX, OTHER)
    const { allowed } = checkRateLimit(otherMsgs, USER, NOW)
    expect(allowed).toBe(true)
  })

  it('returns correct count', () => {
    const msgs = makeMessages(5, USER)
    const { count } = checkRateLimit(msgs, USER, NOW)
    expect(count).toBe(5)
  })
})

describe('sendMessage', () => {
  it('appends a message when allowed', () => {
    const msgs = makeMessages(1, USER)
    const result = sendMessage(msgs, USER, NOW)
    expect(result).toHaveLength(2)
    expect(result[result.length - 1]).toEqual({ userId: USER, timestamp: NOW })
  })

  it('does not mutate the original array', () => {
    const msgs = makeMessages(1, USER)
    const original = [...msgs]
    sendMessage(msgs, USER, NOW)
    expect(msgs).toEqual(original)
  })

  it('throws when rate limit exceeded', () => {
    const msgs = makeMessages(RATE_LIMIT_MAX, USER)
    expect(() => sendMessage(msgs, USER, NOW)).toThrow(/rate limit/i)
  })

  it('allows a different user to send when first user is at limit', () => {
    const msgs = makeMessages(RATE_LIMIT_MAX, USER)
    expect(() => sendMessage(msgs, OTHER, NOW)).not.toThrow()
  })
})
