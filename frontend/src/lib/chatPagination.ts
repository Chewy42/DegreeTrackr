// Pure chat message pagination logic for testability.

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
}

export type PaginatedResult = {
  messages: ChatMessage[]
  hasMore: boolean
  cursor: number
}

const DEFAULT_PAGE_SIZE = 20

/**
 * Paginate a full message list (newest-first) with cursor-based pagination.
 * cursor = 0 means first page. Each subsequent call passes the previous cursor + pageSize.
 */
export function paginateMessages(
  allMessages: ChatMessage[],
  cursor: number = 0,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PaginatedResult {
  // Sort newest-first
  const sorted = [...allMessages].sort((a, b) => b.createdAt - a.createdAt)
  const page = sorted.slice(cursor, cursor + pageSize)
  return {
    messages: page,
    hasMore: cursor + pageSize < sorted.length,
    cursor: cursor + pageSize,
  }
}

/**
 * Fetch the next page given a previous paginated result's cursor.
 */
export function fetchNextPage(
  allMessages: ChatMessage[],
  previousCursor: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PaginatedResult {
  return paginateMessages(allMessages, previousCursor, pageSize)
}
