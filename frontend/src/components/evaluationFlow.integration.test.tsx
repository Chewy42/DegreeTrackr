// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  jwt: 'test-jwt',
  preferences: { hasProgramEvaluation: false } as Record<string, unknown>,
  usePageTitle: vi.fn(),
  getConvexClient: vi.fn(),
  convexApi: {
    evaluations: { getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation' },
  },
  syncCurrentProgramEvaluationFromLegacy: vi.fn(),
}))

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: mocks.usePageTitle,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: mocks.jwt,
    preferences: mocks.preferences,
  }),
}))

vi.mock('../lib/convex', () => ({
  convexApi: mocks.convexApi,
  getConvexClient: mocks.getConvexClient,
  syncCurrentProgramEvaluationFromLegacy: mocks.syncCurrentProgramEvaluationFromLegacy,
}))

// Mock child components to capture props
let capturedChecklistProps: any = null
let capturedTimelineProps: any = null
let capturedProgressCardProps: any = null
let capturedCreditChartProps: any = null

vi.mock('./progress/DegreeProgressCard', () => ({
  default: (props: any) => {
    capturedProgressCardProps = props
    return React.createElement('div', { 'data-testid': 'degree-progress-card' }, `progress:${props.progress}`)
  },
}))
vi.mock('./progress/CreditBreakdownChart', () => ({
  default: (props: any) => {
    capturedCreditChartProps = props
    return React.createElement('div', { 'data-testid': 'credit-chart' }, `earned:${props.earned}`)
  },
}))
vi.mock('./progress/GPATrendChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'gpa-chart' }),
}))
vi.mock('./progress/RequirementsChecklist', () => ({
  default: (props: any) => {
    capturedChecklistProps = props
    return React.createElement(
      'div',
      { 'data-testid': 'requirements-checklist' },
      `reqs:${props.requirements.length}`,
    )
  },
}))
vi.mock('./progress/CourseHistoryTimeline', () => ({
  default: (props: any) => {
    capturedTimelineProps = props
    return React.createElement('div', { 'data-testid': 'course-timeline' })
  },
}))
vi.mock('./progress/UpcomingMilestones', () => ({
  default: () => React.createElement('div', { 'data-testid': 'milestones' }),
}))
vi.mock('react-icons/fi', () => ({
  FiRefreshCw: (props: any) => React.createElement('span', props, 'refresh-icon'),
  FiAlertCircle: (props: any) => React.createElement('span', props, 'alert-icon'),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvaluation(courses: Array<{ subject: string; number: string; title: string; grade: string | null; credits: number; term: string }>) {
  const completed = courses.filter(c => c.grade !== null)
  const inProgress = courses.filter(c => c.grade === null)
  const totalEarned = completed.reduce((sum, c) => sum + c.credits, 0)
  const totalInProgress = inProgress.reduce((sum, c) => sum + c.credits, 0)

  return {
    parsed_data: {
      student_info: {
        name: 'Smith, Alex',
        program: 'B.S. Computer Science',
        expected_graduation: 'Spring 2027',
      },
      gpa: { overall: 3.50, major: 3.65 },
      courses: {
        all_found: courses.map(c => ({ ...c, type: null })),
        in_progress: inProgress.map(c => ({ ...c, type: null })),
        completed: completed.map(c => ({ ...c, type: null })),
      },
      credit_requirements: [
        { label: 'Degree Credit Requirement', required: 120, earned: totalEarned, in_progress: totalInProgress, needed: 120 - totalEarned - totalInProgress },
        { label: 'Major Credits', required: 42, earned: Math.min(totalEarned, 21), in_progress: totalInProgress, needed: 42 - Math.min(totalEarned, 21) - totalInProgress },
      ],
    },
  }
}

const INITIAL_COURSES = [
  { subject: 'CS', number: '101', title: 'Intro to CS', grade: 'A', credits: 3, term: 'Fall 2025' },
  { subject: 'MATH', number: '201', title: 'Calculus I', grade: 'B+', credits: 4, term: 'Fall 2025' },
  { subject: 'CS', number: '201', title: 'Data Structures', grade: null, credits: 3, term: 'Spring 2026' },
]

const UPDATED_COURSES = [
  ...INITIAL_COURSES.map(c => c.grade === null ? { ...c, grade: 'A-' } : c),
  { subject: 'CS', number: '301', title: 'Algorithms', grade: null, credits: 3, term: 'Fall 2026' },
  { subject: 'ENG', number: '101', title: 'Composition', grade: 'B', credits: 3, term: 'Fall 2025' },
]

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Program evaluation → progress flow (integration)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    capturedChecklistProps = null
    capturedTimelineProps = null
    capturedProgressCardProps = null
    capturedCreditChartProps = null
    mocks.jwt = 'test-jwt'
    mocks.preferences = { hasProgramEvaluation: false }
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    vi.restoreAllMocks()
  })

  async function render() {
    const { default: ProgressPage } = await import('./progress/ProgressPage')
    await act(async () => {
      root.render(<ProgressPage />)
    })
  }

  it('displays course list and credit count from mock evaluation', async () => {
    const evalData = makeEvaluation(INITIAL_COURSES)
    const mockClient = { query: vi.fn().mockResolvedValue(evalData) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    // Verify student info rendered
    expect(container.textContent).toContain('Alex Smith')
    expect(container.textContent).toContain('B.S. Computer Science')

    // Verify GPA values
    expect(container.textContent).toContain('3.50')
    expect(container.textContent).toContain('3.65')

    // Verify requirements passed to checklist
    expect(capturedChecklistProps).not.toBeNull()
    expect(capturedChecklistProps.requirements).toHaveLength(2)
    expect(capturedChecklistProps.requirements[0].label).toBe('Degree Credit Requirement')

    // Verify courses passed to timeline
    expect(capturedTimelineProps).not.toBeNull()
    expect(capturedTimelineProps.courses.length).toBeGreaterThanOrEqual(3)

    // Verify credit data passed to chart
    expect(capturedCreditChartProps).not.toBeNull()
  })

  it('reflects 3 courses with correct credit total in requirements', async () => {
    const evalData = makeEvaluation(INITIAL_COURSES)
    const mockClient = { query: vi.fn().mockResolvedValue(evalData) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    // 3 credits (CS 101) + 4 credits (MATH 201) = 7 earned; 3 in-progress (CS 201)
    const degreeReq = capturedChecklistProps.requirements.find(
      (r: any) => r.label === 'Degree Credit Requirement',
    )
    expect(degreeReq).toBeDefined()
    expect(degreeReq.earned).toBe(7)
    expect(degreeReq.in_progress).toBe(3)
    expect(degreeReq.needed).toBe(110) // 120 - 7 - 3
  })

  it('updates progress page after new evaluation is submitted', async () => {
    // Initial render with first evaluation
    const initialData = makeEvaluation(INITIAL_COURSES)
    const mockQuery = vi.fn().mockResolvedValue(initialData)
    const mockClient = { query: mockQuery }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(capturedChecklistProps.requirements[0].earned).toBe(7)

    // Simulate new evaluation: update the query return value and re-render
    const updatedData = makeEvaluation(UPDATED_COURSES)
    mockQuery.mockResolvedValue(updatedData)

    // Click refresh to trigger re-fetch
    const refreshBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Refresh') || b.querySelector('span')?.textContent === 'refresh-icon',
    )

    if (refreshBtn) {
      await act(async () => {
        refreshBtn.click()
      })
    } else {
      // Fallback: re-render directly to simulate data update
      await act(async () => {
        root.unmount()
      })
      container.remove()
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
      await render()
    }

    // Updated: 3 (CS101) + 4 (MATH201) + 3 (CS201 now graded) + 3 (ENG101) = 13 earned; 3 in-progress (CS301)
    const updatedReq = capturedChecklistProps.requirements.find(
      (r: any) => r.label === 'Degree Credit Requirement',
    )
    expect(updatedReq).toBeDefined()
    expect(updatedReq.earned).toBe(13)
    expect(updatedReq.in_progress).toBe(3)
    expect(updatedReq.needed).toBe(104) // 120 - 13 - 3
  })

  it('handles evaluation with zero courses', async () => {
    const emptyEval = makeEvaluation([])
    const mockClient = { query: vi.fn().mockResolvedValue(emptyEval) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(capturedChecklistProps).not.toBeNull()
    const degreeReq = capturedChecklistProps.requirements.find(
      (r: any) => r.label === 'Degree Credit Requirement',
    )
    expect(degreeReq.earned).toBe(0)
    expect(degreeReq.needed).toBe(120)
  })
})
