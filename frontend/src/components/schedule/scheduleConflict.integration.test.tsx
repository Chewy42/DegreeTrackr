// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduledClass, DaysOccurring } from './types'
import { validateScheduledClassesLocally } from '../../lib/scheduleApi'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./ClassDetailsModal', () => ({ default: () => null }))

const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// ── Factory ──────────────────────────────────────────────────────────────────

function makeClass(
  id: string,
  code: string,
  credits: number,
  days: Partial<Record<keyof DaysOccurring, Array<{ startTime: number; endTime: number }>>>,
  color: string,
): ScheduledClass {
  const daysOccurring: DaysOccurring = { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [], ...days }
  return {
    id,
    code,
    subject: code.split(' ')[0] ?? 'CS',
    number: '101',
    section: '01',
    title: `${code} Title`,
    credits,
    displayDays: Object.keys(days).join(''),
    displayTime: '',
    location: 'Room 100',
    professor: 'Prof Test',
    professorRating: null,
    semester: 'spring2026',
    semestersOffered: [],
    requirementsSatisfied: [],
    occurrenceData: { starts: 0, ends: 0, daysOccurring },
    color,
  }
}

// MWF 9:00–10:00 AM (540–600)
const CLASS_MWF_9 = makeClass('CS-101-01', 'CS 101', 3, {
  M: [{ startTime: 540, endTime: 600 }],
  W: [{ startTime: 540, endTime: 600 }],
  F: [{ startTime: 540, endTime: 600 }],
}, '#FEE2E2')

// TTh 11:00 AM–12:30 PM (660–750)
const CLASS_TTH_11 = makeClass('ENG-201-01', 'ENG 201', 3, {
  Tu: [{ startTime: 660, endTime: 750 }],
  Th: [{ startTime: 660, endTime: 750 }],
}, '#FEF3C7')

// MWF 2:00–3:00 PM (840–900)
const CLASS_MWF_2 = makeClass('MATH-301-01', 'MATH 301', 4, {
  M: [{ startTime: 840, endTime: 900 }],
  W: [{ startTime: 840, endTime: 900 }],
  F: [{ startTime: 840, endTime: 900 }],
}, '#D1FAE5')

// MWF 9:00–10:00 AM — conflicts with CLASS_MWF_9
const CLASS_CONFLICT = makeClass('PHYS-101-01', 'PHYS 101', 3, {
  M: [{ startTime: 540, endTime: 600 }],
  W: [{ startTime: 540, endTime: 600 }],
  F: [{ startTime: 540, endTime: 600 }],
}, '#DBEAFE')

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Schedule conflict regression (integration)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
  })

  async function renderCalendar(
    classes: ScheduledClass[],
    conflicts: Record<string, string> = {},
  ) {
    const { default: WeeklyCalendar } = await import('./WeeklyCalendar')
    await act(async () => {
      root.render(
        <WeeklyCalendar
          classes={classes}
          onRemoveClass={vi.fn()}
          conflicts={conflicts}
        />,
      )
    })
  }

  it('renders 3 non-conflicting classes without conflict indicators', async () => {
    const classes = [CLASS_MWF_9, CLASS_TTH_11, CLASS_MWF_2]
    const validation = validateScheduledClassesLocally(classes)

    expect(validation.valid).toBe(true)
    expect(validation.conflicts).toHaveLength(0)
    expect(validation.totalCredits).toBe(10)

    await renderCalendar(classes)

    expect(container.textContent).toContain('CS 101')
    expect(container.textContent).toContain('ENG 201')
    expect(container.textContent).toContain('MATH 301')
    // No conflict indicators
    expect(container.querySelector('[class*="ring-red"]')).toBeNull()
  })

  it('detects conflict when 4th class overlaps an existing slot', () => {
    const classes = [CLASS_MWF_9, CLASS_TTH_11, CLASS_MWF_2, CLASS_CONFLICT]
    const validation = validateScheduledClassesLocally(classes)

    expect(validation.valid).toBe(false)
    // MWF overlap → 3 conflict entries (one per shared day: M, W, F)
    expect(validation.conflicts.length).toBe(3)

    const conflictMessages = validation.conflicts.map(c => c.message)
    expect(conflictMessages.some(m => m.includes('CS 101') && m.includes('PHYS 101'))).toBe(true)

    // Verify each conflicting day is reported
    const conflictDays = validation.conflicts.map(c => c.day)
    expect(conflictDays).toContain('M')
    expect(conflictDays).toContain('W')
    expect(conflictDays).toContain('F')
  })

  it('renders conflict indicator on the calendar for conflicting classes', async () => {
    const classes = [CLASS_MWF_9, CLASS_TTH_11, CLASS_MWF_2, CLASS_CONFLICT]
    const validation = validateScheduledClassesLocally(classes)

    const conflictMap = validation.conflicts.reduce((acc, c) => {
      acc[c.classId1] = c.message
      acc[c.classId2] = c.message
      return acc
    }, {} as Record<string, string>)

    await renderCalendar(classes, conflictMap)

    expect(container.textContent).toContain('CS 101')
    expect(container.textContent).toContain('PHYS 101')
    // Conflict indicators should be present (title attribute with conflict message)
    const conflictElements = container.querySelectorAll('[title]')
    const titles = Array.from(conflictElements).map(el => el.getAttribute('title'))
    expect(titles.some(t => t?.includes('conflicts'))).toBe(true)
  })

  it('conflict clears after removing conflicting class', () => {
    // With conflict
    const withConflict = [CLASS_MWF_9, CLASS_TTH_11, CLASS_MWF_2, CLASS_CONFLICT]
    const before = validateScheduledClassesLocally(withConflict)
    expect(before.valid).toBe(false)

    // Remove conflicting class
    const withoutConflict = [CLASS_MWF_9, CLASS_TTH_11, CLASS_MWF_2]
    const after = validateScheduledClassesLocally(withoutConflict)
    expect(after.valid).toBe(true)
    expect(after.conflicts).toHaveLength(0)
  })

  it('original 3 classes remain after conflict resolution', async () => {
    const remaining = [CLASS_MWF_9, CLASS_TTH_11, CLASS_MWF_2]
    const validation = validateScheduledClassesLocally(remaining)

    expect(validation.valid).toBe(true)
    expect(validation.totalCredits).toBe(10)

    await renderCalendar(remaining)

    expect(container.textContent).toContain('CS 101')
    expect(container.textContent).toContain('ENG 201')
    expect(container.textContent).toContain('MATH 301')
    expect(container.querySelector('[class*="ring-red"]')).toBeNull()
  })
})
