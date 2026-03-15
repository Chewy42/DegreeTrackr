// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClassSection } from './types'

// ── Hoisted schedule API mocks ───────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  validateScheduledClassesLocally: vi.fn().mockReturnValue({
    valid: true,
    conflicts: [],
    totalCredits: 0,
    warnings: [],
  }),
  generateAutoSchedule: vi.fn(),
  getClassById: vi.fn(),
  createScheduleSnapshot: vi.fn(),
  listScheduleSnapshots: vi.fn(),
  deleteScheduleSnapshot: vi.fn(),
  deriveRequirementsSummaryFromProgramEvaluation: vi.fn().mockReturnValue(null),
}))

vi.mock('../../lib/scheduleApi', () => ({
  validateScheduledClassesLocally: mocks.validateScheduledClassesLocally,
  generateAutoSchedule: mocks.generateAutoSchedule,
  getClassById: mocks.getClassById,
  createScheduleSnapshot: mocks.createScheduleSnapshot,
  listScheduleSnapshots: mocks.listScheduleSnapshots,
  deleteScheduleSnapshot: mocks.deleteScheduleSnapshot,
  deriveRequirementsSummaryFromProgramEvaluation: mocks.deriveRequirementsSummaryFromProgramEvaluation,
}))

// ── Auth + Convex mocks ──────────────────────────────────────────────────────

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: 'test-jwt' }),
}))

vi.mock('../../lib/convex', () => ({
  convexApi: {
    evaluations: { getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation' },
  },
  getConvexClient: () => null,
}))

vi.mock('../../hooks/usePageTitle', () => ({
  usePageTitle: () => {},
}))

// ── Captured child component props ───────────────────────────────────────────

let calendarProps: {
  classes: ClassSection[]
  onRemoveClass: (id: string) => void
  conflicts: Record<string, string>
} | null = null

let sidebarProps: {
  onAddClass: (cls: ClassSection) => void
  onRemoveClass: (id: string) => void
  addedClassIds: Set<string>
  conflicts: Record<string, string>
} | null = null

let snapshotModalProps: {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => Promise<void>
  onLoad: (snapshot: any) => Promise<void>
  onDelete: (snapshot: any) => Promise<void>
  onRefresh: () => Promise<void>
  snapshots: any[]
  loading: boolean
  saving: boolean
  error: string | null
} | null = null

vi.mock('./WeeklyCalendar', () => ({
  default: (props: typeof calendarProps) => {
    calendarProps = props
    return React.createElement('div', { 'data-testid': 'weekly-calendar' })
  },
}))

vi.mock('./ClassSearchSidebar', () => ({
  default: (props: typeof sidebarProps) => {
    sidebarProps = props
    return React.createElement('div', { 'data-testid': 'class-search-sidebar' })
  },
}))

vi.mock('./WarningModal', () => ({ default: () => null }))
vi.mock('./ScheduleImpactModal', () => ({ default: () => null }))
vi.mock('./SnapshotManagerModal', () => ({
  default: (props: any) => {
    snapshotModalProps = props
    return null
  },
}))

// ── Test factory ─────────────────────────────────────────────────────────────

function makeSection(
  id: string,
  code: string,
  credits = 3,
  days: Partial<Record<'M' | 'Tu' | 'W' | 'Th' | 'F', Array<{ startTime: number; endTime: number }>>> = {},
): ClassSection {
  const daysOccurring = {
    M: [],
    Tu: [],
    W: [],
    Th: [],
    F: [],
    Sa: [],
    Su: [],
    ...days,
  }
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
    location: 'Room 100',
    professor: 'Prof Test',
    professorRating: null,
    semester: 'spring2026',
    semestersOffered: [],
    requirementsSatisfied: [],
    occurrenceData: { starts: 0, ends: 0, daysOccurring },
  }
}

// Classes that have real meeting times
const CLASS_A = makeSection('CS-101-01', 'CS 101', 3, {
  M: [{ startTime: 540, endTime: 590 }],
  W: [{ startTime: 540, endTime: 590 }],
})
const CLASS_B = makeSection('MATH-201-01', 'MATH 201', 3, {
  Tu: [{ startTime: 600, endTime: 650 }],
})
// Overlaps CLASS_A on Monday
const CLASS_C = makeSection('ENG-301-01', 'ENG 301', 3, {
  M: [{ startTime: 560, endTime: 620 }],
})

