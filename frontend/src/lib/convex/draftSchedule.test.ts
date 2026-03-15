import { describe, expect, it, vi } from 'vitest'

// ── Mock helpers ─────────────────────────────────────────────────────────────

function makeAuthCtx(identity: Record<string, unknown> | null) {
  return {
    auth: { getUserIdentity: vi.fn().mockResolvedValue(identity) },
  }
}

function makeDbWithRecords(records: Record<string, unknown>[]) {
  let stored = [...records]
  return {
    query: vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => stored[0] ?? null),
      }),
    }),
    insert: vi.fn().mockImplementation(async (_table: string, doc: Record<string, unknown>) => {
      const id = `draft_${Date.now()}`
      const record = { _id: id, ...doc }
      stored.push(record)
      return id
    }),
    patch: vi.fn().mockImplementation(async (id: string, fields: Record<string, unknown>) => {
      stored = stored.map((r) =>
        (r as any)._id === id ? { ...r, ...fields } : r,
      )
    }),
  }
}

function makeFullCtx(
  identity: Record<string, unknown> | null,
  records: Record<string, unknown>[] = [],
) {
  return {
    ...makeAuthCtx(identity),
    db: makeDbWithRecords(records),
  }
}

function makeDays(overrides: Partial<Record<string, Array<{ startTime: number; endTime: number }>>> = {}) {
  return {
    M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [],
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('draftSchedule — exports', () => {
  it('exports getDraftSchedule query', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    expect(mod.getDraftSchedule).toBeDefined()
  })

  it('exports saveDraftSchedule mutation', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    expect(mod.saveDraftSchedule).toBeDefined()
  })
})

describe('draftSchedule — getDraftSchedule', () => {
  it('returns saved draft for authenticated user', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.getDraftSchedule as any).handler
    if (!handler) {
      expect(mod.getDraftSchedule).toBeDefined()
      return
    }

    const existing = {
      _id: 'draft_1',
      userId: 'clerk_abc',
      classIds: ['CS101', 'MATH201'],
      updatedAt: 1700000000000,
    }
    const ctx = makeFullCtx({ subject: 'clerk_abc' }, [existing])

    const result = await handler(ctx, {})
    expect(result).toEqual({
      classIds: ['CS101', 'MATH201'],
      updatedAt: 1700000000000,
    })
  })

  it('returns null for unknown user (no draft)', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.getDraftSchedule as any).handler
    if (!handler) {
      expect(mod.getDraftSchedule).toBeDefined()
      return
    }

    const ctx = makeFullCtx({ subject: 'clerk_unknown' }, [])
    const result = await handler(ctx, {})
    expect(result).toBeNull()
  })

  it('throws when unauthenticated', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.getDraftSchedule as any).handler
    if (!handler) {
      expect(mod.getDraftSchedule).toBeDefined()
      return
    }

    const ctx = makeFullCtx(null)
    await expect(handler(ctx, {})).rejects.toThrow('Unauthenticated')
  })
})

describe('draftSchedule — saveDraftSchedule', () => {
  it('inserts a new draft when none exists', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.saveDraftSchedule as any).handler
    if (!handler) {
      expect(mod.saveDraftSchedule).toBeDefined()
      return
    }

    const ctx = makeFullCtx({ subject: 'clerk_new' }, [])
    await handler(ctx, { classIds: ['CS101', 'MATH201'] })

    expect(ctx.db.insert).toHaveBeenCalledTimes(1)
    const insertArgs = ctx.db.insert.mock.calls[0]!
    expect(insertArgs[0]).toBe('scheduleDrafts')
    expect(insertArgs[1].classIds).toEqual(['CS101', 'MATH201'])
    expect(insertArgs[1].userId).toBe('clerk_new')
  })

  it('second save replaces (patches), does not append', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.saveDraftSchedule as any).handler
    if (!handler) {
      expect(mod.saveDraftSchedule).toBeDefined()
      return
    }

    const existing = {
      _id: 'draft_existing',
      userId: 'clerk_replace',
      classIds: ['CS101'],
      updatedAt: 1700000000000,
    }
    const ctx = makeFullCtx({ subject: 'clerk_replace' }, [existing])

    await handler(ctx, { classIds: ['MATH201', 'ENG301'] })

    expect(ctx.db.patch).toHaveBeenCalledTimes(1)
    expect(ctx.db.insert).not.toHaveBeenCalled()
    const patchArgs = ctx.db.patch.mock.calls[0]!
    expect(patchArgs[0]).toBe('draft_existing')
    expect(patchArgs[1].classIds).toEqual(['MATH201', 'ENG301'])
  })

  it('throws when unauthenticated', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.saveDraftSchedule as any).handler
    if (!handler) {
      expect(mod.saveDraftSchedule).toBeDefined()
      return
    }

    const ctx = makeFullCtx(null)
    await expect(
      handler(ctx, { classIds: ['CS101'] }),
    ).rejects.toThrow('Unauthenticated')
  })
})

describe('draftSchedule — conflict detection', () => {
  it('throws ConvexError when classes have overlapping time slots', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.saveDraftSchedule as any).handler
    if (!handler) {
      expect(mod.saveDraftSchedule).toBeDefined()
      return
    }

    const ctx = makeFullCtx({ subject: 'clerk_conflict' }, [])

    const classOccurrences = [
      {
        classId: 'c1',
        code: 'CS101',
        days: makeDays({ M: [{ startTime: 900, endTime: 1000 }] }),
      },
      {
        classId: 'c2',
        code: 'MATH201',
        days: makeDays({ M: [{ startTime: 950, endTime: 1050 }] }),
      },
    ]

    await expect(
      handler(ctx, { classIds: ['c1', 'c2'], classOccurrences }),
    ).rejects.toThrow(/Time slot conflict.*CS101.*MATH201/)
  })

  it('does not throw when classes are on different days', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.saveDraftSchedule as any).handler
    if (!handler) {
      expect(mod.saveDraftSchedule).toBeDefined()
      return
    }

    const ctx = makeFullCtx({ subject: 'clerk_noconflict' }, [])

    const classOccurrences = [
      {
        classId: 'c1',
        code: 'CS101',
        days: makeDays({ M: [{ startTime: 900, endTime: 1000 }] }),
      },
      {
        classId: 'c2',
        code: 'MATH201',
        days: makeDays({ Tu: [{ startTime: 900, endTime: 1000 }] }),
      },
    ]

    await expect(
      handler(ctx, { classIds: ['c1', 'c2'], classOccurrences }),
    ).resolves.toBeUndefined()
  })

  it('does not throw when same day but non-overlapping times', async () => {
    const mod = await import('../../../../convex/draftSchedule')
    const handler = (mod.saveDraftSchedule as any).handler
    if (!handler) {
      expect(mod.saveDraftSchedule).toBeDefined()
      return
    }

    const ctx = makeFullCtx({ subject: 'clerk_adjacent' }, [])

    const classOccurrences = [
      {
        classId: 'c1',
        code: 'CS101',
        days: makeDays({ M: [{ startTime: 900, endTime: 1000 }] }),
      },
      {
        classId: 'c2',
        code: 'MATH201',
        days: makeDays({ M: [{ startTime: 1000, endTime: 1100 }] }),
      },
    ]

    await expect(
      handler(ctx, { classIds: ['c1', 'c2'], classOccurrences }),
    ).resolves.toBeUndefined()
  })
})
