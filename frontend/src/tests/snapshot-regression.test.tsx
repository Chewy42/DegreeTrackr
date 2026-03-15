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
  listChatSessions: vi.fn().mockResolvedValue([]),
  deleteChatSession: vi.fn(),
  clearExploreSessions: vi.fn(),
  getConvexClient: vi.fn(),
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
  listChatSessionsConvex: mocks.listChatSessions,
  deleteChatSessionConvex: mocks.deleteChatSession,
  clearExploreSessionsConvex: mocks.clearExploreSessions,
  getConvexClient: mocks.getConvexClient,
}))

vi.mock('../lib/convex/api', () => ({
  convexApi: {},
}))

vi.mock('../components/schedule/ClassDetailsModal', () => ({
  default: () => React.createElement('div', { 'data-testid': 'class-details-modal' }),
}))

// Explicit icon stubs — Proxy-based mocks hang vitest during dynamic imports
const iconStub = (name: string) => (props: any) =>
  React.createElement('span', { ...props, 'data-icon': name })

vi.mock('react-icons/fi', () => ({
  FiX: iconStub('FiX'),
  FiAlertTriangle: iconStub('FiAlertTriangle'),
  FiClock: iconStub('FiClock'),
  FiMapPin: iconStub('FiMapPin'),
  FiUser: iconStub('FiUser'),
  FiBook: iconStub('FiBook'),
  FiCalendar: iconStub('FiCalendar'),
  FiAward: iconStub('FiAward'),
  FiMessageSquare: iconStub('FiMessageSquare'),
  FiTrash2: iconStub('FiTrash2'),
}))

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

function makeTwoSessions() {
  return [
    { _id: 'sess-1', title: 'Course advice', scope: 'explore' as const, lastMessageAt: 1700000000000, createdAt: 1699990000000 },
    { _id: 'sess-2', title: 'Schedule help', scope: 'explore' as const, lastMessageAt: 1700001000000, createdAt: 1699991000000 },
  ]
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Snapshot regression suite', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.preferences = { hasProgramEvaluation: true, onboardingComplete: false }
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
      expect(container.firstChild).toMatchSnapshot()
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

  // ── 2. DegreeProgressCard ──────────────────────────────────────────────

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
      expect(container.firstChild).toMatchSnapshot()
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

  // ── 3. ChatHistorySidebar ─────────────────────────────────────────────

  describe('ChatHistorySidebar', () => {
    async function render(activeId: string | null = 'sess-2') {
      mocks.listChatSessions.mockResolvedValue(makeTwoSessions())
      const { default: ChatHistorySidebar } = await import('../components/ChatHistorySidebar')
      await act(async () => {
        root.render(
          <ChatHistorySidebar onSelectSession={vi.fn()} currentSessionId={activeId} />,
        )
      })
      // Wait for async session load
      await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    }

    it('matches snapshot with 2 sessions, 1 active', async () => {
      await render()
      expect(container.firstChild).toMatchSnapshot()
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
