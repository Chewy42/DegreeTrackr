// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

// ── OnboardingChat mocks ────────────────────────────────────────────────────

const onboardingMocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn().mockResolvedValue({}),
  mergePreferences: vi.fn(),
  preferences: { onboardingComplete: false } as Record<string, boolean>,
}))

vi.mock('convex/react', () => ({
  useMutation: () => onboardingMocks.completeOnboarding,
  useQuery: () => undefined,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: 'test-jwt',
    mergePreferences: onboardingMocks.mergePreferences,
    preferences: onboardingMocks.preferences,
  }),
}))

vi.mock('../lib/convex/api', () => ({
  convexApi: {
    profile: { completeCurrentOnboarding: 'profile:completeCurrentOnboarding' },
    evaluations: {
      clearCurrentProgramEvaluation: 'evaluations:clearCurrentProgramEvaluation',
      getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation',
    },
    draftSchedule: {
      getDraftSchedule: 'draftSchedule:getDraftSchedule',
      saveDraftSchedule: 'draftSchedule:saveDraftSchedule',
    },
  },
}))

vi.mock('../lib/convex', () => ({
  getConvexClient: () => null,
  deleteCurrentProgramEvaluationBoundary: vi.fn(),
  getSessionMessagesConvex: vi.fn().mockResolvedValue([]),
  sendCurrentExploreMessageConvex: vi.fn().mockResolvedValue({
    session: { id: 'session-1' },
    messages: [],
    suggestions: [],
  }),
  syncCurrentProgramEvaluationFromLegacy: vi.fn(),
  convexApi: {
    evaluations: { getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation' },
    draftSchedule: {
      getDraftSchedule: 'draftSchedule:getDraftSchedule',
      saveDraftSchedule: 'draftSchedule:saveDraftSchedule',
    },
  },
}))

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) =>
    React.createElement('div', { 'data-testid': 'navigate-redirect', 'data-to': to }),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement('a', { href: to, ...rest }, children),
}))

vi.mock('./ThemeModeToggle', () => ({
  default: ({ collapsed }: { collapsed?: boolean }) =>
    React.createElement('button', { 'data-testid': 'theme-toggle', 'aria-label': 'Toggle theme' }),
}))

vi.mock('../theme/AppThemeProvider', () => ({
  useAppTheme: () => ({ mode: 'light' as const, toggleMode: vi.fn() }),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', null, children),
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: () => {},
}))

vi.mock('../lib/scheduleApi', () => ({
  validateScheduledClassesLocally: vi.fn().mockReturnValue({ valid: true, conflicts: [], totalCredits: 0, warnings: [] }),
  generateAutoSchedule: vi.fn(),
  getClassById: vi.fn(),
  createScheduleSnapshot: vi.fn(),
  listScheduleSnapshots: vi.fn(),
  deleteScheduleSnapshot: vi.fn(),
  deriveRequirementsSummaryFromProgramEvaluation: vi.fn().mockReturnValue(null),
}))

// Mock progress child components to isolate ProgressPage
vi.mock('./progress/DegreeProgressCard', () => ({
  default: (props: any) => React.createElement('div', { role: 'region', 'aria-label': 'Degree progress' }, `progress:${props.progress}`),
}))
vi.mock('./progress/CreditBreakdownChart', () => ({
  default: () => React.createElement('div', { role: 'img', 'aria-label': 'Credit breakdown chart' }),
}))
vi.mock('./progress/GPATrendChart', () => ({
  default: () => React.createElement('div', { role: 'img', 'aria-label': 'GPA trend chart' }),
}))
vi.mock('./progress/RequirementsChecklist', () => ({
  default: (props: any) => React.createElement('ul', { 'aria-label': 'Requirements' }),
}))
vi.mock('./progress/CourseHistoryTimeline', () => ({
  default: () => React.createElement('div', { role: 'list', 'aria-label': 'Course history' }),
}))
vi.mock('./progress/UpcomingMilestones', () => ({
  default: () => React.createElement('div', { role: 'list', 'aria-label': 'Upcoming milestones' }),
}))

// Mock schedule child components
vi.mock('./schedule/ClassSearchSidebar', () => ({
  default: () => React.createElement('div', { 'data-testid': 'class-search-sidebar' }),
}))
vi.mock('./schedule/WeeklyCalendar', () => ({
  default: () => React.createElement('div', { 'data-testid': 'weekly-calendar', role: 'grid', 'aria-label': 'Weekly schedule' }),
}))
vi.mock('./schedule/WarningModal', () => ({
  default: () => null,
}))
vi.mock('./schedule/ScheduleImpactModal', () => ({
  default: () => null,
}))
vi.mock('./schedule/SnapshotManagerModal', () => ({
  default: () => null,
}))
vi.mock('../lib/scheduleExport', () => ({
  exportAsJSON: vi.fn(),
  exportAsCSV: vi.fn(),
}))

// ── Shared render helpers ───────────────────────────────────────────────────

describe('axe a11y audit', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    sessionStorage.clear()
    vi.clearAllMocks()
    onboardingMocks.preferences = { onboardingComplete: false }
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  it('OnboardingChat has no axe violations', async () => {
    const { default: OnboardingChat } = await import('./OnboardingChat')
    await act(async () => {
      root.render(<OnboardingChat />)
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('ExploreChat has no axe violations', async () => {
    const { default: ExploreChat } = await import('./ExploreChat')
    await act(async () => {
      root.render(<ExploreChat sessionId={null} onSessionChange={vi.fn()} />)
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('Sidebar has no axe violations', async () => {
    const { default: Sidebar } = await import('./Sidebar')
    await act(async () => {
      root.render(<Sidebar />)
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('ProgressPage has no axe violations', async () => {
    const { default: ProgressPage } = await import('./progress/ProgressPage')
    await act(async () => {
      root.render(<ProgressPage />)
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('ScheduleBuilder has no axe violations', async () => {
    const { default: ScheduleBuilder } = await import('./schedule/ScheduleBuilder')
    await act(async () => {
      root.render(<ScheduleBuilder />)
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
