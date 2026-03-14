import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockGetConvexClient = vi.fn()

vi.mock('./convex/client', () => ({
  getConvexClient: () => mockGetConvexClient(),
}))

vi.mock('./convex/api', () => ({
  convexApi: {
    scheduleSnapshots: {
      createCurrentScheduleSnapshot: 'scheduleSnapshots:createCurrentScheduleSnapshot',
      listCurrentScheduleSnapshots: 'scheduleSnapshots:listCurrentScheduleSnapshots',
      deleteCurrentScheduleSnapshot: 'scheduleSnapshots:deleteCurrentScheduleSnapshot',
    },
  },
}))

import {
  createScheduleSnapshot,
  deleteScheduleSnapshot,
  listScheduleSnapshots,
} from './scheduleApi'

describe('schedule snapshot helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails clearly when Convex is unavailable', async () => {
    mockGetConvexClient.mockReturnValue(null)

    await expect(createScheduleSnapshot('Fall Plan', ['MATH-101'], 3, 'ignored')).rejects.toThrow(
      'Schedule snapshots require Convex and are unavailable in legacy mode.',
    )
    await expect(listScheduleSnapshots('ignored')).rejects.toThrow(
      'Schedule snapshots require Convex and are unavailable in legacy mode.',
    )
    await expect(deleteScheduleSnapshot('snapshot-1', 'ignored')).rejects.toThrow(
      'Schedule snapshots require Convex and are unavailable in legacy mode.',
    )
  })

  it('uses Convex for snapshot CRUD operations', async () => {
    const mutation = vi.fn()
    const query = vi.fn()

    mockGetConvexClient.mockReturnValue({ mutation, query })

    mutation.mockResolvedValueOnce({
      id: 'snapshot-1',
      userId: 'user-1',
      name: 'Fall Plan',
      classIds: ['MATH-101'],
      totalCredits: 3,
      classCount: 1,
      createdAt: Date.UTC(2026, 2, 11),
      migrationSource: 'convex',
    })
    query.mockResolvedValueOnce([
      {
        id: 'snapshot-1',
        userId: 'user-1',
        name: 'Fall Plan',
        classIds: ['MATH-101'],
        totalCredits: 3,
        classCount: 1,
        createdAt: Date.UTC(2026, 2, 11),
        migrationSource: 'convex',
      },
    ])
    mutation.mockResolvedValueOnce(undefined)

    const created = await createScheduleSnapshot('Fall Plan', ['MATH-101'], 3, 'ignored')
    const listed = await listScheduleSnapshots('ignored')
    await deleteScheduleSnapshot('snapshot-1', 'ignored')

    expect(created).toMatchObject({
      id: 'snapshot-1',
      name: 'Fall Plan',
      classIds: ['MATH-101'],
      totalCredits: 3,
      classCount: 1,
    })
    expect(listed).toHaveLength(1)
    expect(query).toHaveBeenCalledWith('scheduleSnapshots:listCurrentScheduleSnapshots', {})
    expect(mutation).toHaveBeenNthCalledWith(1, 'scheduleSnapshots:createCurrentScheduleSnapshot', {
      name: 'Fall Plan',
      classIds: ['MATH-101'],
      totalCredits: 3,
    })
    expect(mutation).toHaveBeenNthCalledWith(2, 'scheduleSnapshots:deleteCurrentScheduleSnapshot', {
      id: 'snapshot-1',
    })
  })
})
