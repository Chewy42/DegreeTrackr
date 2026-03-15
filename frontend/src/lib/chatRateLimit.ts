// Pure chat rate-limit logic extracted from convex/chat.ts for testability.

export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX = 10

export type MessageRecord = { userId: string; timestamp: number }

export function checkRateLimit(
  messages: MessageRecord[],
  userId: string,
  now: number,
): { allowed: boolean; count: number } {
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const recentCount = messages.filter(
    (m) => m.userId === userId && m.timestamp >= windowStart,
  ).length
  return { allowed: recentCount < RATE_LIMIT_MAX, count: recentCount }
}

export function sendMessage(
  messages: MessageRecord[],
  userId: string,
  now: number,
): MessageRecord[] {
  const { allowed } = checkRateLimit(messages, userId, now)
  if (!allowed) {
    throw new Error('Rate limit exceeded: too many messages. Please wait before sending more.')
  }
  return [...messages, { userId, timestamp: now }]
}
