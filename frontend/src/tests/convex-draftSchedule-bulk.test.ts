import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexError } from 'convex/values'

// ── Mock Convex db + auth ctx builder ──────────────────────────────────────

type ScheduleDraftRecord = {
  _id: string
  userId: string
  classIds: string[]
  updatedAt: number
}

function buildMockCtx(options: {
  identity: { subject: string } | null
  drafts?: ScheduleDraftRecord[]
}) {
  const drafts = options.drafts ?? []

  const queryChain = (table: string) => {
    const items = table === 'scheduleDrafts' ? drafts : []
    return {
      withIndex: (_indexName: string, filterFn?: (q: any) => any) => {
        let filtered = [...items]
        if (filterFn) {
          const constraints: Record<string, unknown> = {}
          const q = new Proxy(
            {},
            {
              get: (_target, prop) => {
                return (field: string, value?: unknown) => {
                  if (prop === 'eq') constraints[field] = value
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
      get: async (id: string) => drafts.find((d) => d._id === id) ?? null,
      insert: vi.fn().mockResolvedValue('new-draft-id'),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const EMPTY_DAYS = { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [] }

function makeOccurrence(
  classId: string,
  code: string,
  daySlots: Partial<Record<string, Array<{ startTime: number; endTime: number }>>> = {},
) {
  return { classId, code, days: { ...EMPTY_DAYS, ...daySlots } }
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('convex/draftSchedule bulk add/clear/re-add/overlap', () => {
  const CLERK_SUBJECT = 'clerk|user-42'
  const NOW = 1700000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  async function getHandlers() {
    const mod = await import('../../../convex/draftSchedule')
    return {
      getDraftSchedule: (mod.getDraftSchedule as any)._handler,
      saveDraftSchedule: (mod.saveDraftSchedule as any)._handler,
    }
  }

  it('bulk add 5 courses → getDraftSchedule returns all 5', async () => {
    const { saveDraftSchedule, getDraftSchedule } = await getHandlers()

    const ids = ['CS101', 'CS201', 'MATH150', 'ENG100', 'PHYS110']

    // Start with empty state — insert will be called
    const ctx = buildMockCtx({ identity: { subject: CLERK_SUBJECT }, drafts: [] })

    // Simulate incremental adds: each save includes all previously added ids
    for (let i = 0; i < ids.length; i++) {
      const batch = ids.slice(0, i + 1)
      await saveDraftSchedule(ctx, { classIds: batch })
    }

    // After the first call inserted, subsequent calls would find the record.
    // The final save should have all 5 ids.
    // Verify the final patch/insert was called with all 5 classIds
    const lastCall = ctx.db.patch.mock.calls.length > 0
      ? ctx.db.patch.mock.calls[ctx.db.patch.mock.calls.length - 1]
      : null

    if (lastCall) {
      expect(lastCall[1].classIds).toEqual(ids)
    } else {
      // All went through insert (first call), remaining would need existing record
      const insertCalls = ctx.db.insert.mock.calls
      const lastInsert = insertCalls[insertCalls.length - 1]
      expect(lastInsert[1].classIds).toEqual(ids)
    }

    // Verify getDraftSchedule with populated state
    const ctxWithData = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      drafts: [{ _id: 'draft-1', userId: CLERK_SUBJECT, classIds: ids, updatedAt: NOW }],
    })
    const result = await getDraftSchedule(ctxWithData, {})
    expect(result).toEqual({ classIds: ids, updatedAt: NOW })
    expect(result!.classIds).toHaveLength(5)
  })

  it('clear all → getDraftSchedule returns empty classIds', async () => {
    const { saveDraftSchedule, getDraftSchedule } = await getHandlers()

    // Start with 3 courses in the draft
    const existingDraft: ScheduleDraftRecord = {
      _id: 'draft-1',
      userId: CLERK_SUBJECT,
      classIds: ['CS101', 'CS201', 'MATH150'],
      updatedAt: NOW - 60_000,
    }

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      drafts: [existingDraft],
    })

    // Clear by saving empty classIds
    await saveDraftSchedule(ctx, { classIds: [] })

    expect(ctx.db.patch).toHaveBeenCalledWith('draft-1', {
      classIds: [],
      updatedAt: expect.any(Number),
    })

    // Verify getDraftSchedule with cleared state
    const ctxCleared = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      drafts: [{ _id: 'draft-1', userId: CLERK_SUBJECT, classIds: [], updatedAt: NOW }],
    })
    const result = await getDraftSchedule(ctxCleared, {})
    expect(result).toEqual({ classIds: [], updatedAt: NOW })
  })

  it('re-add after clear → only new courses present, no ghost data', async () => {
    const { saveDraftSchedule, getDraftSchedule } = await getHandlers()

    // State after clear: existing record with empty classIds
    const clearedDraft: ScheduleDraftRecord = {
      _id: 'draft-1',
      userId: CLERK_SUBJECT,
      classIds: [],
      updatedAt: NOW - 30_000,
    }

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      drafts: [clearedDraft],
    })

    // Re-add 2 new courses
    const newIds = ['BIO200', 'CHEM110']
    await saveDraftSchedule(ctx, { classIds: newIds })

    expect(ctx.db.patch).toHaveBeenCalledWith('draft-1', {
      classIds: newIds,
      updatedAt: expect.any(Number),
    })

    // Verify only the 2 new courses are present
    const ctxAfterReAdd = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      drafts: [{ _id: 'draft-1', userId: CLERK_SUBJECT, classIds: newIds, updatedAt: NOW }],
    })
    const result = await getDraftSchedule(ctxAfterReAdd, {})
    expect(result!.classIds).toEqual(['BIO200', 'CHEM110'])
    expect(result!.classIds).toHaveLength(2)
    // No ghost data from previously cleared courses
    expect(result!.classIds).not.toContain('CS101')
    expect(result!.classIds).not.toContain('CS201')
    expect(result!.classIds).not.toContain('MATH150')
  })

  it('overlap check: overlapping course throws ConvexError', async () => {
    const { saveDraftSchedule } = await getHandlers()

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      drafts: [],
    })

    const occurrences = [
      makeOccurrence('c1', 'CS101', { M: [{ startTime: 900, endTime: 1030 }] }),
      makeOccurrence('c2', 'MATH150', { M: [{ startTime: 1000, endTime: 1130 }] }), // overlaps CS101
    ]

    await expect(
      saveDraftSchedule(ctx, {
        classIds: ['c1', 'c2'],
        classOccurrences: occurrences,
      }),
    ).rejects.toThrow('Time slot conflict: CS101 and MATH150 overlap')
  })

  it('overlap check: non-overlapping courses save successfully', async () => {
    const { saveDraftSchedule } = await getHandlers()

    const ctx = buildMockCtx({
      identity: { subject: CLERK_SUBJECT },
      drafts: [],
    })

    const occurrences = [
      makeOccurrence('c1', 'CS101', { M: [{ startTime: 900, endTime: 1030 }] }),
      makeOccurrence('c2', 'MATH150', { M: [{ startTime: 1100, endTime: 1230 }] }), // no overlap
    ]

    await saveDraftSchedule(ctx, {
      classIds: ['c1', 'c2'],
      classOccurrences: occurrences,
    })

    // Should insert without throwing
    expect(ctx.db.insert).toHaveBeenCalledWith('scheduleDrafts', {
      userId: CLERK_SUBJECT,
      classIds: ['c1', 'c2'],
      updatedAt: expect.any(Number),
    })
  })
})
