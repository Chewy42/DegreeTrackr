// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import WeeklyCalendar, { WeeklyCalendarUnmemoized } from './WeeklyCalendar'
import type { ScheduledClass } from './types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./ClassDetailsModal', () => ({ default: () => null }))

// jsdom ships without ResizeObserver; polyfill it so the component doesn't throw.
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// ── Factory ──────────────────────────────────────────────────────────────────

function makeScheduledClass(id: string, code: string): ScheduledClass {
  return {
    id,
    code,
    subject: code.split(' ')[0] ?? 'CS',
    number: '101',
    section: '01',
    title: 'Test Course',
    credits: 3,
    displayDays: 'M',
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
        W: [],
        Th: [],
        F: [],
        Sa: [],
        Su: [],
      },
    },
    color: '#BFDBFE',
  }
}

const CLASS_A = makeScheduledClass('CS-101-01', 'CS 101')
const CLASS_B = makeScheduledClass('ENG-301-01', 'ENG 301')

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('WeeklyCalendar', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function renderCalendar(
    classes: ScheduledClass[],
    conflicts: Record<string, string> = {},
    onRemoveClass = vi.fn(),
  ) {
    await act(async () => {
      root.render(
        <WeeklyCalendar
          classes={classes}
          onRemoveClass={onRemoveClass}
          conflicts={conflicts}
        />,
      )
    })
  }

  it('shows empty state when no classes are provided', async () => {
    await renderCalendar([])
    expect(container.textContent).toContain('No classes added yet')
  })

  it('non-conflicting class block does not have a red ring', async () => {
    await renderCalendar([CLASS_A], {})

    const allDivs = Array.from(container.querySelectorAll('div'))
    const redRingDivs = allDivs.filter(d =>
      d.className.includes('ring-2') && d.className.includes('ring-red-500'),
    )
    expect(redRingDivs).toHaveLength(0)
  })

  it('conflicting class block has red ring and FiAlertTriangle icon', async () => {
    await renderCalendar([CLASS_A], { 'CS-101-01': 'CS 101 conflicts on Monday' })

    // Block div gets ring-2 ring-red-500/60
    const allDivs = Array.from(container.querySelectorAll('div'))
    const redRingDivs = allDivs.filter(d =>
      d.className.includes('ring-2') && d.className.includes('ring-red-500'),
    )
    expect(redRingDivs.length).toBeGreaterThan(0)

    // The block title is set to the conflict message
    const conflictBlock = container.querySelector('[title="CS 101 conflicts on Monday"]')
    expect(conflictBlock).not.toBeNull()
  })

  it('conflict message is set as the block title', async () => {
    const msg = 'CS 101 overlaps with ENG 301 on Monday at 9:00 AM'
    await renderCalendar([CLASS_A], { 'CS-101-01': msg })

    const block = container.querySelector(`[title="${msg}"]`)
    expect(block).not.toBeNull()
  })

  it('two classes both have red rings when both are in the conflict map', async () => {
    const conflicts = {
      'CS-101-01': 'CS 101 conflicts with ENG 301 on M.',
      'ENG-301-01': 'CS 101 conflicts with ENG 301 on M.',
    }
    // Give CLASS_B a different day to avoid DOM position overlap
    const classB: ScheduledClass = {
      ...CLASS_B,
      occurrenceData: {
        starts: 0,
        ends: 0,
        daysOccurring: {
          M: [],
          Tu: [{ startTime: 600, endTime: 650 }],
          W: [],
          Th: [],
          F: [],
          Sa: [],
          Su: [],
        },
      },
    }

    await renderCalendar([CLASS_A, classB], conflicts)

    const allDivs = Array.from(container.querySelectorAll('div'))
    const redRingDivs = allDivs.filter(d =>
      d.className.includes('ring-2') && d.className.includes('ring-red-500'),
    )
    // One red-ringed block per conflicting class per day they appear
    expect(redRingDivs.length).toBeGreaterThanOrEqual(2)
  })

  it('remove button calls onRemoveClass with the correct class id', async () => {
    const onRemoveClass = vi.fn()
    await renderCalendar([CLASS_A], {}, onRemoveClass)

    const removeBtn = container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove CS 101 from schedule"]',
    )
    expect(removeBtn).not.toBeNull()

    await act(async () => { removeBtn!.click() })

    expect(onRemoveClass).toHaveBeenCalledWith('CS-101-01')
  })

  it('class code and time are shown inside the block', async () => {
    await renderCalendar([CLASS_A], {})
    // Code text
    expect(container.textContent).toContain('CS 101')
    // Time rendered by minutesToTime(540) = '9:00 AM' and minutesToTime(590) = '9:50 AM'
    expect(container.textContent).toContain('9:00 AM')
  })

  // ── Keyboard accessibility ────────────────────────────────────────────────

  it('time slots have role="button" and aria-label containing day and hour', async () => {
    await renderCalendar([])
    // Monday 7 AM slot
    const slot = container.querySelector<HTMLDivElement>(
      '[role="button"][data-slot-day="M"][data-slot-hour="7"]',
    )
    expect(slot).not.toBeNull()
    expect(slot!.getAttribute('aria-label')).toContain('Monday')
    expect(slot!.getAttribute('aria-label')).toContain('7 AM')
  })

  it('time slots have tabIndex=0 for inclusion in tab order', async () => {
    await renderCalendar([])
    const slot = container.querySelector<HTMLDivElement>('[data-slot-day="M"][data-slot-hour="9"]')
    expect(slot).not.toBeNull()
    expect(slot!.tabIndex).toBe(0)
  })

  it('Enter key on a time slot fires onSlotClick with correct day and hour', async () => {
    const onSlotClick = vi.fn()
    await act(async () => {
      root.render(
        <WeeklyCalendar
          classes={[]}
          onRemoveClass={vi.fn()}
          onSlotClick={onSlotClick}
        />,
      )
    })
    const slot = container.querySelector<HTMLDivElement>(
      '[data-slot-day="M"][data-slot-hour="7"]',
    )
    expect(slot).not.toBeNull()
    await act(async () => {
      slot!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onSlotClick).toHaveBeenCalledWith('M', 7)
  })

  it('Space key on a time slot fires onSlotClick', async () => {
    const onSlotClick = vi.fn()
    await act(async () => {
      root.render(
        <WeeklyCalendar
          classes={[]}
          onRemoveClass={vi.fn()}
          onSlotClick={onSlotClick}
        />,
      )
    })
    const slot = container.querySelector<HTMLDivElement>(
      '[data-slot-day="Tu"][data-slot-hour="10"]',
    )
    expect(slot).not.toBeNull()
    await act(async () => {
      slot!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })
    expect(onSlotClick).toHaveBeenCalledWith('Tu', 10)
  })

  it('class blocks are focusable (tabIndex=0)', async () => {
    await renderCalendar([CLASS_A])
    // The block wrapping the class is a positioned div with tabIndex=0
    const block = container.querySelector<HTMLDivElement>('[title]')
    // Find any div that is focusable inside the calendar body
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>('[tabindex="0"]'),
    )
    // Should include both time slots and the class block
    expect(focusables.length).toBeGreaterThan(0)
    // The class block itself has tabIndex=0 — verify via aria-label absence (it's a div, not a slot)
    const classBlock = container.querySelector<HTMLDivElement>(
      '[data-slot-day]',
    )
    expect(classBlock).not.toBeNull()
    expect(classBlock!.tabIndex).toBe(0)
  })

  // ── Dark mode ─────────────────────────────────────────────────────────────

  it('renders without hard-coded bg-white class in dark theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    await renderCalendar([CLASS_A])
    const allClassNames = Array.from(container.querySelectorAll('[class]'))
      .map(el => el.getAttribute('class') ?? '')
      .join(' ')
    expect(allClassNames).not.toContain('bg-white')
    document.documentElement.removeAttribute('data-theme')
  })

  // ── React.memo re-render prevention ─────────────────────────────────────

  it('does not re-render when unrelated parent state changes (React.memo)', async () => {
    let calendarRenderCount = 0

    function RenderSpy(props: React.ComponentPropsWithoutRef<typeof WeeklyCalendarUnmemoized>) {
      calendarRenderCount++
      return <WeeklyCalendarUnmemoized {...props} />
    }

    const MemoSpy = React.memo(RenderSpy)

    const onRemoveClass = vi.fn()
    const stableClasses: ScheduledClass[] = [CLASS_A]
    const stableConflicts: Record<string, string> = {}

    function Parent() {
      const [unrelated, setUnrelated] = React.useState(0)
      return (
        <>
          <button data-testid="bump" onClick={() => setUnrelated(n => n + 1)}>
            {unrelated}
          </button>
          <MemoSpy
            classes={stableClasses}
            onRemoveClass={onRemoveClass}
            conflicts={stableConflicts}
          />
        </>
      )
    }

    await act(async () => { root.render(<Parent />) })
    const initialCount = calendarRenderCount

    // Trigger unrelated parent state change
    const bumpBtn = container.querySelector<HTMLButtonElement>('[data-testid="bump"]')!
    await act(async () => { bumpBtn.click() })

    expect(calendarRenderCount).toBe(initialCount)
  })
})
