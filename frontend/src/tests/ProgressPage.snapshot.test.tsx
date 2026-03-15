// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  jwt: 'test-jwt',
  preferences: { hasProgramEvaluation: true } as Record<string, unknown>,
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

// Mock child components with deterministic output for stable snapshots
vi.mock('../components/progress/DegreeProgressCard', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'degree-progress-card' },
      `progress:${props.progress}% earned:${props.earnedCredits}/${props.totalCredits} ip:${props.inProgressCredits}`),
}))
vi.mock('../components/progress/CreditBreakdownChart', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'credit-chart' },
      `earned:${props.earned} ip:${props.inProgress} needed:${props.needed} reqs:${props.requirements?.length ?? 0}`),
}))
vi.mock('../components/progress/GPATrendChart', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'gpa-chart' }, `courses:${props.courses?.length ?? 0}`),
}))
vi.mock('../components/progress/RequirementsChecklist', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'requirements-checklist' }, `reqs:${props.requirements?.length ?? 0}`),
}))
vi.mock('../components/progress/CourseHistoryTimeline', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'course-timeline' }, `courses:${props.courses?.length ?? 0}`),
}))
vi.mock('../components/progress/UpcomingMilestones', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'milestones' },
      `reqs:${props.creditRequirements?.length ?? 0}`),
}))
vi.mock('react-icons/fi', () => ({
  FiRefreshCw: (props: any) => React.createElement('span', { ...props, 'data-icon': 'refresh' }),
  FiAlertCircle: (props: any) => React.createElement('span', { ...props, 'data-icon': 'alert' }),
}))

/**
 * Build mock progress data matching the task spec:
 * 2 completed courses, 1 in-progress, GPA 3.5, 45/120 credits.
 */
function makeFixedProgressData() {
  return {
    parsed_data: {
      student_info: {
        name: 'Smith, Alex',
        program: 'B.S. Computer Science',
        expected_graduation: 'Spring 2027',
      },
      gpa: { overall: 3.5, major: 3.5 },
      courses: {
        all_found: [
          { term: 'Fall 2024', subject: 'CS', number: '101', title: 'Intro to CS', grade: 'A', credits: 3, type: null },
          { term: 'Fall 2024', subject: 'MATH', number: '210', title: 'Linear Algebra', grade: 'B+', credits: 3, type: null },
          { term: 'Spring 2025', subject: 'CS', number: '201', title: 'Data Structures', grade: null, credits: 3, type: null },
        ],
        in_progress: [
          { term: 'Spring 2025', subject: 'CS', number: '201', title: 'Data Structures', grade: null, credits: 3, type: null },
        ],
        completed: [
          { term: 'Fall 2024', subject: 'CS', number: '101', title: 'Intro to CS', grade: 'A', credits: 3, type: null },
          { term: 'Fall 2024', subject: 'MATH', number: '210', title: 'Linear Algebra', grade: 'B+', credits: 3, type: null },
        ],
      },
      credit_requirements: [
        { label: 'Degree Credit Requirement', required: 120, earned: 45, in_progress: 3, needed: 72 },
        { label: 'Major Credits', required: 42, earned: 18, in_progress: 3, needed: 21 },
      ],
    },
  }
}

describe('ProgressPage snapshot regression', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.jwt = 'test-jwt'
    mocks.preferences = { hasProgramEvaluation: true }
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    vi.restoreAllMocks()
  })

  async function render() {
    const { default: ProgressPage } = await import('../components/progress/ProgressPage')
    await act(async () => {
      root.render(<ProgressPage />)
    })
  }

  it('matches snapshot with fixed progress data (2 completed, 1 in-progress, GPA 3.5, 45/120)', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(makeFixedProgressData()) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(container.innerHTML).toMatchSnapshot()
  })

  it('snapshot is stable across re-renders', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(makeFixedProgressData()) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()
    const firstSnapshot = container.innerHTML

    // Unmount and re-render
    act(() => { root.unmount() })
    root = createRoot(container)
    await render()

    expect(container.innerHTML).toBe(firstSnapshot)
  })

  it('matches snapshot with 0 courses (empty state)', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(null) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(container.innerHTML).toMatchSnapshot()
  })
})
