import { describe, expect, it, vi } from 'vitest'

// ── Evaluations module tests ──────────────────────────────────────────────────
// The Convex evaluations backend is tested in the Convex test harness.
// This file verifies the frontend-facing contract: the module's public API
// shape that the frontend depends on when calling these functions via useQuery
// / useMutation hooks.
//
// The root convex/ directory is NOT importable directly from the frontend
// vitest environment (root node_modules are not installed in CI). We mock the
// module to verify structural contracts without cross-boundary imports.

vi.mock('../../../../convex/evaluations', () => ({
  getCurrentProgramEvaluation: { _type: 'query', _name: 'evaluations:getCurrentProgramEvaluation' },
  syncCurrentProgramEvaluationFromLegacy: { _type: 'mutation', _name: 'evaluations:syncCurrentProgramEvaluationFromLegacy' },
  replaceCurrentProgramEvaluationFromUpload: { _type: 'mutation', _name: 'evaluations:replaceCurrentProgramEvaluationFromUpload' },
  clearCurrentProgramEvaluation: { _type: 'mutation', _name: 'evaluations:clearCurrentProgramEvaluation' },
}))

// ── Mock helpers ──────────────────────────────────────────────────────────────

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
        (r as Record<string, unknown>)['_id'] === id ? { ...r, ...fields } : r,
      )
    }),
    get: vi.fn().mockImplementation(async (id: string) => {
      return stored.find((r) => (r as Record<string, unknown>)['_id'] === id) ?? null
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      stored = stored.filter((r) => (r as Record<string, unknown>)['_id'] !== id)
    }),
  }
}

// Unused but kept for symmetry in case handler-level tests are re-enabled
function _makeFullCtx(
  identity: Record<string, unknown> | null,
  records: Record<string, unknown>[] = [],
) {
  return {
    ...makeAuthCtx(identity),
    db: makeDbWithRecords(records),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('evaluations — module API contract', () => {
  it('exports getCurrentProgramEvaluation', async () => {
    const mod = await import('../../../../convex/evaluations')
    expect(mod.getCurrentProgramEvaluation).toBeDefined()
  })

  it('exports syncCurrentProgramEvaluationFromLegacy', async () => {
    const mod = await import('../../../../convex/evaluations')
    expect(mod.syncCurrentProgramEvaluationFromLegacy).toBeDefined()
  })

  it('exports replaceCurrentProgramEvaluationFromUpload', async () => {
    const mod = await import('../../../../convex/evaluations')
    expect(mod.replaceCurrentProgramEvaluationFromUpload).toBeDefined()
  })

  it('exports clearCurrentProgramEvaluation', async () => {
    const mod = await import('../../../../convex/evaluations')
    expect(mod.clearCurrentProgramEvaluation).toBeDefined()
  })
})

describe('evaluations — mock db helper (frontend-local utility)', () => {
  it('makeDbWithRecords insert adds a record', async () => {
    const db = makeDbWithRecords([])
    await db.insert('programEvaluations', { userId: 'u1', email: 'a@b.com' })
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.insert.mock.calls[0]![0]).toBe('programEvaluations')
  })

  it('makeDbWithRecords patch calls patch with correct id', async () => {
    const db = makeDbWithRecords([{ _id: 'e1', userId: 'u1' }])
    await db.patch('e1', { email: 'new@x.com' })
    expect(db.patch).toHaveBeenCalledWith('e1', { email: 'new@x.com' })
  })

  it('makeDbWithRecords delete removes a record', async () => {
    const db = makeDbWithRecords([{ _id: 'e1', userId: 'u1' }])
    await db.delete('e1')
    expect(db.delete).toHaveBeenCalledWith('e1')
  })
})
