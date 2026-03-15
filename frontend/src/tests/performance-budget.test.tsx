// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ScheduledClass } from '../components/schedule/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  jwt: 'test-jwt',
  preferences: { hasProgramEvaluation: true } as Record<string, unknown>,
  usePageTitle: vi.fn(),
  getConvexClient: vi.fn(),
  convexApi: {
    evaluations: {
      getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation',
    },
  },
  syncCurrentProgramEvaluationFromLegacy: vi.fn(),
}))

vi.mock('../hooks/usePageTitle', () => ({ usePageTitle: mocks.usePageTitle }))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: mocks.jwt, preferences: mocks.preferences }),
}))
vi.mock('../lib/convex', () => ({
  convexApi: mocks.convexApi,
  getConvexClient: mocks.getConvexClient,
  syncCurrentProgramEvaluationFromLegacy: mocks.syncCurrentProgramEvaluationFromLegacy,
}))

// WeeklyCalendar deps
vi.mock('../components/schedule/ClassDetailsModal', () => ({ default: () => null }))
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// ProgressPage child components — stub to isolate render cost
vi.mock('../components/progress/DegreeProgressCard', () => ({ default: () => React.createElement('div', { 'data-testid': 'degree-progress' }) }))
vi.mock('../components/progress/CreditBreakdownChart', () => ({ default: () => React.createElement('div', { 'data-testid': 'credit-breakdown' }) }))
vi.mock('../components/progress/GPATrendChart', () => ({ default: () => React.createElement('div', { 'data-testid': 'gpa-trend' }) }))
vi.mock('../components/progress/RequirementsChecklist', () => ({ default: () => React.createElement('div', { 'data-testid': 'requirements-checklist' }) }))
vi.mock('../components/progress/CourseHistoryTimeline', () => ({ default: () => React.createElement('div', { 'data-testid': 'course-history' }) }))
vi.mock('../components/progress/UpcomingMilestones', () => ({ default: () => React.createElement('div', { 'data-testid': 'milestones' }) }))

// ── Factories ─────────────────────────────────────────────────────────────────

const DAYS = ['M', 'Tu', 'W', 'Th', 'F'] as const

function make50ScheduledClasses(): ScheduledClass[] {
  return Array.from({ length: 50 }, (_, i) => {
    const day = DAYS[i % DAYS.length]
    const startMin = 480 + (i % 12) * 60 // stagger across hours
    return {
      id: `CLS-${i}`,
      code: `SUBJ ${100 + i}-0${(i % 9) + 1}`,
      subject: 'SUBJ',
      number: String(100 + i),
      section: `0${(i % 9) + 1}`,
      title: `Course ${i}`,
      credits: 3,
      displayDays: day,
      displayTime: `${Math.floor(startMin / 60)}:00 AM`,
      location: `Room ${i}`,
      professor: `Prof ${i}`,
      professorRating: null,
      semester: 'spring2026',
      semestersOffered: [],
      requirementsSatisfied: [],
      occurrenceData: {
        starts: 0,
        ends: 0,
        daysOccurring: {
          M: day === 'M' ? [{ startTime: startMin, endTime: startMin + 50 }] : [],
          Tu: day === 'Tu' ? [{ startTime: startMin, endTime: startMin + 50 }] : [],
          W: day === 'W' ? [{ startTime: startMin, endTime: startMin + 50 }] : [],
          Th: day === 'Th' ? [{ startTime: startMin, endTime: startMin + 50 }] : [],
          F: day === 'F' ? [{ startTime: startMin, endTime: startMin + 50 }] : [],
          Sa: [],
          Su: [],
        },
      },
      color: '#DBEAFE',
    }
  })
}

