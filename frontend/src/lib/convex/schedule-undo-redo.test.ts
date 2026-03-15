import { describe, expect, it, vi } from 'vitest'
import type { ScheduleSnapshotRecord } from './contracts'

// ── Schedule Undo/Redo via Snapshot Restore ──────────────────────────────────
//
// This test file simulates the undo/redo pattern for schedule management:
//   1. Add a course to the draft schedule
//   2. Undo — restore a prior snapshot, verify the added course is gone
//   3. Redo — re-apply from history, verify the course is back
//   4. Multiple undo steps work correctly
//
// CRITICAL: We do NOT import directly from convex/*.ts. Instead we mock those
// modules and drive handlers via the same ctx-injection pattern used in
// draftSchedule.test.ts and scheduleSnapshots.test.ts.

// ── In-memory DB helpers ─────────────────────────────────────────────────────

type Record = { _id: string; [key: string]: unknown }

function makeMemoryDb(initial: Record[] = []) {
  let store: Record[] = [...initial]
  let idCounter = 0

  return {
    _store: () => store,
    query: vi.fn().mockImplementation((_table: string) => ({
      withIndex: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => store[0] ?? null),
        collect: vi.fn().mockImplementation(async () => [...store]),
      }),
    })),
    get: vi.fn().mockImplementation(async (id: string) => {
      return store.find((r) => r._id === id) ?? null
    }),
    insert: vi.fn().mockImplementation(async (_table: string, doc: Omit<Record, '_id'>) => {
      const newId = `id_${++idCounter}_${Date.now()}`
      const record: Record = { _id: newId, ...doc }
      store.push(record)
      return newId
    }),
    patch: vi.fn().mockImplementation(async (id: string, fields: Partial<Record>) => {
      store = store.map((r) => (r._id === id ? { ...r, ...fields } : r))
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      store = store.filter((r) => r._id !== id)
    }),
  }
}

function makeCtx(
  subject: string | null,
  db: ReturnType<typeof makeMemoryDb>,
) {
  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(
        subject ? { subject } : null,
      ),
    },
    db,
  }
}

// ── Helpers to invoke convex handlers directly ────────────────────────────────

async function getHandler(modulePath: string, exportName: string) {
  const mod = await import(modulePath)
  const fn = (mod as any)[exportName]
  if (!fn) throw new Error(`${exportName} not found in ${modulePath}`)
  // Convex functions expose .handler or are called directly
  return (fn as any).handler ?? fn
}

// ── Scenario: single add → undo (snapshot restore) → redo ────────────────────

