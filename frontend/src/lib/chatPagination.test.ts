// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { paginateMessages, fetchNextPage, type ChatMessage } from './chatPagination'

// ─── Fixtures ────────────────────────────────────────────────────

function makeMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i + 1}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${i + 1}`,
    createdAt: i + 1, // ascending timestamps so newest-first sort is predictable
  }))
}

describe('paginateMessages', () => {
  it('returns empty result for empty messages array', () => {
    const result = paginateMessages([])
    expect(result.messages).toHaveLength(0)
    expect(result.hasMore).toBe(false)
  })

  it('returns single message for single-message array', () => {
    const msgs = makeMessages(1)
    const result = paginateMessages(msgs)
    expect(result.messages).toHaveLength(1)
    expect(result.hasMore).toBe(false)
  })

  it('returns first page of 20 from 25 messages', () => {
    const msgs = makeMessages(25)
    const result = paginateMessages(msgs)
    expect(result.messages).toHaveLength(20)
    expect(result.hasMore).toBe(true)
  })

  it('returns remaining 5 messages on second page', () => {
    const msgs = makeMessages(25)
    const first = paginateMessages(msgs, 0, 20)
    const second = paginateMessages(msgs, first.cursor, 20)
    expect(second.messages).toHaveLength(5)
    expect(second.hasMore).toBe(false)
  })

  it('cursor advances by pageSize', () => {
    const msgs = makeMessages(25)
    const result = paginateMessages(msgs, 0, 20)
    expect(result.cursor).toBe(20)
  })

  it('sorts messages newest-first (highest createdAt first)', () => {
    const msgs = makeMessages(5)
    const result = paginateMessages(msgs)
    const timestamps = result.messages.map(m => m.createdAt)
    expect(timestamps[0]).toBeGreaterThan(timestamps[1])
    expect(timestamps[1]).toBeGreaterThan(timestamps[2])
  })

  it('hasMore is false when all messages fit on one page', () => {
    const msgs = makeMessages(10)
    const result = paginateMessages(msgs, 0, 20)
    expect(result.hasMore).toBe(false)
  })

  it('hasMore is true when more messages remain', () => {
    const msgs = makeMessages(21)
    const result = paginateMessages(msgs, 0, 20)
    expect(result.hasMore).toBe(true)
  })

  it('uses custom pageSize correctly', () => {
    const msgs = makeMessages(10)
    const result = paginateMessages(msgs, 0, 3)
    expect(result.messages).toHaveLength(3)
    expect(result.hasMore).toBe(true)
  })

  it('returns empty messages when cursor is past end', () => {
    const msgs = makeMessages(5)
    const result = paginateMessages(msgs, 10, 20)
    expect(result.messages).toHaveLength(0)
    expect(result.hasMore).toBe(false)
  })
})

describe('fetchNextPage', () => {
  it('fetches next page from previous cursor', () => {
    const msgs = makeMessages(25)
    const second = fetchNextPage(msgs, 20)
    expect(second.messages).toHaveLength(5)
    expect(second.hasMore).toBe(false)
  })

  it('cursor from fetchNextPage points to next page start', () => {
    const msgs = makeMessages(50)
    const page2 = fetchNextPage(msgs, 20) // cursor=20 → returns msgs[20-39]
    expect(page2.cursor).toBe(40)
    expect(page2.messages).toHaveLength(20)
    expect(page2.hasMore).toBe(true)
  })

  it('returns empty for cursor at end', () => {
    const msgs = makeMessages(20)
    const result = fetchNextPage(msgs, 20)
    expect(result.messages).toHaveLength(0)
    expect(result.hasMore).toBe(false)
  })
})
