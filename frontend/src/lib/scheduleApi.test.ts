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
  deriveRequirementsSummaryFromProgramEvaluation,
  validateScheduledClassesLocally,
} from './scheduleApi'

// ── Minimal ClassSection factory for local validation tests ─────────────────

function makeSection(
  id: string,
  code: string,
  credits: number,
  days: Partial<Record<'M' | 'Tu' | 'W' | 'Th' | 'F' | 'Sa' | 'Su', Array<{ startTime: number; endTime: number }>>> = {},
) {
  const daysOccurring = { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [], ...days }
  return {
    id,
    code,
    subject: code.split('-')[0] ?? 'CS',
    number: '101',
    section: '01',
    title: 'Test Course',
    credits,
    displayDays: '',
    displayTime: '',
    location: '',
    professor: '',
    professorRating: null,
    semester: 'fall2026',
    semestersOffered: [] as string[],
    requirementsSatisfied: [],
    occurrenceData: { starts: 0, ends: 0, daysOccurring },
  }
}

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

  it('converts Convex epoch timestamps to ISO strings', async () => {
    const mutation = vi.fn()
    const query = vi.fn()
    mockGetConvexClient.mockReturnValue({ mutation, query })

    const epochMs = Date.UTC(2026, 2, 11) // 2026-03-11T00:00:00.000Z
    mutation.mockResolvedValueOnce({
      id: 'snapshot-ts',
      userId: 'user-1',
      name: 'TS Check',
      classIds: [],
      totalCredits: 0,
      classCount: 0,
      createdAt: epochMs,
      migrationSource: 'convex',
    })

    const created = await createScheduleSnapshot('TS Check', [], 0, 'ignored')
    expect(created.createdAt).toBe(new Date(epochMs).toISOString())
    expect(created.updatedAt).toBe(created.createdAt)
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

// ── deriveRequirementsSummaryFromProgramEvaluation ──────────────────────────

describe('deriveRequirementsSummaryFromProgramEvaluation', () => {
  it('returns null for null input', () => {
    expect(deriveRequirementsSummaryFromProgramEvaluation(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(deriveRequirementsSummaryFromProgramEvaluation(undefined)).toBeNull()
  })

  it('returns null when credit_requirements is not an array', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(deriveRequirementsSummaryFromProgramEvaluation({ parsed_data: { credit_requirements: null } } as any)).toBeNull()
  })

  it('returns empty summary for empty requirements array', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = deriveRequirementsSummaryFromProgramEvaluation({ parsed_data: { credit_requirements: [] } } as any)
    expect(result).toEqual({ total: 0, byType: {}, requirements: [] })
  })

  it('derives totals and byType from valid payload', () => {
    const result = deriveRequirementsSummaryFromProgramEvaluation({
      parsed_data: {
        credit_requirements: [
          { label: 'Major Core', needed: 30 },
          { label: 'Major Elective', needed: 12 },
          { label: 'GE Requirements', needed: 8 },
        ],
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(result).not.toBeNull()
    expect(result!.total).toBe(50)
    expect(result!.byType['major_core']).toBe(30)
    expect(result!.byType['major_elective']).toBe(12)
    expect(result!.byType['ge']).toBe(8)
    expect(result!.requirements).toHaveLength(3)
  })

  it('infers requirement types from labels', () => {
    const result = deriveRequirementsSummaryFromProgramEvaluation({
      parsed_data: {
        credit_requirements: [
          { label: 'Major Core Requirements', needed: 30 },
          { label: 'Major Elective', needed: 12 },
          { label: 'Minor Requirements', needed: 15 },
          { label: 'Concentration Track', needed: 9 },
          { label: 'General Education', needed: 6 },
          { label: 'Other Requirements', needed: 3 },
        ],
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(result!.requirements.map((r) => r.type)).toEqual([
      'major_core', 'major_elective', 'minor', 'concentration', 'ge', 'other',
    ])
  })

  it('skips entries with missing or blank labels', () => {
    const result = deriveRequirementsSummaryFromProgramEvaluation({
      parsed_data: {
        credit_requirements: [
          { label: '   ', needed: 10 },
          null,
          { label: 'Major Core', needed: 30 },
        ],
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(result!.requirements).toHaveLength(1)
    expect(result!.total).toBe(30)
  })

  it('clamps negative needed values to 0', () => {
    const result = deriveRequirementsSummaryFromProgramEvaluation({
      parsed_data: { credit_requirements: [{ label: 'Major Core', needed: -5 }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(result!.requirements[0]!.creditsNeeded).toBe(0)
    expect(result!.total).toBe(0)
  })
})

// ── validateScheduledClassesLocally ─────────────────────────────────────────

describe('validateScheduledClassesLocally', () => {
  it('returns valid for an empty schedule', () => {
    const result = validateScheduledClassesLocally([])
    expect(result.valid).toBe(true)
    expect(result.conflicts).toHaveLength(0)
    expect(result.totalCredits).toBe(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns valid for a single class', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateScheduledClassesLocally([makeSection('MATH-101-01', 'MATH 101', 3, { M: [{ startTime: 540, endTime: 590 }] })] as any[])
    expect(result.valid).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })

  it('returns valid for two classes on different days', () => {
    const a = makeSection('CS-101-01', 'CS 101', 3, { M: [{ startTime: 540, endTime: 590 }] })
    const b = makeSection('CS-102-01', 'CS 102', 3, { Tu: [{ startTime: 540, endTime: 590 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateScheduledClassesLocally([a, b] as any[])
    expect(result.valid).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })

  it('does not flag back-to-back classes as a conflict (adjacent, not overlapping)', () => {
    // 9:00–9:50 then 10:00–10:50 on Monday
    const a = makeSection('CS-101-01', 'CS 101', 3, { M: [{ startTime: 540, endTime: 590 }] })
    const b = makeSection('CS-102-01', 'CS 102', 3, { M: [{ startTime: 600, endTime: 650 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateScheduledClassesLocally([a, b] as any[])
    expect(result.valid).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })

  it('detects overlapping classes on the same day', () => {
    // 9:00–10:00 and 9:30–10:30 overlap by 30 minutes on Monday
    const a = makeSection('CS-101-01', 'CS 101', 3, { M: [{ startTime: 540, endTime: 600 }] })
    const b = makeSection('CS-102-01', 'CS 102', 3, { M: [{ startTime: 570, endTime: 630 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateScheduledClassesLocally([a, b] as any[])
    expect(result.valid).toBe(false)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]!.classId1).toBe('CS-101-01')
    expect(result.conflicts[0]!.classId2).toBe('CS-102-01')
    expect(result.conflicts[0]!.day).toBe('M')
  })

  it('detects identical-time classes as a conflict', () => {
    const a = makeSection('CS-101-01', 'CS 101', 3, { W: [{ startTime: 540, endTime: 630 }] })
    const b = makeSection('CS-102-01', 'CS 102', 3, { W: [{ startTime: 540, endTime: 630 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateScheduledClassesLocally([a, b] as any[])
    expect(result.valid).toBe(false)
    expect(result.conflicts).toHaveLength(1)
  })

  it('reports the correct overlap time range in the conflict', () => {
    // classA 9:00–10:30, classB 10:00–11:00 → overlap 10:00–10:30
    const a = makeSection('CS-101-01', 'CS 101', 3, { M: [{ startTime: 540, endTime: 630 }] })
    const b = makeSection('CS-102-01', 'CS 102', 3, { M: [{ startTime: 600, endTime: 660 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateScheduledClassesLocally([a, b] as any[])
    expect(result.conflicts[0]!.timeRange).toBe('10:00 AM - 10:30 AM')
  })

  it('sums total credits across all classes', () => {
    const a = makeSection('CS-101-01', 'CS 101', 4, { M: [{ startTime: 540, endTime: 590 }] })
    const b = makeSection('CS-102-01', 'CS 102', 3, { Tu: [{ startTime: 540, endTime: 590 }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateScheduledClassesLocally([a, b] as any[])
    expect(result.totalCredits).toBe(7)
  })

  it('warns for a heavy schedule exceeding 18 credits', () => {
    // 7 classes × 3 credits = 21, all on different hour slots Monday to avoid conflict noise
    const classes = Array.from({ length: 7 }, (_, i) =>
      makeSection(`CS-${100 + i}-01`, `CS ${100 + i}`, 3, {
        M: [{ startTime: 480 + i * 70, endTime: 540 + i * 70 }],
      }),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = validateScheduledClassesLocally(classes as any[])
    expect(result.totalCredits).toBe(21)
    expect(result.warnings.some((w) => w.includes('18'))).toBe(true)
  })
})