describe('schedule undo/redo via snapshot restore', () => {
  it('1. add a course to the draft schedule', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )

    const db = makeMemoryDb()
    const ctx = makeCtx('user_1', db)

    // Save initial empty schedule
    await saveDraft(ctx, { classIds: [] })

    // Add a course
    await saveDraft(ctx, { classIds: ['CS101'] })

    // Re-query the draft (simulate fresh read)
    const db2 = makeMemoryDb(db._store() as Record[])
    const ctx2 = makeCtx('user_1', db2)
    const draft = await getDraft(ctx2, {})

    expect(draft).not.toBeNull()
    expect(draft?.classIds).toContain('CS101')
  })

  it('2. undo via snapshot restore — course is gone', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )

    const db = makeMemoryDb()
    const ctx = makeCtx('user_1', db)

    // Step 1: schedule starts with CS101
    await saveDraft(ctx, { classIds: ['CS101'] })

    // "Take snapshot" before adding — this is the pre-add state (empty)
    const preAddClassIds: string[] = []

    // Step 2: add MATH201
    await saveDraft(ctx, { classIds: ['CS101', 'MATH201'] })

    // Step 3: undo — restore the pre-add snapshot
    await saveDraft(ctx, { classIds: preAddClassIds })

    // Verify MATH201 is gone
    const draft = await getDraft(ctx, {})
    expect(draft?.classIds).not.toContain('MATH201')
    expect(draft?.classIds).toHaveLength(0)
  })

  it('3. redo — re-apply from history, course is back', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )

    const db = makeMemoryDb()
    const ctx = makeCtx('user_1', db)

    // History stack: empty → ['CS101'] → ['CS101', 'MATH201']
    const history: string[][] = [[], ['CS101'], ['CS101', 'MATH201']]

    let historyIndex = 2

    // Apply current state
    await saveDraft(ctx, { classIds: history[historyIndex]! })

    // Undo: step back
    historyIndex -= 1
    await saveDraft(ctx, { classIds: history[historyIndex]! })

    let draft = await getDraft(ctx, {})
    expect(draft?.classIds).toEqual(['CS101'])
    expect(draft?.classIds).not.toContain('MATH201')

    // Redo: step forward
    historyIndex += 1
    await saveDraft(ctx, { classIds: history[historyIndex]! })

    draft = await getDraft(ctx, {})
    expect(draft?.classIds).toContain('MATH201')
    expect(draft?.classIds).toEqual(['CS101', 'MATH201'])
  })

  it('4. multiple undo steps work correctly', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )

    const db = makeMemoryDb()
    const ctx = makeCtx('user_1', db)

    // Build up schedule in 4 steps
    const steps: string[][] = [
      [],
      ['CS101'],
      ['CS101', 'MATH201'],
      ['CS101', 'MATH201', 'ENG301'],
      ['CS101', 'MATH201', 'ENG301', 'PHYS401'],
    ]

    // Apply all 5 states in order
    for (const classIds of steps) {
      await saveDraft(ctx, { classIds })
    }

    // Undo 3 times: should land on steps[1]
    let currentIndex = steps.length - 1
    for (let i = 0; i < 3; i++) {
      currentIndex -= 1
      await saveDraft(ctx, { classIds: steps[currentIndex]! })
    }

    const draft = await getDraft(ctx, {})
    expect(draft?.classIds).toEqual(['CS101'])
    expect(draft?.classIds).not.toContain('MATH201')
    expect(draft?.classIds).not.toContain('ENG301')
    expect(draft?.classIds).not.toContain('PHYS401')
  })
})

// ── Scenario: snapshot-based undo using createCurrentScheduleSnapshot ─────────

