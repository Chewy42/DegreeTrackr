// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

// ── WeeklyCalendar mocks ────────────────────────────────────────────────────

vi.mock('../components/schedule/ClassDetailsModal', () => ({ default: () => null }))

const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// ── ExploreChat mocks ───────────────────────────────────────────────────────

const exploreMocks = vi.hoisted(() => ({
  getSessionMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn().mockResolvedValue({
    session: { id: 'session-1' },
    messages: [
      { role: 'user' as const, content: 'Hello', createdAt: Date.now() },
      { role: 'assistant' as const, content: 'Hi there!', createdAt: Date.now() },
    ],
    suggestions: [],
  }),
}))

// ── OnboardingChat mocks ────────────────────────────────────────────────────

const onboardingMocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn().mockResolvedValue({}),
  mergePreferences: vi.fn(),
}))

// ── Shared mocks ────────────────────────────────────────────────────────────

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: 'test-jwt',
    mergePreferences: onboardingMocks.mergePreferences,
    preferences: { onboardingComplete: false },
  }),
}))

vi.mock('../lib/convex', () => ({
  getSessionMessagesConvex: exploreMocks.getSessionMessages,
  sendCurrentExploreMessageConvex: exploreMocks.sendMessage,
  getConvexClient: () => null,
  deleteCurrentProgramEvaluationBoundary: vi.fn(),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'markdown' }, children),
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

vi.mock('convex/react', () => ({
  useMutation: () => onboardingMocks.completeOnboarding,
  useQuery: () => undefined,
}))

vi.mock('../lib/convex/api', () => ({
  convexApi: {
    profile: { completeCurrentOnboarding: 'profile:completeCurrentOnboarding' },
    evaluations: { clearCurrentProgramEvaluation: 'evaluations:clearCurrentProgramEvaluation' },
  },
}))

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) =>
    React.createElement('div', { 'data-testid': 'navigate-redirect', 'data-to': to }),
}))

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { WeeklyCalendarUnmemoized } from '../components/schedule/WeeklyCalendar'
import ExploreChat from '../components/ExploreChat'
import OnboardingChat from '../components/OnboardingChat'
import type { ScheduledClass } from '../components/schedule/types'

// ── Factories ───────────────────────────────────────────────────────────────

function makeClass(id: string, code: string): ScheduledClass {
  return {
    id,
    code,
    subject: code.split(' ')[0] ?? 'CS',
    number: '101',
    section: '01',
    title: 'Test Course',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '9:00 AM - 9:50 AM',
    location: 'Room 100',
    professor: 'Prof Test',
    professorRating: null,
    semester: 'spring2026',
    semestersOffered: [],
    requirementsSatisfied: [],
    occurrenceData: {
      starts: 0,
      ends: 0,
      daysOccurring: {
        M: [{ startTime: 540, endTime: 590 }],
        Tu: [],
        W: [{ startTime: 540, endTime: 590 }],
        Th: [],
        F: [{ startTime: 540, endTime: 590 }],
        Sa: [],
        Su: [],
      },
    },
    color: '#BFDBFE',
  }
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('Wave 10 axe regression', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  it('WeeklyCalendar with schedule data has no axe violations', async () => {
    const classes = [
      makeClass('CS-101-01', 'CS 101'),
      makeClass('ENG-301-01', 'ENG 301'),
    ]
    await act(async () => {
      root.render(
        <WeeklyCalendarUnmemoized
          classes={classes}
          onRemoveClass={vi.fn()}
        />,
      )
    })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('ExploreChat with mock messages has no axe violations', async () => {
    exploreMocks.getSessionMessages.mockResolvedValue([
      { role: 'user', content: 'What courses?', createdAt: Date.now() },
      { role: 'assistant', content: 'Here are some options.', createdAt: Date.now() },
    ])

    await act(async () => {
      root.render(
        <ExploreChat sessionId="session-1" onSessionChange={vi.fn()} />,
      )
    })
    // Let async effects settle
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('OnboardingChat with mock has no axe violations', async () => {
    await act(async () => {
      root.render(<OnboardingChat />)
    })
    // Let initial render settle
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
