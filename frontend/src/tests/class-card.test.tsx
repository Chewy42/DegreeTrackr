// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClassSection, ScheduledClass } from '../components/schedule/types'

function makeSection(overrides: Partial<ClassSection> = {}): ClassSection {
  return {
    id: 'CS-101-01',
    code: 'CS 101',
    subject: 'CS',
    number: '101',
    section: '01',
    title: 'Intro to Computer Science',
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

function makeScheduled(overrides: Partial<ScheduledClass> = {}): ScheduledClass {
  return { ...makeSection(), color: '#DBEAFE', ...overrides }
}

describe('ClassCard + ClassDetailsModal — DT180', () => {
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

  it('renders course name and credits', async () => {
    const { default: ClassCard } = await import('../components/schedule/ClassCard')
    await act(async () => {
      root.render(<ClassCard classData={makeSection({ title: 'Algorithms', credits: 4 })} />)
    })
    expect(container.textContent).toContain('Algorithms')
    expect(container.textContent).toContain('4 cr')
  })

  it('renders professor and schedule details', async () => {
    const { default: ClassCard } = await import('../components/schedule/ClassCard')
    const cls = makeSection({ professor: 'Dr. Jones', displayDays: 'TuTh', displayTime: '2:00pm - 3:15pm' })
    await act(async () => {
      root.render(<ClassCard classData={cls} />)
    })
    expect(container.textContent).toContain('Dr. Jones')
    expect(container.textContent).toContain('TuTh')
    expect(container.textContent).toContain('2:00pm - 3:15pm')
  })

  it('clicking card calls onAdd when not already added', async () => {
    const { default: ClassCard } = await import('../components/schedule/ClassCard')
    const onAdd = vi.fn()
    const cls = makeSection()
    await act(async () => {
      root.render(<ClassCard classData={cls} onAdd={onAdd} />)
    })

    // Click the card itself (not the button)
    const card = container.firstElementChild as HTMLElement
    await act(async () => { card.click() })
    expect(onAdd).toHaveBeenCalledWith(cls)
  })

  it('ClassDetailsModal shows course details and close button', async () => {
    const { default: ClassDetailsModal } = await import('../components/schedule/ClassDetailsModal')
    const cls = makeScheduled({ code: 'PHYS 201', title: 'Physics II', credits: 4, professor: 'Dr. Newton' })
    await act(async () => {
      root.render(<ClassDetailsModal isOpen={true} onClose={vi.fn()} classData={cls} />)
    })

    expect(container.textContent).toContain('PHYS 201')
    expect(container.textContent).toContain('Physics II')
    expect(container.textContent).toContain('4')
    expect(container.textContent).toContain('Dr. Newton')
    // Close button exists
    const closeBtn = container.querySelector('button[aria-label="Close"]')
    expect(closeBtn).not.toBeNull()
  })
})