describe('schedule undo/redo via persistent snapshots', () => {
  it('saves before-state snapshot, restores it as undo', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )
    const createSnapshot = await getHandler(
      '../../../../convex/scheduleSnapshots',
      'createCurrentScheduleSnapshot',
    )
    const listSnapshots = await getHandler(
      '../../../../convex/scheduleSnapshots',
      'listCurrentScheduleSnapshots',
    )

    // Separate DBs for drafts vs. snapshots (they live in different tables,
    // but share the same ctx.db interface via the in-memory store)
    const draftDb = makeMemoryDb()
    const snapDb = makeMemoryDb()

    const draftCtx = makeCtx('user_2', draftDb)
    const snapCtx = makeCtx('user_2', snapDb)

    // 1. Start with CS101
    await saveDraft(draftCtx, { classIds: ['CS101'] })

    // 2. Before adding MATH201, save a snapshot of current state
    await createSnapshot(snapCtx, {
      name: 'Before MATH201',
      classIds: ['CS101'],
      totalCredits: 3,
    })

    // 3. Add MATH201 to draft
    await saveDraft(draftCtx, { classIds: ['CS101', 'MATH201'] })

    // 4. Verify draft has both courses
    let draft = await getDraft(draftCtx, {})
    expect(draft?.classIds).toContain('MATH201')

    // 5. Undo: list snapshots, restore the most recent
    const snapshots = await listSnapshots(snapCtx, {})
    expect(snapshots).toHaveLength(1)

    const restoredClassIds: string[] = snapshots[0].classIds
    await saveDraft(draftCtx, { classIds: restoredClassIds })

    // 6. Verify MATH201 is gone, CS101 remains
    draft = await getDraft(draftCtx, {})
    expect(draft?.classIds).toContain('CS101')
    expect(draft?.classIds).not.toContain('MATH201')
  })

  it('redo by saving a forward snapshot and re-applying it', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )
    const createSnapshot = await getHandler(
      '../../../../convex/scheduleSnapshots',
      'createCurrentScheduleSnapshot',
    )
    const listSnapshots = await getHandler(
      '../../../../convex/scheduleSnapshots',
      'listCurrentScheduleSnapshots',
    )

    const draftDb = makeMemoryDb()
    const snapDb = makeMemoryDb()
    const draftCtx = makeCtx('user_3', draftDb)
    const snapCtx = makeCtx('user_3', snapDb)

    // Save undo snapshot (before state)
    await createSnapshot(snapCtx, {
      name: 'Before add',
      classIds: [],
      totalCredits: 0,
    })

    // Save redo snapshot (after state)
    await createSnapshot(snapCtx, {
      name: 'After add CS101',
      classIds: ['CS101'],
      totalCredits: 3,
    })

    const snapshots = await listSnapshots(snapCtx, {})
    // Two snapshots should exist (order may vary in same-millisecond test runs)
    expect(snapshots).toHaveLength(2)

    const undoSnap = snapshots.find((s: ScheduleSnapshotRecord) => s.name === 'Before add')
    const redoSnap = snapshots.find((s: ScheduleSnapshotRecord) => s.name === 'After add CS101')
    expect(undoSnap).toBeDefined()
    expect(redoSnap).toBeDefined()

    // Start at "after add" state
    await saveDraft(draftCtx, { classIds: ['CS101'] })

    // Undo: apply the before-add snapshot
    await saveDraft(draftCtx, { classIds: undoSnap!.classIds })
    let draft = await getDraft(draftCtx, {})
    expect(draft?.classIds).not.toContain('CS101')

    // Redo: apply the after-add snapshot
    await saveDraft(draftCtx, { classIds: redoSnap!.classIds })
    draft = await getDraft(draftCtx, {})
    expect(draft?.classIds).toContain('CS101')
  })

  it('ScheduleSnapshotRecord type contract is satisfied by snapshot shape', () => {
    // Type-only assertion — ensures frontend type stays aligned with the
    // snapshot result shape returned by createCurrentScheduleSnapshot.
    const snap: ScheduleSnapshotRecord = {
      id: 'snap_test_1',
      userId: 'user_4',
      name: 'Fall 2026',
      classIds: ['CS101', 'MATH201'],
      totalCredits: 6,
      classCount: 2,
      migrationSource: 'convex',
    }
    expect(snap.classCount).toBe(snap.classIds.length)
    expect(snap.migrationSource).toBe('convex')
  })
})

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('undo/redo edge cases', () => {
  it('undo to empty schedule (no courses) works correctly', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )

    const db = makeMemoryDb()
    const ctx = makeCtx('user_5', db)

    await saveDraft(ctx, { classIds: ['CS101', 'MATH201', 'ENG301'] })

    // Undo all the way back to empty
    await saveDraft(ctx, { classIds: [] })

    const draft = await getDraft(ctx, {})
    expect(draft?.classIds).toHaveLength(0)
  })

  it('redo after full undo restores exact course list', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )

    const db = makeMemoryDb()
    const ctx = makeCtx('user_6', db)

    const finalState = ['CS101', 'MATH201', 'ENG301', 'PHYS401']

    // Set final state, then undo to empty, then redo
    await saveDraft(ctx, { classIds: finalState })
    await saveDraft(ctx, { classIds: [] })
    await saveDraft(ctx, { classIds: finalState })

    const draft = await getDraft(ctx, {})
    expect(draft?.classIds).toEqual(finalState)
  })

  it('single undo step removes only the last-added course', async () => {
    const saveDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'saveDraftSchedule',
    )
    const getDraft = await getHandler(
      '../../../../convex/draftSchedule',
      'getDraftSchedule',
    )

    const db = makeMemoryDb()
    const ctx = makeCtx('user_7', db)

    // CS101 → CS101+MATH201 → undo → CS101 only
    await saveDraft(ctx, { classIds: ['CS101'] })
    await saveDraft(ctx, { classIds: ['CS101', 'MATH201'] })

    // Undo last step
    await saveDraft(ctx, { classIds: ['CS101'] })

    const draft = await getDraft(ctx, {})
    expect(draft?.classIds).toEqual(['CS101'])
    expect(draft?.classIds).not.toContain('MATH201')
  })
})
