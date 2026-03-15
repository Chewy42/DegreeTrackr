// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ClassSection } from '../components/schedule/types'

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  validateScheduledClassesLocally: vi.fn().mockReturnValue({
    valid: true,
    conflicts: [],
    totalCredits: 6,
    warnings: [],
  }),
  generateAutoSchedule: vi.fn(),
  getClassById: vi.fn(),
  createScheduleSnapshot: vi.fn(),
  listScheduleSnapshots: vi.fn().mockResolvedValue([]),
  deleteScheduleSnapshot: vi.fn(),
  deriveRequirementsSummaryFromProgramEvaluation: vi.fn().mockReturnValue(null),
  getConvexClient: vi.fn().mockReturnValue(null),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
}))

// ── ScheduleBuilder mocks ───────────────────────────────────────────────────

vi.mock('../lib/scheduleApi', () => ({
  validateScheduledClassesLocally: mocks.validateScheduledClassesLocally,
  generateAutoSchedule: mocks.generateAutoSchedule,
  getClassById: mocks.getClassById,
  createScheduleSnapshot: mocks.createScheduleSnapshot,
  listScheduleSnapshots: mocks.listScheduleSnapshots,
  deleteScheduleSnapshot: mocks.deleteScheduleSnapshot,
  deriveRequirementsSummaryFromProgramEvaluation: mocks.deriveRequirementsSummaryFromProgramEvaluation,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: 'test-jwt', preferences: { hasProgramEvaluation: true } }),
}))

vi.mock('../lib/convex', () => ({
  convexApi: {
    evaluations: { getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation' },
    draftSchedule: {
      getDraftSchedule: 'draftSchedule:getDraftSchedule',
      saveDraftSchedule: 'draftSchedule:saveDraftSchedule',
    },
  },
  getConvexClient: (...args: any[]) => mocks.getConvexClient(...args),
  getSessionMessagesConvex: (...args: any[]) => mocks.getSessionMessages(...args),
  sendCurrentExploreMessageConvex: (...args: any[]) => mocks.sendMessage(...args),
}))

vi.mock('../hooks/usePageTitle', () => ({
  usePageTitle: () => {},
}))

vi.mock('../lib/scheduleExport', () => ({
  exportAsJSON: vi.fn().mockReturnValue([]),
  exportAsCSV: vi.fn().mockReturnValue(''),
}))

// ── Captured child props for ScheduleBuilder ────────────────────────────────

let sidebarProps: {
  onAddClass: (cls: ClassSection) => void
  onRemoveClass: (id: string) => void
  addedClassIds: Set<string>
  conflicts: Record<string, string>
} | null = null

let calendarProps: {
  classes: ClassSection[]
  onRemoveClass: (id: string) => void
  conflicts: Record<string, string>
} | null = null

vi.mock('../components/schedule/ClassSearchSidebar', () => ({
  default: (props: any) => {
    sidebarProps = props
    return React.createElement('div', { 'data-testid': 'sidebar' })
  },
}))

vi.mock('../components/schedule/WeeklyCalendar', () => ({
  default: (props: any) => {
    calendarProps = props
    return React.createElement('div', { 'data-testid': 'calendar' },
      props.classes.map((c: any) => React.createElement('span', { key: c.id, 'data-testid': `class-${c.id}` }, c.code)))
  },
}))

vi.mock('../components/schedule/WarningModal', () => ({ default: () => null }))
vi.mock('../components/schedule/ScheduleImpactModal', () => ({ default: () => null }))
vi.mock('../components/schedule/SnapshotManagerModal', () => ({ default: () => null }))

// Stub react-icons
vi.mock('react-icons/fi', () => new Proxy({}, {
  get: (_target, name) => (props: any) => React.createElement('span', { ...props, 'data-icon': name }),
}))

// Stub markdown renderer for ExploreChat
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('span', { 'data-testid': 'markdown' }, children),
}))
vi.mock('remark-gfm', () => ({ default: () => {} }))

// ── Test fixtures ───────────────────────────────────────────────────────────

function makeSection(id: string, code: string): ClassSection {
  const daysOccurring = {
    M: [{ startTime: 540, endTime: 590 }],
    Tu: [],
    W: [{ startTime: 540, endTime: 590 }],
    Th: [],
    F: [],
    Sa: [],
    Su: [],
  }
  return {
    id,
    code,
    subject: code.split(' ')[0],
    number: code.split(' ')[1] || '101',
    section: '01',
    title: `${code} Title`,
    credits: 3,
    displayDays: 'MW',
    displayTime: '9:00-9:50',
    location: 'Room 101',
    professor: 'Prof Test',
    professorRating: null,
    semester: 'spring2026',
    semestersOffered: [],
    requirementsSatisfied: ['Core'],
    occurrenceData: { starts: 0, ends: 0, daysOccurring },
  } as ClassSection
}

const CLASS_1 = makeSection('cls-1', 'CS 101')
const CLASS_2 = makeSection('cls-2', 'MATH 210')

// ─────────────────────────────────────────────────────────────────────────────
// DT114 — Data persistence simulation
// ─────────────────────────────────────────────────────────────────────────────

