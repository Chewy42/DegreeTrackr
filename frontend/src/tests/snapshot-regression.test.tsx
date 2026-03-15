// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Enable React 18 act() environment
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  jwt: 'test-jwt',
  preferences: { hasProgramEvaluation: true, onboardingComplete: false } as Record<string, unknown>,
  mergePreferences: vi.fn(),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn().mockResolvedValue({ session: { id: 's1' }, messages: [], suggestions: [] }),
  listChatSessions: vi.fn().mockResolvedValue([]),
  deleteChatSession: vi.fn(),
  clearExploreSessions: vi.fn(),
  getConvexClient: vi.fn(),
  convexApi: { profile: { completeCurrentOnboarding: 'profile:completeCurrentOnboarding' } },
  useMutation: vi.fn().mockReturnValue(vi.fn()),
  deleteCurrentProgramEvaluationBoundary: vi.fn(),
}))

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: mocks.jwt,
    preferences: mocks.preferences,
    mergePreferences: mocks.mergePreferences,
  }),
}))

vi.mock('../lib/convex', () => ({
  getSessionMessagesConvex: mocks.getSessionMessages,
  sendCurrentExploreMessageConvex: mocks.sendMessage,
  listChatSessionsConvex: mocks.listChatSessions,
  deleteChatSessionConvex: mocks.deleteChatSession,
  clearExploreSessionsConvex: mocks.clearExploreSessions,
  getConvexClient: mocks.getConvexClient,
  deleteCurrentProgramEvaluationBoundary: mocks.deleteCurrentProgramEvaluationBoundary,
}))

vi.mock('../lib/convex/api', () => ({
  convexApi: mocks.convexApi,
}))

vi.mock('convex/react', () => ({
  useMutation: mocks.useMutation,
}))

vi.mock('react-router-dom', () => ({
  Navigate: (props: any) => React.createElement('div', { 'data-testid': 'navigate', 'data-to': props.to }),
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'markdown' }, children),
}))

vi.mock('remark-gfm', () => ({ default: () => {} }))

vi.mock('../components/schedule/ClassDetailsModal', () => ({
  default: () => React.createElement('div', { 'data-testid': 'class-details-modal' }),
}))

vi.mock('react-icons/fi', () =>
  new Proxy({}, {
    get: (_target, name) => (props: any) =>
      React.createElement('span', { ...props, 'data-icon': name }),
  }),
)

// Stub ResizeObserver
vi.stubGlobal('ResizeObserver', vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})))

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeTwoClasses() {
  const baseDays = { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [] }
  return [
    {
      id: 'CS-101-01', code: 'CS 101-01', subject: 'CS', number: '101', section: '01',
      title: 'Intro to CS', credits: 3, displayDays: 'MWF', displayTime: '9:00am - 9:50am',
      location: 'SCI 200', professor: 'Dr. Smith', professorRating: 4.5, semester: 'spring2026',
      semestersOffered: ['Spring', 'Fall'], color: '#3b82f6',
      requirementsSatisfied: [],
      occurrenceData: {
        starts: 1700000000, ends: 1700100000,
        daysOccurring: { ...baseDays, M: [{ startTime: 540, endTime: 590 }], W: [{ startTime: 540, endTime: 590 }], F: [{ startTime: 540, endTime: 590 }] },
      },
    },
    {
      id: 'MATH-200-02', code: 'MATH 200-02', subject: 'MATH', number: '200', section: '02',
      title: 'Calculus II', credits: 4, displayDays: 'TuTh', displayTime: '1:00pm - 2:15pm',
      location: 'MATH 110', professor: 'Dr. Lee', professorRating: 4.2, semester: 'spring2026',
      semestersOffered: ['Spring'], color: '#ef4444',
      requirementsSatisfied: [],
      occurrenceData: {
        starts: 1700000000, ends: 1700100000,
        daysOccurring: { ...baseDays, Tu: [{ startTime: 780, endTime: 855 }], Th: [{ startTime: 780, endTime: 855 }] },
      },
    },
  ]
}

function makeThreeSessions() {
  return [
    { _id: 'sess-1', title: 'Course advice', scope: 'explore' as const, lastMessageAt: 1700000000000, createdAt: 1699990000000 },
    { _id: 'sess-2', title: 'Schedule help', scope: 'explore' as const, lastMessageAt: 1700001000000, createdAt: 1699991000000 },
    { _id: 'sess-3', title: 'GPA calc', scope: 'explore' as const, lastMessageAt: 1700002000000, createdAt: 1699992000000 },
  ]
}

// ── Test helpers ────────────────────────────────────────────────────────────

