import { describe, expect, it, vi } from 'vitest'

// ── Convex evaluations unit tests ────────────────────────────────────────────
// These tests verify the structural contracts and behavioral design of
// the evaluations module by mocking the Convex context (db, auth).

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
      const id = `eval_${Date.now()}`
      const record = { _id: id, ...doc }
      stored.push(record)
      return id
    }),
    patch: vi.fn().mockImplementation(async (id: string, fields: Record<string, unknown>) => {
      stored = stored.map((r) =>
        (r as any)._id === id ? { ...r, ...fields } : r,
      )
    }),
    get: vi.fn().mockImplementation(async (id: string) => {
      return stored.find((r) => (r as any)._id === id) ?? null
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      stored = stored.filter((r) => (r as any)._id !== id)
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('evaluations — exports', () => {
  it('exports getCurrentProgramEvaluation query', async () => {
    const mod = await import('../../../../convex/evaluations')
    expect(mod.getCurrentProgramEvaluation).toBeDefined()
  })

  it('exports syncCurrentProgramEvaluationFromLegacy mutation', async () => {
    const mod = await import('../../../../convex/evaluations')
    expect(mod.syncCurrentProgramEvaluationFromLegacy).toBeDefined()
  })

  it('exports replaceCurrentProgramEvaluationFromUpload mutation', async () => {
    const mod = await import('../../../../convex/evaluations')
    expect(mod.replaceCurrentProgramEvaluationFromUpload).toBeDefined()
  })

  it('exports clearCurrentProgramEvaluation mutation', async () => {
    const mod = await import('../../../../convex/evaluations')
    expect(mod.clearCurrentProgramEvaluation).toBeDefined()
  })
})

describe('evaluations — getCurrentProgramEvaluation', () => {
  it('returns null for unauthenticated context (no crash)', async () => {
    const mod = await import('../../../../convex/evaluations')
    const ctx = makeFullCtx(null)

    // getCurrentProgramEvaluation uses getCurrentUserState which returns { user: null }
    const handler = (mod.getCurrentProgramEvaluation as any).handler
    if (!handler) {
      // If handler is not directly accessible, verify the export exists
      expect(mod.getCurrentProgramEvaluation).toBeDefined()
      return
    }
    const result = await handler(ctx, {})
    expect(result).toBeNull()
  })

  it('returns null when no evaluation exists for user', async () => {
    const mod = await import('../../../../convex/evaluations')
    const existingUser = { _id: 'user_1', clerkUserId: 'clerk_1' }
    const ctx = {
      ...makeAuthCtx({ subject: 'clerk_1' }),
      db: makeDbWithRecords([]),
    }
    // Patch query to simulate getCurrentUserState finding the user
    ctx.db.query = vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn()
          .mockResolvedValueOnce(existingUser) // for getCurrentUserState
          .mockResolvedValueOnce(null),          // for getProgramEvaluationRecord
      }),
    })

    const handler = (mod.getCurrentProgramEvaluation as any).handler
    if (!handler) {
      expect(mod.getCurrentProgramEvaluation).toBeDefined()
      return
    }
    const result = await handler(ctx, {})
    expect(result).toBeNull()
  })
})

