// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClassSection } from '../components/schedule/types'

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

describe('CourseCard (ClassCard) — DT177', () => {
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
    disabled?: boolean
  }) {
    const { default: ClassCard } = await import('../components/schedule/ClassCard')
    await act(async () => {
      root.render(<ClassCard {...props} />)
    })
  }

  it('renders course name from props', async () => {
    await render({ classData: makeSection({ title: 'Data Structures' }) })
    expect(container.textContent).toContain('Data Structures')
  })

  it('renders course number/code (e.g. "CS 101")', async () => {
    await render({ classData: makeSection({ code: 'MATH 201' }) })
    expect(container.textContent).toContain('MATH 201')
  })

  it('renders credit hours (e.g. "3 cr")', async () => {
    await render({ classData: makeSection({ credits: 4 }) })
    expect(container.textContent).toContain('4 cr')
  })

  it('"Add to Schedule" button calls onAdd callback', async () => {
    const onAdd = vi.fn()
    const cls = makeSection()
    await render({ classData: cls, onAdd })

    const addBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add CS 101 to schedule"]',
    )
    expect(addBtn).not.toBeNull()

    await act(async () => { addBtn!.click() })
    expect(onAdd).toHaveBeenCalledWith(cls)
  })

  it('when course already in schedule the add button is replaced by remove', async () => {
    const onRemove = vi.fn()
    await render({ classData: makeSection(), isAdded: true, onRemove })

    // Add button should not exist
    const addBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add CS 101 to schedule"]',
    )
    expect(addBtn).toBeNull()

    // Remove button should exist
    const removeBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove CS 101 from schedule"]',
    )
    expect(removeBtn).not.toBeNull()
  })
})
