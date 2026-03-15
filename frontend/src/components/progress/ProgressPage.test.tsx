// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('../../hooks/usePageTitle', () => ({
  usePageTitle: mocks.usePageTitle,
}))

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: mocks.jwt,
    preferences: mocks.preferences,
  }),
}))

vi.mock('../../lib/convex', () => ({
  convexApi: mocks.convexApi,
  getConvexClient: mocks.getConvexClient,
  syncCurrentProgramEvaluationFromLegacy: mocks.syncCurrentProgramEvaluationFromLegacy,
}))

// Mock child components to isolate ProgressPage logic
let capturedChecklistProps: any = null
let capturedTimelineProps: any = null
let capturedMilestonesProps: any = null

vi.mock('./DegreeProgressCard', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'degree-progress-card' }, `progress:${props.progress}`),
}))
vi.mock('./CreditBreakdownChart', () => ({
  default: (props: any) =>
    React.createElement('div', { 'data-testid': 'credit-chart' }, `earned:${props.earned}`),
}))
vi.mock('./GPATrendChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'gpa-chart' }),
}))
vi.mock('./RequirementsChecklist', () => ({
  default: (props: any) => {
    capturedChecklistProps = props
    return React.createElement(
      'div',
      { 'data-testid': 'requirements-checklist' },
      `reqs:${props.requirements.length}`,
    )
  },
}))
vi.mock('./CourseHistoryTimeline', () => ({
  default: (props: any) => {
    capturedTimelineProps = props
    return React.createElement('div', { 'data-testid': 'course-timeline' })
  },
}))
vi.mock('./UpcomingMilestones', () => ({
  default: (props: any) => {
    capturedMilestonesProps = props
    return React.createElement('div', { 'data-testid': 'milestones' })
  },
}))
vi.mock('react-icons/fi', () => ({
  FiRefreshCw: (props: any) => React.createElement('span', props, 'refresh-icon'),
  FiAlertCircle: (props: any) => React.createElement('span', props, 'alert-icon'),
}))

function makeSampleData() {
  return {
    parsed_data: {
      student_info: {
        name: 'Doe, Jane',
        program: 'B.S. Computer Science',
        expected_graduation: 'Spring 2026',
      },
      gpa: { overall: 3.75, major: 3.82 },
      courses: {
        all_found: [
          { term: 'Fall 2023', subject: 'CS', number: '101', title: 'Intro CS', grade: 'A', credits: 3, type: null },
          { term: 'Fall 2023', subject: 'MATH', number: '201', title: 'Calculus', grade: 'B+', credits: 4, type: null },
        ],
        in_progress: [
          { term: 'Spring 2024', subject: 'CS', number: '301', title: 'Algorithms', grade: null, credits: 3, type: null },
        ],
        completed: [
          { term: 'Fall 2023', subject: 'CS', number: '101', title: 'Intro CS', grade: 'A', credits: 3, type: null },
          { term: 'Fall 2023', subject: 'MATH', number: '201', title: 'Calculus', grade: 'B+', credits: 4, type: null },
        ],
      },
      credit_requirements: [
        { label: 'Degree Credit Requirement', required: 120, earned: 60, in_progress: 3, needed: 57 },
        { label: 'Major Credits', required: 42, earned: 21, in_progress: 3, needed: 18 },
      ],
    },
  }
}

describe('ProgressPage', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    capturedChecklistProps = null
    capturedTimelineProps = null
    capturedMilestonesProps = null
    mocks.jwt = 'test-jwt'
    mocks.preferences = { hasProgramEvaluation: false }
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
    vi.restoreAllMocks()
  })

  async function render() {
    const { default: ProgressPage } = await import('./ProgressPage')
    await act(async () => {
      root.render(<ProgressPage />)
    })
  }

  it('renders without crash given sample degree data', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(makeSampleData()) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(container.querySelector('[data-testid="degree-progress-card"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="credit-chart"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="gpa-chart"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="requirements-checklist"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="course-timeline"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="milestones"]')).not.toBeNull()
  })

  it('shows student name (last, first → first last) in heading', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(makeSampleData()) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    const heading = container.querySelector('h1')
    expect(heading).not.toBeNull()
    expect(heading!.textContent).toContain('Jane Doe')
    expect(heading!.textContent).toContain('Progress')
  })

  it('shows current GPA values', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(makeSampleData()) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(container.textContent).toContain('3.75')
    expect(container.textContent).toContain('3.82')
    expect(container.textContent).toContain('Overall GPA')
    expect(container.textContent).toContain('Major GPA')
  })

  it('passes requirements to RequirementsChecklist', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(makeSampleData()) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(capturedChecklistProps).not.toBeNull()
    expect(capturedChecklistProps.requirements).toHaveLength(2)
    expect(capturedChecklistProps.requirements[0].label).toBe('Degree Credit Requirement')
  })

  it('shows loading state initially', async () => {
    // Never-resolving query to keep loading state
    const mockClient = { query: vi.fn().mockReturnValue(new Promise(() => {})) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(container.textContent).toContain('Loading your progress')
  })

  it('shows empty state when no data', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(null) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(container.textContent).toContain('No Progress Data Available')
    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
  })

  it('shows error state with retry button on failure', async () => {
    const mockClient = { query: vi.fn().mockRejectedValue(new Error('Network error')) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(container.textContent).toContain('Network error')

    const retryBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Retry'),
    )
    expect(retryBtn).not.toBeUndefined()
  })

  it('shows credits remaining from primary requirement', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(makeSampleData()) }
    mocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(container.textContent).toContain('Credits Remaining')
    expect(container.textContent).toContain('57')
  })
})
