// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Course } from '../components/progress/ProgressPage'

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

// Mock child components of ProgressPage
vi.mock('../components/progress/DegreeProgressCard', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'degree-progress-card' }, `progress:${props.progress}`),
}))
vi.mock('../components/progress/CreditBreakdownChart', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'credit-chart' }, `earned:${props.earned}`),
}))
vi.mock('../components/progress/GPATrendChart', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'gpa-chart' }, `courses:${(props.courses || []).length}`),
}))
vi.mock('../components/progress/RequirementsChecklist', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'requirements-checklist' }, `reqs:${props.requirements.length}`),
}))
vi.mock('../components/progress/CourseHistoryTimeline', () => ({
  default: () => React.createElement('div', { 'data-testid': 'course-timeline' }),
}))
vi.mock('../components/progress/UpcomingMilestones', () => ({
  default: () => React.createElement('div', { 'data-testid': 'milestones' }),
}))
vi.mock('react-icons/fi', () => ({
  FiRefreshCw: (props: any) => React.createElement('span', props, 'refresh-icon'),
  FiAlertCircle: (props: any) => React.createElement('span', props, 'alert-icon'),
}))

// Mock recharts for GPATrendChart direct render tests
vi.mock('recharts', () => {
  const Passthrough = ({ children }: any) =>
    React.createElement('div', { 'data-testid': 'recharts-mock' }, children)
  return {
    LineChart: Passthrough,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    ReferenceLine: () => null,
    Area: () => null,
    ComposedChart: Passthrough,
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeValidData() {
  return {
    parsed_data: {
      student_info: {
        name: 'Smith, Alex',
        program: 'B.S. Computer Science',
        expected_graduation: 'Spring 2026',
      },
      gpa: { overall: 3.50, major: 3.65 },
      courses: {
        all_found: [
          { term: 'Fall 2023', subject: 'CS', number: '101', title: 'Intro CS', grade: 'A', credits: 3, type: null },
          { term: 'Spring 2024', subject: 'MATH', number: '201', title: 'Calculus', grade: 'B+', credits: 4, type: null },
        ],
        in_progress: [
          { term: 'Fall 2024', subject: 'CS', number: '301', title: 'Algorithms', grade: null, credits: 3, type: null },
        ],
        completed: [
          { term: 'Fall 2023', subject: 'CS', number: '101', title: 'Intro CS', grade: 'A', credits: 3, type: null },
          { term: 'Spring 2024', subject: 'MATH', number: '201', title: 'Calculus', grade: 'B+', credits: 4, type: null },
        ],
      },
      credit_requirements: [
        { label: 'Degree Credit Requirement', required: 120, earned: 45, in_progress: 3, needed: 72 },
      ],
    },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('API response schema validation — DT132', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.jwt = 'test-jwt'
    mocks.preferences = { hasProgramEvaluation: false }
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    vi.restoreAllMocks()
  })

  it('missing gpa.major field — ProgressPage shows fallback dash, no crash', async () => {
    const data = makeValidData()
    // Remove major field entirely
    delete (data.parsed_data.gpa as any).major

    const mockClient = { query: vi.fn().mockResolvedValue(data) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    const { default: ProgressPage } = await import('../components/progress/ProgressPage')
    await act(async () => { root.render(<ProgressPage />) })

    // Page renders without crash
    expect(container.querySelector('[data-testid="degree-progress-card"]')).not.toBeNull()
    // Major GPA section shows fallback "—" for undefined value
    expect(container.textContent).toContain('Major GPA')
    expect(container.textContent).toContain('—')
  })

  it('gpa: "not-a-number" (wrong type) — GPATrendChart renders without crash', async () => {
    // Pass courses with a non-numeric grade string that won't map to GRADE_POINTS
    const badCourses: Course[] = [
      { term: 'Fall 2023', subject: 'CS', number: '101', title: 'Intro', grade: 'not-a-number', credits: 3, type: null },
      { term: 'Spring 2024', subject: 'CS', number: '201', title: 'Data Structures', grade: 'INVALID', credits: 3, type: null },
    ]

    // Import real GPATrendChart (recharts is mocked)
    vi.doUnmock('../components/progress/GPATrendChart')
    const { default: GPATrendChart } = await import('../components/progress/GPATrendChart')
    await act(async () => { root.render(<GPATrendChart courses={badCourses} />) })

    // Should show empty state since unmappable grades are filtered out
    expect(container.textContent).toContain('No grade data available')
    // No crash — component rendered
    expect(container.innerHTML.length).toBeGreaterThan(0)
  })

  it('courses: null (unexpected null) — ProgressPage shows empty state, no crash', async () => {
    const data = makeValidData()
    // Set courses to null — simulates unexpected API null
    ;(data.parsed_data as any).courses = null

    const mockClient = { query: vi.fn().mockResolvedValue(data) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    const { default: ProgressPage } = await import('../components/progress/ProgressPage')
    await act(async () => { root.render(<ProgressPage />) })

    // Page renders without crash — child components still mount
    expect(container.querySelector('[data-testid="degree-progress-card"]')).not.toBeNull()
    // GPATrendChart receives empty array fallback (courses?.completed || [])
    expect(container.textContent).toContain('courses:0')
  })

  it('correct shape — all components render with expected data', async () => {
    const data = makeValidData()
    const mockClient = { query: vi.fn().mockResolvedValue(data) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    const { default: ProgressPage } = await import('../components/progress/ProgressPage')
    await act(async () => { root.render(<ProgressPage />) })

    // All child components rendered
    expect(container.querySelector('[data-testid="degree-progress-card"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="credit-chart"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="gpa-chart"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="requirements-checklist"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="course-timeline"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="milestones"]')).not.toBeNull()

    // Student name rendered correctly
    expect(container.querySelector('h1')!.textContent).toContain('Alex Smith')
    // GPA values displayed
    expect(container.textContent).toContain('3.50')
    expect(container.textContent).toContain('3.65')
  })
})
