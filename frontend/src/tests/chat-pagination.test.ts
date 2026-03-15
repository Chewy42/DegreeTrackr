import { beforeEach, describe, expect, it } from 'vitest'
import {
  type ChatMessage,
  fetchNextPage,
  paginateMessages,
} from '../lib/chatPagination'

function makeMessage(index: number): ChatMessage {
  return {
    id: `msg-${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${index}`,
    createdAt: 1700000000000 + index * 1000,
  }
}

describe('Chat message pagination — DT165', () => {
  let messages5: ChatMessage[]
  let messages25: ChatMessage[]

  beforeEach(() => {
    messages5 = Array.from({ length: 5 }, (_, i) => makeMessage(i))
    messages25 = Array.from({ length: 25 }, (_, i) => makeMessage(i))
  })

  it('5 messages → all returned in one page', () => {
    const result = paginateMessages(messages5)
    expect(result.messages).toHaveLength(5)
    expect(result.hasMore).toBe(false)
  })

  it('25 messages → first page returns 20, hasMore true', () => {
    const result = paginateMessages(messages25)
    expect(result.messages).toHaveLength(20)
    expect(result.hasMore).toBe(true)
  })

  it('fetchNextPage returns remaining 5 messages after first page of 25', () => {
    const first = paginateMessages(messages25)
    const second = fetchNextPage(messages25, first.cursor)
    expect(second.messages).toHaveLength(5)
    expect(second.hasMore).toBe(false)
  })

  it('messages returned in newest-first order', () => {
    const result = paginateMessages(messages25)
    for (let i = 1; i < result.messages.length; i++) {
      expect(result.messages[i].createdAt).toBeLessThan(result.messages[i - 1].createdAt)
    }
  })

  it('empty history → empty array, no crash', () => {
    const result = paginateMessages([])
    expect(result.messages).toHaveLength(0)
    expect(result.hasMore).toBe(false)
  })
})