describe('Snapshot regression suite', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.preferences = { hasProgramEvaluation: true, onboardingComplete: false }
    try { sessionStorage.removeItem('degreetrackr.onboarding_progress') } catch {}
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
  })

  // ── 1. WeeklyCalendar ──────────────────────────────────────────────────

  describe('WeeklyCalendar', () => {
    async function render(classes = makeTwoClasses()) {
      const { default: WeeklyCalendar } = await import('../components/schedule/WeeklyCalendar')
      await act(async () => {
        root.render(
          <WeeklyCalendar classes={classes} onRemoveClass={vi.fn()} conflicts={{}} />,
        )
      })
    }

    it('matches snapshot with 2 classes on fixed days/times', async () => {
      await render()
      expect(container).toMatchSnapshot()
    })

    it('snapshot is stable on second render', async () => {
      await render()
      const first = container.innerHTML
      act(() => { root.unmount() })
      root = createRoot(container)
      await render()
      expect(container.innerHTML).toBe(first)
    })
  })

  // ── 2. ExploreChat ────────────────────────────────────────────────────

  describe('ExploreChat', () => {
    async function render(sessionId: string | null = 'sess-1') {
      mocks.getSessionMessages.mockResolvedValue([
        { role: 'user', content: 'What courses should I take?', timestamp: new Date('2026-01-15T10:00:00Z') },
        { role: 'assistant', content: 'Based on your major, I recommend CS 201.', timestamp: new Date('2026-01-15T10:00:05Z') },
        { role: 'user', content: 'What about electives?', timestamp: new Date('2026-01-15T10:00:10Z') },
      ])
      const { default: ExploreChat } = await import('../components/ExploreChat')
      await act(async () => {
        root.render(<ExploreChat sessionId={sessionId} onSessionChange={vi.fn()} />)
      })
      // Wait for async history load
      await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    }

    it('matches snapshot with 3 messages (2 user, 1 bot)', async () => {
      await render()
      expect(container).toMatchSnapshot()
    })

    it('snapshot is stable on second render', async () => {
      await render()
      const first = container.innerHTML
      act(() => { root.unmount() })
      root = createRoot(container)
      await render()
      expect(container.innerHTML).toBe(first)
    })
  })

  // ── 3. ProgressCard (DegreeProgressCard) ──────────────────────────────

  describe('DegreeProgressCard', () => {
    async function render() {
      const { default: DegreeProgressCard } = await import('../components/progress/DegreeProgressCard')
      await act(async () => {
        root.render(
          <DegreeProgressCard
            progress={50}
            totalCredits={120}
            earnedCredits={60}
            inProgressCredits={6}
            hasEvaluation={true}
            programName="B.S. Computer Science"
          />,
        )
      })
    }

    it('matches snapshot with GPA 3.5, 60/120 credits, 50% complete', async () => {
      await render()
      expect(container).toMatchSnapshot()
    })

    it('snapshot is stable on second render', async () => {
      await render()
      const first = container.innerHTML
      act(() => { root.unmount() })
      root = createRoot(container)
      await render()
      expect(container.innerHTML).toBe(first)
    })
  })

  // ── 4. ChatHistorySidebar ─────────────────────────────────────────────

  describe('ChatHistorySidebar', () => {
    async function render(activeId: string | null = 'sess-2') {
      mocks.listChatSessions.mockResolvedValue(makeThreeSessions())
      const { default: ChatHistorySidebar } = await import('../components/ChatHistorySidebar')
      await act(async () => {
        root.render(
          <ChatHistorySidebar onSelectSession={vi.fn()} currentSessionId={activeId} />,
        )
      })
      // Wait for async session load
      await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    }

    it('matches snapshot with 3 sessions, 1 active', async () => {
      await render()
      expect(container).toMatchSnapshot()
    })

    it('snapshot is stable on second render', async () => {
      await render()
      const first = container.innerHTML
      act(() => { root.unmount() })
      root = createRoot(container)
      await render()
      expect(container.innerHTML).toBe(first)
    })
  })

  // ── 5. OnboardingChat ─────────────────────────────────────────────────

  describe('OnboardingChat', () => {
    async function render() {
      const { default: OnboardingChat } = await import('../components/OnboardingChat')
      await act(async () => {
        root.render(<OnboardingChat />)
      })
    }

    it('matches snapshot showing first question, no answers', async () => {
      await render()
      expect(container).toMatchSnapshot()
    })

    it('snapshot is stable on second render', async () => {
      await render()
      const first = container.innerHTML
      act(() => { root.unmount() })
      root = createRoot(container)
      await render()
      expect(container.innerHTML).toBe(first)
    })
  })
})
