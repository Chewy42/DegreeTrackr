// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClassSection } from '../components/schedule/types'

// Mock auth
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: 'test-jwt' }),
}))

// Mock schedule API
const mockSearchClasses = vi.fn()
const mockGetSubjects = vi.fn()
vi.mock('../lib/scheduleApi', () => ({
  searchClasses: (...args: unknown[]) => mockSearchClasses(...args),
  getSubjects: (...args: unknown[]) => mockGetSubjects(...args),
}))

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
      starts: 1000,
      ends: 2000,
      daysOccurring: {
        M: [{ startTime: 600, endTime: 650 }],
        Tu: [],
        W: [{ startTime: 600, endTime: 650 }],
        Th: [],
        F: [{ startTime: 600, endTime: 650 }],
        Sa: [],
        Su: [],
      },
    },
    ...overrides,
  }
}

describe('ClassSearchSidebar — DT181', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockGetSubjects.mockResolvedValue({ subjects: ['CS', 'MATH'] })
    mockSearchClasses.mockResolvedValue({ classes: [] })
  })

  afterEach(async () => {
    vi.useRealTimers()
    await act(async () => { root.unmount() })
    container.remove()
    vi.restoreAllMocks()
  })

  async function renderSidebar(props: Partial<Parameters<typeof import('../components/schedule/ClassSearchSidebar').default>[0]> = {}) {
    const { default: ClassSearchSidebar } = await import('../components/schedule/ClassSearchSidebar')
    await act(async () => {
      root.render(
        <ClassSearchSidebar
          onAddClass={props.onAddClass ?? vi.fn()}
          onRemoveClass={props.onRemoveClass ?? vi.fn()}
          addedClassIds={props.addedClassIds ?? new Set()}
          conflicts={props.conflicts ?? {}}
        />,
      )
    })
    // Flush debounce timer and async effects
    await act(async () => { vi.advanceTimersByTime(600) })
  }

  it('renders search input with placeholder text', async () => {
    await renderSidebar()
    const input = container.querySelector<HTMLInputElement>('input[type="text"]')
    expect(input).not.toBeNull()
    expect(input!.placeholder).toContain('Search')
  })

  it('typing "CS101" triggers search with matching query', async () => {
    const cs101 = makeSection({ id: 'CS-101-01', code: 'CS 101', title: 'Intro to CS' })
    mockSearchClasses.mockResolvedValue({ classes: [cs101] })

    await renderSidebar()

    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!
    await act(async () => {
      // Simulate typing
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
      nativeInputValueSetter.call(input, 'CS101')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    // Flush debounce
    await act(async () => { vi.advanceTimersByTime(600) })

    expect(mockSearchClasses).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'CS101' }),
      'test-jwt',
    )
  })

  it('clicking a result card fires onAddClass with course data', async () => {
    const cs101 = makeSection()
    mockSearchClasses.mockResolvedValue({ classes: [cs101] })
    const onAddClass = vi.fn()

    await renderSidebar({ onAddClass })

    // Find the add button
    const addBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Add CS 101 to schedule"]')
    expect(addBtn).not.toBeNull()
    await act(async () => { addBtn!.click() })
    expect(onAddClass).toHaveBeenCalledWith(cs101)
  })

  it('empty search results show "No classes found" message', async () => {
    mockSearchClasses.mockResolvedValue({ classes: [] })
    await renderSidebar()
    expect(container.textContent).toContain('No classes found')
  })
})
