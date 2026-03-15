// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── ProgressPage mocks ──────────────────────────────────────────────────────

const progressMocks = vi.hoisted(() => ({
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
  usePageTitle: progressMocks.usePageTitle,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: progressMocks.jwt,
    preferences: progressMocks.preferences,
  }),
}))

vi.mock('../lib/convex', () => ({
  convexApi: progressMocks.convexApi,
  getConvexClient: progressMocks.getConvexClient,
  syncCurrentProgramEvaluationFromLegacy: progressMocks.syncCurrentProgramEvaluationFromLegacy,
  getSessionMessagesConvex: vi.fn().mockResolvedValue([]),
  sendCurrentExploreMessageConvex: vi.fn(),
}))

// Stub ProgressPage child components
vi.mock('./progress/DegreeProgressCard', () => ({
  default: () => React.createElement('div', { 'data-testid': 'degree-progress-card' }),
}))
vi.mock('./progress/CreditBreakdownChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'credit-chart' }),
}))
vi.mock('./progress/GPATrendChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'gpa-chart' }),
}))
vi.mock('./progress/RequirementsChecklist', () => ({
  default: () => React.createElement('div', { 'data-testid': 'requirements-checklist' }),
}))
vi.mock('./progress/CourseHistoryTimeline', () => ({
  default: () => React.createElement('div', { 'data-testid': 'course-timeline' }),
}))
vi.mock('./progress/UpcomingMilestones', () => ({
  default: () => React.createElement('div', { 'data-testid': 'milestones' }),
}))

// Stub react-icons
vi.mock('react-icons/fi', () => ({
  FiRefreshCw: (props: any) => React.createElement('span', props, 'refresh-icon'),
  FiAlertCircle: (props: any) => React.createElement('span', props, 'alert-icon'),
  FiSend: (props: any) => React.createElement('span', props, 'send-icon'),
  FiPlus: (props: any) => React.createElement('span', props, 'plus-icon'),
  FiMessageSquare: (props: any) => React.createElement('span', props, 'message-icon'),
  FiRefreshCcw: (props: any) => React.createElement('span', props, 'refresh-ccw'),
}))

// Stub markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'markdown' }, children),
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSampleData() {
  return {
    parsed_data: {
      student_info: { name: 'Doe, Jane', program: 'B.S. Computer Science' },
      gpa: { overall: 3.75, major: 3.82 },
      courses: {
        all_found: [{ term: 'Fall 2023', subject: 'CS', number: '101', title: 'Intro', grade: 'A', credits: 3, type: null }],
        in_progress: [],
        completed: [{ term: 'Fall 2023', subject: 'CS', number: '101', title: 'Intro', grade: 'A', credits: 3, type: null }],
      },
      credit_requirements: [
        { label: 'Degree Credit Requirement', required: 120, earned: 60, in_progress: 3, needed: 57 },
      ],
    },
  }
}

// ── ProgressPage error recovery ─────────────────────────────────────────────

describe('ProgressPage — error recovery flow', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    progressMocks.jwt = 'test-jwt'
    progressMocks.preferences = { hasProgramEvaluation: false }
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

  it('loading state: shows loading indicator when query has not resolved (not a crash)', async () => {
    const mockClient = { query: vi.fn().mockReturnValue(new Promise(() => {})) }
    progressMocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(container.textContent).toContain('Loading your progress')
    // No crash — no error alert
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('not found state: shows empty state message when query returns null', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue(null) }
    progressMocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    expect(container.textContent).toContain('No Progress Data Available')
    expect(container.textContent).toContain('Upload your program evaluation PDF')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('error state: shows error message with retry button on query failure', async () => {
    const mockClient = { query: vi.fn().mockRejectedValue(new Error('Connection lost')) }
    progressMocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(container.textContent).toContain('Connection lost')
    expect(container.textContent).toContain('Error Loading Progress')

    const retryBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Retry'),
    )
    expect(retryBtn).toBeDefined()
  })

  it('network recovery: after error, retry with valid data shows content (not stuck on error)', async () => {
    // First render: query fails
    const mockClient = {
      query: vi.fn()
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValueOnce(makeSampleData()),
    }
    progressMocks.getConvexClient.mockReturnValue(mockClient)

    await render()

    // Verify error state
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('Connection lost')

    // Click retry
    const retryBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Retry'),
    )!
    await act(async () => { retryBtn.click() })

    // Now shows data, not error
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('Jane Doe')
    expect(container.querySelector('[data-testid="degree-progress-card"]')).not.toBeNull()
  })
})

