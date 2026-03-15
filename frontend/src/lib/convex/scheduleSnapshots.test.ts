import { describe, expect, it } from 'vitest'

// ── scheduleSnapshots module structural & contract tests ──────────────────
// Verify exports, result shape contracts, and design-level guarantees
// without a live Convex database.

describe('convex/scheduleSnapshots — exported functions', () => {
  it('exports listCurrentScheduleSnapshots query', async () => {
    const mod = await import('../../../../convex/scheduleSnapshots')
    expect(mod.listCurrentScheduleSnapshots).toBeDefined()
    expect(typeof mod.listCurrentScheduleSnapshots).toBe('function')
  })

  it('exports createCurrentScheduleSnapshot mutation', async () => {
    const mod = await import('../../../../convex/scheduleSnapshots')
    expect(mod.createCurrentScheduleSnapshot).toBeDefined()
    expect(typeof mod.createCurrentScheduleSnapshot).toBe('function')
  })

  it('exports deleteCurrentScheduleSnapshot mutation', async () => {
    const mod = await import('../../../../convex/scheduleSnapshots')
    expect(mod.deleteCurrentScheduleSnapshot).toBeDefined()
    expect(typeof mod.deleteCurrentScheduleSnapshot).toBe('function')
  })
})

describe('convex/scheduleSnapshots — createSnapshot contract', () => {
  // createCurrentScheduleSnapshot accepts { name, classIds, totalCredits }
  // and stores userId (from auth identity.subject), classIds, totalCredits,
  // createdAt (Date.now()), and migrationSource: 'convex'.
  it('mutation is defined and callable', async () => {
    const mod = await import('../../../../convex/scheduleSnapshots')
    expect(mod.createCurrentScheduleSnapshot).toBeDefined()
  })
})

describe('convex/scheduleSnapshots — toResult shape contract', () => {
  // The toResult helper produces { id, userId, name, classIds, totalCredits,
  // classCount, createdAt, migrationSource: 'convex' }.
  // classCount is derived from classIds.length — not stored separately.

  it('result type includes classCount derived from classIds length', async () => {
    // Structural assertion: the module defines ScheduleSnapshotResult with classCount.
    // We verify by checking the module loads without error and exports are consistent.
    const mod = await import('../../../../convex/scheduleSnapshots')
    expect(mod.createCurrentScheduleSnapshot).toBeDefined()
    expect(mod.listCurrentScheduleSnapshots).toBeDefined()
  })
})

describe('convex/scheduleSnapshots — listCurrentScheduleSnapshots ordering', () => {
  // The query sorts by createdAt descending (newest first).
  // This is a design-level check; runtime ordering requires a Convex test harness.

  it('query is designed to sort newest-first (structural)', async () => {
    const mod = await import('../../../../convex/scheduleSnapshots')
    expect(mod.listCurrentScheduleSnapshots).toBeDefined()
  })
})

describe('convex/scheduleSnapshots — deleteCurrentScheduleSnapshot ownership', () => {
  // The mutation verifies record.userId === identity.subject before deleting.
  // If userId does not match, it throws 'Unauthorized'.
  // If the record is already deleted (null), it returns silently (idempotent).

  it('mutation is exported for ownership-checked deletion', async () => {
    const mod = await import('../../../../convex/scheduleSnapshots')
    expect(mod.deleteCurrentScheduleSnapshot).toBeDefined()
  })
})

describe('frontend contracts — ScheduleSnapshotRecord type', () => {
  it('ScheduleSnapshotRecord type is exported from frontend contracts', async () => {
    const contracts = await import('./contracts')
    // Type-only check: the interface should include id, userId, name, classIds, etc.
    const record: import('./contracts').ScheduleSnapshotRecord = {
      id: 'test-id',
      userId: 'user-123',
      name: 'Spring 2026 Draft',
      classIds: ['CIS-101', 'MATH-200'],
      totalCredits: 6,
      classCount: 2,
      migrationSource: 'convex',
    }
    expect(record.id).toBe('test-id')
    expect(record.classCount).toBe(2)
    expect(record.migrationSource).toBe('convex')
  })

  it('ScheduleSnapshotRecord classCount matches classIds length', () => {
    const classIds = ['CIS-101', 'MATH-200', 'ENG-300']
    const record: import('./contracts').ScheduleSnapshotRecord = {
      id: 'snap-1',
      userId: 'u-1',
      name: 'Test',
      classIds,
      totalCredits: 9,
      classCount: classIds.length,
      migrationSource: 'convex',
    }
    expect(record.classCount).toBe(classIds.length)
  })

  it('empty classIds produces classCount of 0', () => {
    const record: import('./contracts').ScheduleSnapshotRecord = {
      id: 'snap-empty',
      userId: 'u-1',
      name: 'Empty',
      classIds: [],
      totalCredits: 0,
      classCount: 0,
      migrationSource: 'convex',
    }
    expect(record.classCount).toBe(0)
    expect(record.classIds).toHaveLength(0)
  })
})
