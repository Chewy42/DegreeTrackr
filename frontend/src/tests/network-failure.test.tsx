// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  jwt: 'test-jwt' as string | null,
  preferences: { hasProgramEvaluation: true } as Record<string, unknown>,
  getConvexClient: vi.fn(),
  syncCurrentProgramEvaluationFromLegacy: vi.fn(),
  usePageTitle: vi.fn(),
  getSessionMessages: vi.fn(),
  sendMessage: vi.fn(),
  validateScheduledClassesLocally: vi.fn().mockReturnValue({
    valid: true, conflicts: [], totalCredits: 0, warnings: [],
  }),
  generateAutoSchedule: vi.fn(),
  getClassById: vi.fn(),
  createScheduleSnapshot: vi.fn(),
  listScheduleSnapshots: vi.fn().mockResolvedValue([]),
  deleteScheduleSnapshot: vi.fn(),
  deriveRequirementsSummaryFromProgramEvaluation: vi.fn().mockReturnValue(null),
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
  convexApi: {
    evaluations: {
      getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation',
      hydrateCurrentProgramEvaluationFromLegacy: 'evaluations:hydrateCurrentProgramEvaluationFromLegacy',
    },
    draftSchedule: {
      getDraftSchedule: 'draftSchedule:getDraftSchedule',
      saveDraftSchedule: 'draftSchedule:saveDraftSchedule',
    },
  },
  getConvexClient: (...args: any[]) => mocks.getConvexClient(...args),
  syncCurrentProgramEvaluationFromLegacy: (...args: any[]) => mocks.syncCurrentProgramEvaluationFromLegacy(...args),
  getSessionMessagesConvex: (...args: any[]) => mocks.getSessionMessages(...args),
  sendCurrentExploreMessageConvex: (...args: any[]) => mocks.sendMessage(...args),
}))

vi.mock('../lib/scheduleApi', () => ({
  validateScheduledClassesLocally: mocks.validateScheduledClassesLocally,
  generateAutoSchedule: mocks.generateAutoSchedule,
  getClassById: mocks.getClassById,
  createScheduleSnapshot: mocks.createScheduleSnapshot,
  listScheduleSnapshots: mocks.listScheduleSnapshots,
  deleteScheduleSnapshot: mocks.deleteScheduleSnapshot,
  deriveRequirementsSummaryFromProgramEvaluation: mocks.deriveRequirementsSummaryFromProgramEvaluation,
}))

vi.mock('../lib/scheduleExport', () => ({
  exportAsJSON: vi.fn().mockReturnValue([]),
  exportAsCSV: vi.fn().mockReturnValue(''),
}))

// Mock ProgressPage child components
vi.mock('../components/progress/DegreeProgressCard', () => ({
  default: () => React.createElement('div', { 'data-testid': 'degree-progress-card' }),
}))
vi.mock('../components/progress/CreditBreakdownChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'credit-chart' }),
}))
vi.mock('../components/progress/GPATrendChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'gpa-chart' }),
}))
vi.mock('../components/progress/RequirementsChecklist', () => ({
  default: () => React.createElement('div', { 'data-testid': 'requirements-checklist' }),
}))
vi.mock('../components/progress/CourseHistoryTimeline', () => ({
  default: () => React.createElement('div', { 'data-testid': 'course-timeline' }),
}))
vi.mock('../components/progress/UpcomingMilestones', () => ({
  default: () => React.createElement('div', { 'data-testid': 'milestones' }),
}))

// Mock ScheduleBuilder child components
vi.mock('../components/schedule/ClassSearchSidebar', () => ({
  default: () => React.createElement('div', { 'data-testid': 'sidebar' }),
}))
vi.mock('../components/schedule/WeeklyCalendar', () => ({
  default: () => React.createElement('div', { 'data-testid': 'calendar' }),
}))
vi.mock('../components/schedule/WarningModal', () => ({ default: () => null }))
vi.mock('../components/schedule/ScheduleImpactModal', () => ({ default: () => null }))
vi.mock('../components/schedule/SnapshotManagerModal', () => ({ default: () => null }))

// Stub react-icons
vi.mock('react-icons/fi', () => new Proxy({}, {
  get: (_target, name) => (props: any) => React.createElement('span', { ...props, 'data-icon': name }),
}))

// Stub markdown renderer
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'markdown' }, children),
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

// ─────────────────────────────────────────────────────────────────────────────
// DT115 — Network failure resilience
// ─────────────────────────────────────────────────────────────────────────────

