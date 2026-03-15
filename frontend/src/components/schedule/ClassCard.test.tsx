// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClassSection } from './types'

// ── Test factory ─────────────────────────────────────────────────────────────

function makeSection(overrides: Partial<ClassSection> = {}): ClassSection {
  return {
    id: 'CS-101-01',
    code: 'CS 101',
    subject: 'CS',
    number: '101',
    section: '01',
    title: 'Intro to CS',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '10:00am - 10:50am',
    location: 'Science Hall 201',
    professor: 'Dr. Smith',
    professorRating: 4.2,
    semester: 'spring2026',
    semestersOffered: ['Spring', 'Fall'],
    requirementsSatisfied: [],
    occurrenceData: {
      starts: 0,
      ends: 0,
      daysOccurring: { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [] },
    },
    ...overrides,
  }
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('ClassCard', () => {
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

  async function render(props: {
    classData: ClassSection
    onAdd?: (cls: ClassSection) => void
    onRemove?: (id: string) => void
    isAdded?: boolean
    conflictMessage?: string
    compact?: boolean
    disabled?: boolean
  }) {
    const { default: ClassCard } = await import('./ClassCard')
    await act(async () => {
      root.render(<ClassCard {...props} />)
    })
  }

  it('renders course code, title, credits, meeting time, and professor', async () => {
    const cls = makeSection()
    await render({ classData: cls })

    expect(container.textContent).toContain('CS 101')
    expect(container.textContent).toContain('Intro to CS')
    expect(container.textContent).toContain('3 cr')
    expect(container.textContent).toContain('MWF')
    expect(container.textContent).toContain('10:00am - 10:50am')
    expect(container.textContent).toContain('Dr. Smith')
  })

  it('renders location when not in compact mode', async () => {
    const cls = makeSection()
    await render({ classData: cls })
    expect(container.textContent).toContain('Science Hall 201')
  })

  it('hides location in compact mode', async () => {
    const cls = makeSection()
    await render({ classData: cls, compact: true })
    expect(container.textContent).not.toContain('Science Hall 201')
  })

  it('clicking card fires onAdd when not added', async () => {
    const onAdd = vi.fn()
    const cls = makeSection()
    await render({ classData: cls, onAdd })

    await act(async () => {
      container.querySelector<HTMLDivElement>('div')!.click()
    })

    expect(onAdd).toHaveBeenCalledWith(cls)
  })

  it('clicking add button fires onAdd via stopPropagation path', async () => {
    const onAdd = vi.fn()
    const cls = makeSection()
    await render({ classData: cls, onAdd })

    const addBtn = container.querySelector<HTMLButtonElement>(
      `button[aria-label="Add CS 101 to schedule"]`,
    )
    expect(addBtn).not.toBeNull()

    await act(async () => { addBtn!.click() })
    expect(onAdd).toHaveBeenCalledWith(cls)
  })

  it('shows remove button when isAdded and calls onRemove with id', async () => {
    const onRemove = vi.fn()
    const cls = makeSection()
    await render({ classData: cls, isAdded: true, onRemove })

    const removeBtn = container.querySelector<HTMLButtonElement>(
      `button[aria-label="Remove CS 101 from schedule"]`,
    )
    expect(removeBtn).not.toBeNull()

    await act(async () => { removeBtn!.click() })
    expect(onRemove).toHaveBeenCalledWith('CS-101-01')
  })

  it('shows conflict warning when conflictMessage is set', async () => {
    const cls = makeSection()
    await render({ classData: cls, conflictMessage: 'Overlaps with MATH 201' })

    expect(container.textContent).toContain('Overlaps with MATH 201')
    // Add button should be disabled
    const addBtn = container.querySelector<HTMLButtonElement>('button')
    expect(addBtn!.getAttribute('aria-disabled')).toBe('true')
  })

  it('does not fire onAdd when card is clicked with a conflict', async () => {
    const onAdd = vi.fn()
    const cls = makeSection()
    await render({ classData: cls, onAdd, conflictMessage: 'Conflict' })

    await act(async () => {
      container.querySelector<HTMLDivElement>('div')!.click()
    })

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('renders requirement badges when present', async () => {
    const cls = makeSection({
      requirementsSatisfied: [
        { type: 'major_core', label: 'Major Core', shortLabel: 'Core', color: 'blue' },
        { type: 'ge', label: 'General Education', shortLabel: 'GE', color: 'green' },
      ],
    })
    await render({ classData: cls })

    expect(container.textContent).toContain('Core')
    expect(container.textContent).toContain('GE')
  })
})
