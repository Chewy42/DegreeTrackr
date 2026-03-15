// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ScheduledClass } from '../components/schedule/types'

vi.mock('../components/schedule/ClassDetailsModal', () => ({ default: () => null }))

const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

function makeScheduledClass(overrides: Partial<ScheduledClass> = {}): ScheduledClass {
  return {
    id: 'CS-101-01',
    code: 'CS 101',
    subject: 'CS',
    number: '101',
    section: '01',
    title: 'Intro to CS',
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
        Tu: [], W: [], Th: [], F: [], Sa: [], Su: [],
      },
    },
    color: '#DBEAFE',
    ...overrides,
  }
}

describe('WeeklyCalendarHeader — DT191', () => {
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

  async function renderCalendar(classes: ScheduledClass[] = []) {
    const { default: WeeklyCalendar } = await import('../components/schedule/WeeklyCalendar')
    await act(async () => {
      root.render(<WeeklyCalendar classes={classes} onRemoveClass={vi.fn()} />)
    })
  }

  it('renders 5 weekday labels (Mon–Fri) when no weekend classes', async () => {
    await renderCalendar([])
    const headerTexts = Array.from(
      container.querySelectorAll('.sticky.top-0 span'),
    ).map(el => el.textContent)
    expect(headerTexts).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  })

  it('renders 7 day labels when a class occurs on Saturday', async () => {
    const satClass = makeScheduledClass({
      id: 'SAT-100-01',
      occurrenceData: {
        starts: 0,
        ends: 0,
        daysOccurring: {
          M: [], Tu: [], W: [], Th: [], F: [],
          Sa: [{ startTime: 540, endTime: 590 }],
          Su: [],
        },
      },
    })
    await renderCalendar([satClass])
    const headerTexts = Array.from(
      container.querySelectorAll('.sticky.top-0 span'),
    ).map(el => el.textContent)
    expect(headerTexts).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('header row is sticky with bg and shadow for scroll persistence', async () => {
    await renderCalendar([])
    const headerRow = container.querySelector('.sticky.top-0')
    expect(headerRow).not.toBeNull()
    expect(headerRow!.className).toContain('shadow-sm')
    expect(headerRow!.className).toContain('bg-surface')
  })

  it('each day column header has font-semibold text-sm styling', async () => {
    await renderCalendar([makeScheduledClass()])
    const daySpans = Array.from(
      container.querySelectorAll('.sticky.top-0 span'),
    )
    expect(daySpans.length).toBeGreaterThanOrEqual(5)
    for (const span of daySpans) {
      expect(span.className).toContain('font-semibold')
      expect(span.className).toContain('text-sm')
    }
  })
})