describe('DT115 — Network failure graceful degradation', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.jwt = 'test-jwt'
    mocks.preferences = { hasProgramEvaluation: true }
    mocks.getConvexClient.mockReturnValue(null)
    mocks.listScheduleSnapshots.mockResolvedValue([])
    Element.prototype.scrollTo = vi.fn()
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  // ── ProgressPage / Dashboard ────────────────────────────────────────────

  describe('ProgressPage — loading state (query returns undefined/null)', () => {
    async function renderProgress() {
      const { default: ProgressPage } = await import('../components/progress/ProgressPage')
      await act(async () => { root.render(<ProgressPage />) })
    }

    it('shows loading skeleton when Convex query is pending, not a crash', async () => {
      // Query that never resolves — simulates network loading
      mocks.getConvexClient.mockReturnValue({
        query: vi.fn().mockReturnValue(new Promise(() => {})),
      })

      await renderProgress()

      // loadState starts as "idle" → renders loading spinner
      const status = container.querySelector('[role="status"]')
      expect(status).toBeTruthy()
      expect(container.textContent).toContain('Loading your progress')
      expect(container.querySelector('[role="alert"]')).toBeNull()
    })

    it('shows error state when query throws, not a crash', async () => {
      mocks.getConvexClient.mockReturnValue({
        query: vi.fn().mockRejectedValue(new Error('Network timeout')),
      })

      await renderProgress()

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toBeTruthy()
      expect(container.textContent).toContain('Network timeout')
      expect(container.textContent).toContain('Retry')
    })
  })

  describe('ProgressPage — Convex client offline (all queries undefined)', () => {
    it('shows loading state gracefully when client returns null', async () => {
      mocks.getConvexClient.mockReturnValue(null)

      const { default: ProgressPage } = await import('../components/progress/ProgressPage')
      await act(async () => { root.render(<ProgressPage />) })

      // With null client, fetchProgress returns early — loadState stays idle → shows spinner
      const status = container.querySelector('[role="status"]')
      expect(status).toBeTruthy()
      expect(container.textContent).toContain('Loading your progress')
      expect(container.querySelector('[role="alert"]')).toBeNull()
    })
  })

  describe('ScheduleBuilder — mutation throws NetworkError', () => {
    it('shows error toast when auto-generate fails with network error', async () => {
      mocks.getConvexClient.mockReturnValue(null)
      mocks.generateAutoSchedule.mockRejectedValue(new Error('Something went wrong'))

      const { default: ScheduleBuilder } = await import('../components/schedule/ScheduleBuilder')
      await act(async () => { root.render(<ScheduleBuilder />) })

      // Find and click the Auto Generate button
      const autoBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent?.includes('Auto Generate') || b.textContent?.includes('Auto'),
      )
      expect(autoBtn).toBeTruthy()

      await act(async () => { autoBtn!.click() })

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toBeTruthy()
      expect(container.textContent).toContain('Something went wrong')
    })
  })

  // ── ExploreChat ─────────────────────────────────────────────────────────

  describe('ExploreChat — failed message send', () => {
    it('shows error message and re-enables input on send failure', async () => {
      mocks.getSessionMessages.mockResolvedValue([])
      mocks.sendMessage.mockRejectedValue(new Error('NetworkError: failed to fetch'))

      const { default: ExploreChat } = await import('../components/ExploreChat')
      await act(async () => {
        root.render(<ExploreChat sessionId={null} onSessionChange={vi.fn()} />)
      })

      // Type a message
      const input = container.querySelector('input[aria-label="Message to AI advisor"]') as HTMLInputElement
      const form = container.querySelector('form') as HTMLFormElement
      expect(input).toBeTruthy()

      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
          .call(input, 'Hello advisor')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })

      // Submit the form
      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })

      // Error message should appear
      const markdownSpans = container.querySelectorAll('[data-testid="markdown"]')
      const texts = Array.from(markdownSpans).map(el => el.textContent)
      expect(texts).toContain('Sorry, I encountered an error. Please try again.')

      // Input should be re-enabled
      const inputAfter = container.querySelector('input[aria-label="Message to AI advisor"]') as HTMLInputElement
      expect(inputAfter.disabled).toBe(false)

      // Retry button should be visible
      const retryBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent?.includes('Retry last message'),
      )
      expect(retryBtn).toBeTruthy()
    })
  })

  describe('ExploreChat — history load failure', () => {
    it('shows error alert when session history fails to load', async () => {
      mocks.getSessionMessages.mockRejectedValue(new Error('Network failure'))

      const { default: ExploreChat } = await import('../components/ExploreChat')
      await act(async () => {
        root.render(<ExploreChat sessionId="session-99" onSessionChange={vi.fn()} />)
      })

      const alert = container.querySelector('[role="alert"]')
      expect(alert).toBeTruthy()
      expect(container.textContent).toContain("couldn't load this chat history")
    })
  })
})
