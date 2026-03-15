import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkRateLimit,
  type MessageRecord,
  RATE_LIMIT_MAX,
  sendMessage,
} from '../lib/chatRateLimit'

describe('Chat rate limit under load — DT150', () => {
  const NOW = 1700000000000
  const USER_A = 'user-a'
  const USER_B = 'user-b'

  let messages: MessageRecord[]

  beforeEach(() => {
    messages = []
  })

  it('send RATE_LIMIT_MAX messages quickly → all succeed', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      messages = sendMessage(messages, USER_A, NOW + i)
    }
    expect(messages).toHaveLength(RATE_LIMIT_MAX)
  })

  it('message after limit → throws rate limit error', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      messages = sendMessage(messages, USER_A, NOW + i)
    }
    expect(() => sendMessage(messages, USER_A, NOW + RATE_LIMIT_MAX)).toThrow(
      'Rate limit exceeded',
    )
  })

  it('error message contains "too many messages"', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      messages = sendMessage(messages, USER_A, NOW + i)
    }
    expect(() => sendMessage(messages, USER_A, NOW + RATE_LIMIT_MAX)).toThrow(
      /too many messages/i,
    )
  })

  it('after limit triggered, count stays at RATE_LIMIT_MAX', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      messages = sendMessage(messages, USER_A, NOW + i)
    }
    try {
      sendMessage(messages, USER_A, NOW + RATE_LIMIT_MAX)
    } catch {
      /* expected */
    }
    const { count } = checkRateLimit(messages, USER_A, NOW + RATE_LIMIT_MAX)
    expect(count).toBe(RATE_LIMIT_MAX)
    expect(messages).toHaveLength(RATE_LIMIT_MAX)
  })

  it('different userId → separate bucket (user B succeeds after A is limited)', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      messages = sendMessage(messages, USER_A, NOW + i)
    }
    // User A is at the limit
    expect(() => sendMessage(messages, USER_A, NOW + RATE_LIMIT_MAX)).toThrow()
    // User B should still be allowed
    messages = sendMessage(messages, USER_B, NOW + RATE_LIMIT_MAX)
    expect(messages.filter((m) => m.userId === USER_B)).toHaveLength(1)
  })
})