function make50Courses() {
  return Array.from({ length: 50 }, (_, i) => ({
    subject: 'CPSC',
    number: String(100 + i),
    title: `Course ${i}`,
    term: i % 2 === 0 ? 'Spring 2026' : 'Fall 2025',
    grade: i < 40 ? 'A' : null,
    credits: 3,
    type: i < 40 ? 'completed' : 'in_progress',
  }))
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Performance budget — render < 500ms', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  it('WeeklyCalendar renders 50 courses in < 500ms', async () => {
    const { default: WeeklyCalendar } = await import('../components/schedule/WeeklyCalendar')
    const classes = make50ScheduledClasses()
    const onRemove = vi.fn()

    const t0 = performance.now()
    await act(async () => {
      root.render(<WeeklyCalendar classes={classes} onRemoveClass={onRemove} />)
    })
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(500)
    // Class blocks are rendered as aria-labeled remove buttons
    expect(container.querySelectorAll('[aria-label^="Remove "]').length).toBeGreaterThan(0)
  })

  it('ProgressPage renders with 50 courses in < 500ms', async () => {
    const courses = make50Courses()
    const mockQuery = vi.fn().mockResolvedValue({
      parsed_data: {
        student_info: { name: 'Test Student', program: 'Computer Science' },
        gpa: { overall: 3.5, major: 3.7 },
        courses: {
          all_found: courses,
          in_progress: courses.filter(c => c.type === 'in_progress'),
          completed: courses.filter(c => c.type === 'completed'),
        },
        credit_requirements: [
          { label: 'Total', required: 120, earned: 90, in_progress: 30, needed: 0 },
        ],
      },
    })
    mocks.getConvexClient.mockReturnValue({ query: mockQuery })

    const { default: ProgressPage } = await import('../components/progress/ProgressPage')

    const t0 = performance.now()
    await act(async () => {
      root.render(<ProgressPage />)
    })
    // Let async state settle
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(500)
  })

  it('Dashboard (ProgressPage) renders 50 items in < 500ms', async () => {
    const courses = make50Courses()
    const mockQuery = vi.fn().mockResolvedValue({
      parsed_data: {
        student_info: { name: 'Dashboard User', program: 'CS', expected_graduation: '2027' },
        gpa: { overall: 3.2, major: 3.4 },
        courses: {
          all_found: courses,
          in_progress: courses.slice(40),
          completed: courses.slice(0, 40),
        },
        credit_requirements: Array.from({ length: 5 }, (_, i) => ({
          label: `Req ${i}`,
          required: 30,
          earned: 20 + i,
          in_progress: 5,
          needed: 5 - i,
        })),
      },
    })
    mocks.getConvexClient.mockReturnValue({ query: mockQuery })

    const { default: ProgressPage } = await import('../components/progress/ProgressPage')

    const t0 = performance.now()
    await act(async () => {
      root.render(<ProgressPage />)
    })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(500)
  })

  it('WeeklyCalendar React.memo prevents re-render with same props', async () => {
    const { default: WeeklyCalendar, WeeklyCalendarUnmemoized } = await import('../components/schedule/WeeklyCalendar')
    let renderCount = 0

    function RenderSpy(props: React.ComponentPropsWithoutRef<typeof WeeklyCalendarUnmemoized>) {
      renderCount++
      return <WeeklyCalendarUnmemoized {...props} />
    }
    const MemoSpy = React.memo(RenderSpy)

    const stableClasses = make50ScheduledClasses()
    const stableConflicts: Record<string, string> = {}
    const onRemove = vi.fn()

    function Parent() {
      const [count, setCount] = React.useState(0)
      return (
        <>
          <button data-testid="bump" onClick={() => setCount(c => c + 1)}>{count}</button>
          <MemoSpy classes={stableClasses} onRemoveClass={onRemove} conflicts={stableConflicts} />
        </>
      )
    }

    await act(async () => { root.render(<Parent />) })
    const initial = renderCount

    const btn = container.querySelector<HTMLButtonElement>('[data-testid="bump"]')!
    await act(async () => { btn.click() })
    await act(async () => { btn.click() })

    // Same stable props → memo should prevent re-renders
    expect(renderCount).toBe(initial)
    // Verify the default export is memo-wrapped
    expect((WeeklyCalendar as any).$$typeof).toBe(Symbol.for('react.memo'))
  })
})