// ── Test suite ───────────────────────────────────────────────────────────────

describe('ScheduleBuilder', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    calendarProps = null
    sidebarProps = null
    snapshotModalProps = null
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.validateScheduledClassesLocally.mockReturnValue({
      valid: true,
      conflicts: [],
      totalCredits: 0,
      warnings: [],
    })
    mocks.listScheduleSnapshots.mockResolvedValue([])
    window.confirm = vi.fn().mockReturnValue(true)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render() {
    const { default: ScheduleBuilder } = await import('./ScheduleBuilder')
    await act(async () => {
      root.render(<ScheduleBuilder />)
    })
  }

  it('renders WeeklyCalendar and ClassSearchSidebar', async () => {
    await render()
    expect(container.querySelector('[data-testid="weekly-calendar"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="class-search-sidebar"]')).not.toBeNull()
  })

  it('adding a class passes it to WeeklyCalendar', async () => {
    await render()
    expect(calendarProps!.classes).toHaveLength(0)

    await act(async () => {
      sidebarProps!.onAddClass(CLASS_A)
    })

    expect(calendarProps!.classes).toHaveLength(1)
    expect(calendarProps!.classes[0]!.id).toBe('CS-101-01')
  })

  it('does not add duplicate classes', async () => {
    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    expect(calendarProps!.classes).toHaveLength(1)
  })

  it('skips classes with no meeting times (TBA sections)', async () => {
    const tbaSec = makeSection('TBA-001', 'TBA 001', 3, {}) // no days → no meeting times
    await render()
    await act(async () => { sidebarProps!.onAddClass(tbaSec) })
    expect(calendarProps!.classes).toHaveLength(0)
  })

  it('removing a class via WeeklyCalendar removes it from the schedule', async () => {
    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    expect(calendarProps!.classes).toHaveLength(1)

    await act(async () => { calendarProps!.onRemoveClass('CS-101-01') })
    expect(calendarProps!.classes).toHaveLength(0)
  })

  it('removing a class via ClassSearchSidebar removes it from the schedule', async () => {
    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onRemoveClass('CS-101-01') })
    expect(calendarProps!.classes).toHaveLength(0)
  })

  it('addedClassIds on ClassSearchSidebar reflects the current schedule', async () => {
    await render()
    expect(sidebarProps!.addedClassIds.size).toBe(0)

    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    expect(sidebarProps!.addedClassIds.has('CS-101-01')).toBe(true)
  })

  it('shows conflict indicator in toolbar when validation reports conflicts', async () => {
    mocks.validateScheduledClassesLocally.mockReturnValue({
      valid: false,
      conflicts: [
        {
          classId1: 'CS-101-01',
          classId2: 'ENG-301-01',
          day: 'M',
          timeRange: '9:20 AM - 9:50 AM',
          message: 'CS 101 conflicts with ENG 301 on M at 9:20 AM.',
        },
      ],
      totalCredits: 6,
      warnings: [],
    })

    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onAddClass(CLASS_C) })

    // Conflict badge should be visible in the toolbar
    expect(container.textContent).toContain('Conflict')
  })

  it('passes conflict map to WeeklyCalendar when conflicts exist', async () => {
    mocks.validateScheduledClassesLocally.mockReturnValue({
      valid: false,
      conflicts: [
        {
          classId1: 'CS-101-01',
          classId2: 'ENG-301-01',
          day: 'M',
          timeRange: '9:20 AM - 9:50 AM',
          message: 'CS 101 conflicts with ENG 301 on M.',
        },
      ],
      totalCredits: 6,
      warnings: [],
    })

    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onAddClass(CLASS_C) })

    expect(calendarProps!.conflicts).toMatchObject({
      'CS-101-01': 'CS 101 conflicts with ENG 301 on M.',
      'ENG-301-01': 'CS 101 conflicts with ENG 301 on M.',
    })
  })

  it('shows "Schedule Valid" badge when schedule is non-empty and conflict-free', async () => {
    // Use a class that satisfies a requirement so the component does not add
    // a client-side "does not satisfy any requirement" warning on top of the
    // (already empty) warnings returned by the mocked validator.
    const classWithReqs: ClassSection = {
      ...CLASS_A,
      requirementsSatisfied: [{ type: 'major_core', label: 'Major Core', shortLabel: 'Core', color: 'blue' }],
    }
    mocks.validateScheduledClassesLocally.mockReturnValue({
      valid: true,
      conflicts: [],
      totalCredits: 3,
      warnings: [],
    })

    await render()
    await act(async () => { sidebarProps!.onAddClass(classWithReqs) })
    expect(container.textContent).toContain('Schedule Valid')
  })

  it('shows error toast when auto-generate fails', async () => {
    mocks.generateAutoSchedule.mockRejectedValue(new Error('API unavailable'))

    await render()

    const autoBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Auto Generate'),
    )
    expect(autoBtn).not.toBeNull()

    await act(async () => { autoBtn!.click() })

    const alerts = Array.from(container.querySelectorAll('[role="alert"]'))
    const errorAlert = alerts.find(a => a.textContent?.includes('API unavailable'))
    expect(errorAlert).not.toBeNull()
  })

  it('populates schedule after successful auto-generate', async () => {
    mocks.generateAutoSchedule.mockResolvedValue({
      class_ids: ['CS-101-01'],
    })
    mocks.getClassById.mockResolvedValue(CLASS_A)

    await render()

    const autoBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Auto Generate'),
    )!

    await act(async () => { autoBtn.click() })

    expect(calendarProps!.classes).toHaveLength(1)
    expect(calendarProps!.classes[0]!.id).toBe('CS-101-01')
  })

  it('displays class and credit counts in the toolbar', async () => {
    mocks.validateScheduledClassesLocally.mockReturnValue({
      valid: true,
      conflicts: [],
      totalCredits: 6,
      warnings: [],
    })

    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onAddClass(CLASS_B) })

    expect(container.textContent).toContain('2')
    expect(container.textContent).toContain('Credits')
  })

  // ── DT36 conflict resolution UX tests ────────────────────────────────────

  it('adding an overlapping class triggers validateScheduledClassesLocally', async () => {
    mocks.validateScheduledClassesLocally
      .mockReturnValueOnce({ valid: true, conflicts: [], totalCredits: 3, warnings: [] })
      .mockReturnValueOnce({ valid: false, conflicts: [{ classId1: 'CS-101-01', classId2: 'ENG-301-01', day: 'M', timeRange: '9:00 AM - 9:50 AM', message: 'CS 101 conflicts with ENG 301 on M.' }], totalCredits: 6, warnings: [] })

    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onAddClass(CLASS_C) })

    expect(mocks.validateScheduledClassesLocally).toHaveBeenCalledTimes(2)
    expect(mocks.validateScheduledClassesLocally).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'CS-101-01' }),
        expect.objectContaining({ id: 'ENG-301-01' }),
      ])
    )
  })

  it('conflict resolution panel shows conflict message and Remove buttons', async () => {
    mocks.validateScheduledClassesLocally
      .mockReturnValueOnce({ valid: true, conflicts: [], totalCredits: 3, warnings: [] })
      .mockReturnValueOnce({
        valid: false,
        conflicts: [{
          classId1: 'CS-101-01',
          classId2: 'ENG-301-01',
          day: 'M',
          timeRange: '9:00 AM - 9:50 AM',
          message: 'CS 101 conflicts with ENG 301 on M.',
        }],
        totalCredits: 6,
        warnings: [],
      })

    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onAddClass(CLASS_C) })

    // Conflict message is shown in the resolution panel
    expect(container.textContent).toContain('CS 101 conflicts with ENG 301 on M.')

    // Remove buttons for each conflicting class
    const removeCsBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.getAttribute('aria-label') === 'Remove CS 101'
    )
    const removeEngBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.getAttribute('aria-label') === 'Remove ENG 301'
    )
    expect(removeCsBtn).not.toBeNull()
    expect(removeEngBtn).not.toBeNull()
  })

  it('clicking Remove in conflict panel removes that class from the schedule', async () => {
    mocks.validateScheduledClassesLocally
      .mockReturnValueOnce({ valid: true, conflicts: [], totalCredits: 3, warnings: [] })
      .mockReturnValueOnce({
        valid: false,
        conflicts: [{
          classId1: 'CS-101-01',
          classId2: 'ENG-301-01',
          day: 'M',
          timeRange: '9:00 AM - 9:50 AM',
          message: 'CS 101 conflicts with ENG 301 on M.',
        }],
        totalCredits: 6,
        warnings: [],
      })
      .mockReturnValueOnce({ valid: true, conflicts: [], totalCredits: 3, warnings: [] })

    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onAddClass(CLASS_C) })

    const removeCsBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.getAttribute('aria-label') === 'Remove CS 101'
    )
    expect(removeCsBtn).not.toBeNull()

    await act(async () => { removeCsBtn!.click() })

    // CLASS_A should be removed; only CLASS_C remains
    expect(calendarProps!.classes).toHaveLength(1)
    expect(calendarProps!.classes[0]!.id).toBe('ENG-301-01')
  })

  // ── DT38 network failure handling ─────────────────────────────────────────

  it('shows requirementsError toast when Convex client is unavailable', async () => {
    // The module-level mock has getConvexClient returning null, which triggers
    // setRequirementsError('Convex must be configured…') in the useEffect.
    await render()
    await act(async () => {})

    const alerts = Array.from(container.querySelectorAll('[role="alert"]'))
    const convexAlert = alerts.find(a =>
      a.textContent?.includes('Convex must be configured'),
    )
    expect(convexAlert).not.toBeNull()
  })

  it('snapshot save mutation throws → snapshotError toast visible after modal closes', async () => {
    mocks.createScheduleSnapshot.mockRejectedValue(new Error('Server unavailable'))

    await render()
    // Need at least one class before saving a snapshot
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })

    // Open the snapshots modal
    const snapshotsBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.textContent?.includes('Snapshots'),
    )!
    await act(async () => { snapshotsBtn.click() })

    // Trigger save via the modal's onSave prop (simulates user clicking save inside modal)
    await act(async () => {
      await snapshotModalProps!.onSave('My Schedule')
    })

    // Close the modal — the snapshotError toast is only rendered outside the modal
    await act(async () => { snapshotModalProps!.onClose() })

    const alerts = Array.from(container.querySelectorAll('[role="alert"]'))
    const errorAlert = alerts.find(a =>
      a.textContent?.includes('Failed to save schedule snapshot'),
    )
    expect(errorAlert).not.toBeNull()
  })

  it('resolving all conflicts clears the conflict indicators', async () => {
    mocks.validateScheduledClassesLocally
      .mockReturnValueOnce({ valid: true, conflicts: [], totalCredits: 3, warnings: [] })
      .mockReturnValueOnce({
        valid: false,
        conflicts: [{
          classId1: 'CS-101-01',
          classId2: 'ENG-301-01',
          day: 'M',
          timeRange: '9:00 AM - 9:50 AM',
          message: 'CS 101 conflicts with ENG 301 on M.',
        }],
        totalCredits: 6,
        warnings: [],
      })
      .mockReturnValueOnce({ valid: true, conflicts: [], totalCredits: 3, warnings: [] })

    await render()
    await act(async () => { sidebarProps!.onAddClass(CLASS_A) })
    await act(async () => { sidebarProps!.onAddClass(CLASS_C) })

    // Conflict toolbar badge visible
    expect(container.textContent).toContain('Conflict')

    const removeCsBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.getAttribute('aria-label') === 'Remove CS 101'
    )
    await act(async () => { removeCsBtn!.click() })

    // Conflict badge + resolution panel should be gone
    expect(container.textContent).not.toContain('Conflict')
    // The conflict panel uses aria-live="polite"; the Convex warning uses aria-live="assertive"
    expect(container.querySelector('[role="alert"][aria-live="polite"]')).toBeNull()
  })
})
