// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

// ── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: 'test-jwt',
    preferences: { onboardingComplete: true, hasProgramEvaluation: false },
  }),
}))

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: () => {},
}))

vi.mock('../lib/convex', () => ({
  getConvexClient: () => ({
    query: vi.fn().mockResolvedValue(null),
    action: vi.fn().mockResolvedValue(null),
    mutation: vi.fn().mockResolvedValue(null),
  }),
  convexApi: {
    evaluations: {
      getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation',
    },
    draftSchedule: {
      getDraftSchedule: 'draftSchedule:getDraftSchedule',
      saveDraftSchedule: 'draftSchedule:saveDraftSchedule',
    },
  },
  syncCurrentProgramEvaluationFromLegacy: vi.fn().mockResolvedValue(null),
  getSessionMessagesConvex: vi.fn().mockResolvedValue([]),
  sendCurrentExploreMessageConvex: vi.fn(),
}))

vi.mock('../lib/scheduleApi', () => ({
  deriveRequirementsSummaryFromProgramEvaluation: vi.fn().mockResolvedValue(null),
  validateScheduledClassesLocally: vi.fn().mockReturnValue({
    valid: true,
    conflicts: [],
    totalCredits: 0,
    warnings: [],
  }),
  generateAutoSchedule: vi.fn(),
  getClassById: vi.fn(),
  getSubjects: vi.fn().mockResolvedValue({ subjects: [] }),
  searchClasses: vi.fn().mockResolvedValue({ classes: [] }),
  createScheduleSnapshot: vi.fn(),
  listScheduleSnapshots: vi.fn().mockResolvedValue([]),
  deleteScheduleSnapshot: vi.fn(),
}))

vi.mock('../lib/scheduleExport', () => ({
  exportAsJSON: vi.fn(),
  exportAsCSV: vi.fn(),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'markdown' }, children),
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}))

vi.mock('../lib/convex/api', () => ({
  convexApi: {
    evaluations: {
      getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation',
    },
    draftSchedule: {
      getDraftSchedule: 'draftSchedule:getDraftSchedule',
      saveDraftSchedule: 'draftSchedule:saveDraftSchedule',
    },
  },
}))

// ── Imports (after mocks) ────────────────────────────────────────────────────

import ProgressPage from '../components/progress/ProgressPage'
import ScheduleBuilder from '../components/schedule/ScheduleBuilder'

// ── Suite ────────────────────────────────────────────────────────────────────

describe('A11y final sweep', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  it('Dashboard (ProgressPage) has no axe violations', async () => {
    await act(async () => { root.render(<ProgressPage />) })
    await act(async () => { await new Promise(r => setTimeout(r, 100)) })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('ProgressPage in empty state has no axe violations', async () => {
    await act(async () => { root.render(<ProgressPage />) })
    // Let loading → empty state transition complete
    await act(async () => { await new Promise(r => setTimeout(r, 200)) })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('ScheduleBuilder has no axe violations', async () => {
    await act(async () => { root.render(<ScheduleBuilder />) })
    await act(async () => { await new Promise(r => setTimeout(r, 100)) })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