describe('DT114 — Data persistence across remount', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.resetModules()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    sidebarProps = null
    calendarProps = null
    mocks.getConvexClient.mockReturnValue(null)
    mocks.listScheduleSnapshots.mockResolvedValue([])
    mocks.validateScheduledClassesLocally.mockReturnValue({
      valid: true, conflicts: [], totalCredits: 6, warnings: [],
    })
    Element.prototype.scrollTo = vi.fn()
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  describe('ScheduleBuilder — courses persist across remount', () => {
    async function renderScheduleBuilder() {
      const { default: ScheduleBuilder } = await import('../components/schedule/ScheduleBuilder')
      await act(async () => { root.render(<ScheduleBuilder />) })
    }

    it('courses survive unmount and re-render via Convex draft reload', async () => {
      // ── First render (null client — no Convex persistence) ──
      await renderScheduleBuilder()

      // Add 2 courses via the sidebar callback
      await act(async () => { sidebarProps!.onAddClass(CLASS_1) })
      await act(async () => { sidebarProps!.onAddClass(CLASS_2) })

      // Verify both courses are shown in the calendar
      expect(calendarProps!.classes).toHaveLength(2)
      expect(calendarProps!.classes.map(c => c.id)).toEqual(
        expect.arrayContaining(['cls-1', 'cls-2']),
      )

      // Unmount
      await act(async () => { root.unmount() })
      sidebarProps = null
      calendarProps = null

      // ── Second render — mock Convex returns the persisted draft ──
      // Simulate Convex having persisted the classes server-side.
      // On re-mount ScheduleBuilder calls getDraftSchedule which returns
      // the saved classIds, then fetches each via getClassById.
      vi.resetModules()

      mocks.getConvexClient.mockReturnValue({
        query: vi.fn().mockImplementation((ref: string) => {
          if (ref === 'draftSchedule:getDraftSchedule') {
            return Promise.resolve({ classIds: ['cls-1', 'cls-2'], updatedAt: Date.now() })
          }
          return Promise.resolve(null)
        }),
        mutation: vi.fn().mockResolvedValue(undefined),
      })
      mocks.getClassById.mockImplementation((id: string) =>
        Promise.resolve(id === 'cls-1' ? CLASS_1 : CLASS_2),
      )

      root = createRoot(container)
      const { default: ScheduleBuilder2 } = await import('../components/schedule/ScheduleBuilder')
      act(() => { root.render(<ScheduleBuilder2 />) })

      // Flush the fire-and-forget async IIFE in the useEffect
      await new Promise(r => setTimeout(r, 100))
      await act(async () => {})

      // Verify both courses reloaded from the persisted store
      expect(calendarProps!.classes).toHaveLength(2)
      const reloadedIds = calendarProps!.classes.map(c => c.id)
      expect(reloadedIds).toContain('cls-1')
      expect(reloadedIds).toContain('cls-2')
    })
  })

  describe('ExploreChat — messages persist across remount', () => {
    const SEND_RESULT = {
      session: { id: 'session-42' },
      messages: [
        { role: 'user' as const, content: 'What can I do with my major?', createdAt: Date.now() },
        { role: 'assistant' as const, content: 'Great question! Here are some options.', createdAt: Date.now() },
      ],
      suggestions: ['Tell me more'],
    }

    async function renderChat(sessionId: string | null, onSessionChange = vi.fn()) {
      const { default: ExploreChat } = await import('../components/ExploreChat')
      await act(async () => {
        root.render(<ExploreChat sessionId={sessionId} onSessionChange={onSessionChange} />)
      })
    }

    it('chat history survives unmount and re-render', async () => {
      const onSessionChange = vi.fn()
      mocks.sendMessage.mockResolvedValue(SEND_RESULT)
      mocks.getSessionMessages.mockResolvedValue([])

      // ── First render — new session, send a message ──
      await renderChat(null, onSessionChange)

      // Type and submit
      const input = container.querySelector('input[aria-label="Message to AI advisor"]') as HTMLInputElement
      const form = container.querySelector('form') as HTMLFormElement
      expect(input).toBeTruthy()

      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
          .call(input, 'What can I do with my major?')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })

      await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      })

      // Let the send promise resolve
      await new Promise(r => setTimeout(r, 50))
      await act(async () => {})

      // Verify send was called and messages appear
      expect(mocks.sendMessage).toHaveBeenCalled()
      let markdownSpans = container.querySelectorAll('[data-testid="markdown"]')
      let texts = Array.from(markdownSpans).map(el => el.textContent)
      expect(texts).toContain('What can I do with my major?')
      expect(texts).toContain('Great question! Here are some options.')

      // ── Unmount ──
      await act(async () => { root.unmount() })

      // ── Re-render with session id — Convex returns persisted history ──
      vi.resetModules()
      mocks.getSessionMessages.mockResolvedValue([
        { role: 'user', content: 'What can I do with my major?', createdAt: Date.now() },
        { role: 'assistant', content: 'Great question! Here are some options.', createdAt: Date.now() },
      ])

      root = createRoot(container)
      const { default: ExploreChat2 } = await import('../components/ExploreChat')
      act(() => {
        root.render(<ExploreChat2 sessionId="session-42" onSessionChange={vi.fn()} />)
      })

      // Flush the history load promise
      await new Promise(r => setTimeout(r, 100))
      await act(async () => {})

      // Verify the previous messages are shown
      markdownSpans = container.querySelectorAll('[data-testid="markdown"]')
      texts = Array.from(markdownSpans).map(el => el.textContent)
      expect(texts).toContain('What can I do with my major?')
      expect(texts).toContain('Great question! Here are some options.')
    })
  })
})