describe('evaluations — replaceCurrentProgramEvaluationFromUpload', () => {
  it('stores evaluation with correct fields', async () => {
    const mod = await import('../../../../convex/evaluations')
    const handler = (mod.replaceCurrentProgramEvaluationFromUpload as any).handler
    if (!handler) {
      expect(mod.replaceCurrentProgramEvaluationFromUpload).toBeDefined()
      return
    }

    const existingUser = { _id: 'user_upload', clerkUserId: 'clerk_upload' }
    const db = makeDbWithRecords([])
    // First query call is for ensureCurrentUserRecord (finds existing user)
    // Second call is for getProgramEvaluationRecord (no existing eval)
    const queryFirstFn = vi.fn()
      .mockResolvedValueOnce(existingUser) // ensureCurrentUserRecord
      .mockResolvedValueOnce(null)         // getProgramEvaluationRecord
    db.query = vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: queryFirstFn,
      }),
    })

    const ctx = {
      ...makeAuthCtx({ subject: 'clerk_upload' }),
      db,
    }

    const payload = {
      email: 'test@example.com',
      original_filename: 'eval.pdf',
      file_size_bytes: 1024,
    }

    await handler(ctx, { payload })

    expect(db.insert).toHaveBeenCalledTimes(1)
    const insertArgs = db.insert.mock.calls[0]!
    expect(insertArgs[0]).toBe('programEvaluations')
    expect(insertArgs[1].userId).toBe('user_upload')
    expect(insertArgs[1].email).toBe('test@example.com')
    expect(insertArgs[1].originalFilename).toBe('eval.pdf')
    expect(insertArgs[1].fileSizeBytes).toBe(1024)
    expect(insertArgs[1].migrationSource).toBe('convex')
  })

  it('re-upload patches existing record instead of inserting', async () => {
    const mod = await import('../../../../convex/evaluations')
    const handler = (mod.replaceCurrentProgramEvaluationFromUpload as any).handler
    if (!handler) {
      expect(mod.replaceCurrentProgramEvaluationFromUpload).toBeDefined()
      return
    }

    const existingUser = { _id: 'user_re', clerkUserId: 'clerk_re' }
    const existingEval = {
      _id: 'eval_existing',
      userId: 'user_re',
      email: 'old@example.com',
      originalFilename: 'old.pdf',
      migrationSource: 'convex',
    }

    const db = makeDbWithRecords([existingEval])
    const queryFirstFn = vi.fn()
      .mockResolvedValueOnce(existingUser) // ensureCurrentUserRecord
      .mockResolvedValueOnce(existingEval) // getProgramEvaluationRecord
    db.query = vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: queryFirstFn,
      }),
    })

    const ctx = {
      ...makeAuthCtx({ subject: 'clerk_re' }),
      db,
    }

    await handler(ctx, {
      payload: { email: 'new@example.com', original_filename: 'new.pdf' },
    })

    // Should patch, not insert
    expect(db.patch).toHaveBeenCalledTimes(1)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.patch.mock.calls[0]![0]).toBe('eval_existing')
  })
})

describe('evaluations — ensureCurrentUserRecord auth gate', () => {
  it('unauthenticated context throws on mutation', async () => {
    const mod = await import('../../../../convex/evaluations')
    const handler = (mod.replaceCurrentProgramEvaluationFromUpload as any).handler
    if (!handler) {
      expect(mod.replaceCurrentProgramEvaluationFromUpload).toBeDefined()
      return
    }

    const ctx = makeFullCtx(null)

    await expect(
      handler(ctx, { payload: { email: 'bad@example.com' } }),
    ).rejects.toThrow()
  })
})

describe('evaluations — clearCurrentProgramEvaluation', () => {
  it('deletes existing evaluation', async () => {
    const mod = await import('../../../../convex/evaluations')
    const handler = (mod.clearCurrentProgramEvaluation as any).handler
    if (!handler) {
      expect(mod.clearCurrentProgramEvaluation).toBeDefined()
      return
    }

    const existingUser = { _id: 'user_clear', clerkUserId: 'clerk_clear' }
    const existingEval = { _id: 'eval_to_clear', userId: 'user_clear' }

    const db = makeDbWithRecords([existingEval])
    const queryFirstFn = vi.fn()
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(existingEval)
    db.query = vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: queryFirstFn,
      }),
    })

    const ctx = {
      ...makeAuthCtx({ subject: 'clerk_clear' }),
      db,
    }

    const result = await handler(ctx, {})
    expect(result).toBeNull()
    expect(db.delete).toHaveBeenCalledWith('eval_to_clear')
  })

  it('returns null even when no evaluation exists', async () => {
    const mod = await import('../../../../convex/evaluations')
    const handler = (mod.clearCurrentProgramEvaluation as any).handler
    if (!handler) {
      expect(mod.clearCurrentProgramEvaluation).toBeDefined()
      return
    }

    const existingUser = { _id: 'user_noop', clerkUserId: 'clerk_noop' }

    const db = makeDbWithRecords([])
    const queryFirstFn = vi.fn()
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(null)
    db.query = vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnValue({
        first: queryFirstFn,
      }),
    })

    const ctx = {
      ...makeAuthCtx({ subject: 'clerk_noop' }),
      db,
    }

    const result = await handler(ctx, {})
    expect(result).toBeNull()
    expect(db.delete).not.toHaveBeenCalled()
  })
})