// ── ExploreChat error recovery ──────────────────────────────────────────────

describe('ExploreChat — error recovery flow', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
  })

  function getBtn(text: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.textContent?.includes(text),
    )
  }

  it('loading state: shows typing indicator while awaiting response (no crash)', async () => {
    const { sendCurrentExploreMessageConvex } = await import('../lib/convex')
    const deferred = new Promise(() => {}) // never resolves
    vi.mocked(sendCurrentExploreMessageConvex).mockReturnValueOnce(deferred as any)

    const { default: ExploreChat } = await import('./ExploreChat')
    await act(async () => {
      root.render(<ExploreChat sessionId={null} onSessionChange={vi.fn()} />)
    })

    const suggestionBtn = getBtn('What can I do with my major?')!
    act(() => { suggestionBtn.click() })

    const srOnly = Array.from(container.querySelectorAll('.sr-only'))
    const loadingEl = srOnly.find(el => el.textContent?.includes('AI advisor is responding'))
    expect(loadingEl).not.toBeUndefined()
    // No crash — no alert
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('error state: shows error message with retry button on send failure', async () => {
    const { sendCurrentExploreMessageConvex } = await import('../lib/convex')
    vi.mocked(sendCurrentExploreMessageConvex).mockRejectedValueOnce(new Error('Server error'))

    const { default: ExploreChat } = await import('./ExploreChat')
    await act(async () => {
      root.render(<ExploreChat sessionId={null} onSessionChange={vi.fn()} />)
    })

    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })

    // Error message in chat
    expect(container.textContent).toContain('Sorry, I encountered an error')
    // Retry button
    expect(getBtn('Retry last message')).not.toBeUndefined()
  })

  it('history error state: shows error alert when session history fails to load', async () => {
    const { getSessionMessagesConvex } = await import('../lib/convex')
    vi.mocked(getSessionMessagesConvex).mockRejectedValueOnce(new Error('History failed'))

    const { default: ExploreChat } = await import('./ExploreChat')
    await act(async () => {
      root.render(<ExploreChat sessionId="session-abc" onSessionChange={vi.fn()} />)
    })

    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(container.textContent).toContain("couldn't load this chat history")
  })

  it('network recovery: after send error, retry succeeds and shows content', async () => {
    const { sendCurrentExploreMessageConvex } = await import('../lib/convex')
    const successResult = {
      session: { id: 'session-1' },
      messages: [
        { role: 'user' as const, content: 'What can I do?', createdAt: Date.now() },
        { role: 'assistant' as const, content: 'Here are your options.', createdAt: Date.now() },
      ],
      suggestions: [],
    }

    vi.mocked(sendCurrentExploreMessageConvex)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(successResult)

    const { default: ExploreChat } = await import('./ExploreChat')
    await act(async () => {
      root.render(<ExploreChat sessionId={null} onSessionChange={vi.fn()} />)
    })

    // Trigger error
    const suggestionBtn = getBtn('What can I do with my major?')!
    await act(async () => { suggestionBtn.click() })
    expect(container.textContent).toContain('Sorry, I encountered an error')

    // Retry
    const retryBtn = getBtn('Retry last message')!
    await act(async () => { retryBtn.click() })

    // Shows recovered content
    expect(container.textContent).toContain('Here are your options.')
    // Retry button should be gone
    expect(getBtn('Retry last message')).toBeUndefined()
  })
})
