// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClassSection } from './types'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  searchClasses: vi.fn(),
  getSubjects: vi.fn(),
}))

vi.mock('../../lib/scheduleApi', () => ({
  searchClasses: mocks.searchClasses,
  getSubjects: mocks.getSubjects,
}))

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: 'test-jwt' }),
}))

// Mock ClassCard to capture rendered props
let renderedCards: Array<{
  classData: ClassSection
  onAdd?: (cls: ClassSection) => void
  onRemove?: (id: string) => void
  isAdded?: boolean
  conflictMessage?: string
}> = []

vi.mock('./ClassCard', () => ({
  default: (props: (typeof renderedCards)[number]) => {
    renderedCards.push(props)
    return React.createElement('div', {
      'data-testid': `class-card-${props.classData.id}`,
      onClick: () => props.onAdd?.(props.classData),
    }, props.classData.code)
  },
}))

// ── Test factory ─────────────────────────────────────────────────────────────

function makeSection(id: string, code: string, credits = 3): ClassSection {
  return {
    id,
    code,
    subject: code.split(' ')[0] ?? 'CS',
    number: '101',
    section: '01',
    title: `${code} Course`,
    credits,
    displayDays: 'MWF',
    displayTime: '10:00am - 10:50am',
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
        M: [{ startTime: 600, endTime: 650 }],
        Tu: [], W: [], Th: [], F: [], Sa: [], Su: [],
      },
    },
  }
}

const CLASS_A = makeSection('CS-101-01', 'CS 101', 3)
const CLASS_B = makeSection('MATH-201-01', 'MATH 201', 4)

// ── Test suite ───────────────────────────────────────────────────────────────

describe('ClassSearchSidebar', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    renderedCards = []
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    vi.useFakeTimers()
    mocks.getSubjects.mockResolvedValue({ subjects: ['CS', 'MATH', 'ENG'] })
    mocks.searchClasses.mockResolvedValue({ classes: [CLASS_A, CLASS_B], total: 2, limit: 50, offset: 0 })
  })

  afterEach(async () => {
    vi.useRealTimers()
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render(props?: Partial<{
    onAddClass: (cls: ClassSection) => void
    onRemoveClass: (id: string) => void
    addedClassIds: Set<string>
    conflicts: Record<string, string>
  }>) {
    const { default: ClassSearchSidebar } = await import('./ClassSearchSidebar')
    const defaultProps = {
      onAddClass: vi.fn(),
      onRemoveClass: vi.fn(),
      addedClassIds: new Set<string>(),
      conflicts: {} as Record<string, string>,
    }
    await act(async () => {
      root.render(<ClassSearchSidebar {...defaultProps} {...props} />)
    })
    // Flush the 500ms debounce timer
    await act(async () => { vi.advanceTimersByTime(500) })
    // Flush resolved promises
    await act(async () => {})
  }

  it('renders search input and heading', async () => {
    await render()
    expect(container.textContent).toContain('Find Classes')
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search classes by code, title, or professor"]')
    expect(input).not.toBeNull()
  })

  it('initial load triggers search and renders class cards', async () => {
    await render()
    expect(mocks.searchClasses).toHaveBeenCalled()
    expect(container.querySelector('[data-testid="class-card-CS-101-01"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="class-card-MATH-201-01"]')).not.toBeNull()
    expect(container.textContent).toContain('Showing 2 classes')
  })

  it('shows "No classes found" when search returns empty results', async () => {
    mocks.searchClasses.mockResolvedValue({ classes: [], total: 0, limit: 50, offset: 0 })
    await render()

    expect(container.textContent).toContain('No classes found')
  })

  it('shows error message when search fails', async () => {
    mocks.searchClasses.mockRejectedValue(new Error('Network error'))
    await render()

    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert!.textContent).toContain('Failed to load classes')
  })

  it('typing in search triggers debounced API call', async () => {
    await render()
    mocks.searchClasses.mockClear()
    renderedCards = []

    const input = container.querySelector<HTMLInputElement>('input')!
    await act(async () => {
      // Simulate typing
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value',
      )!.set!
      nativeInputValueSetter.call(input, 'calculus')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // Before debounce fires, no new call
    expect(mocks.searchClasses).not.toHaveBeenCalled()

    // Advance past debounce
    await act(async () => { vi.advanceTimersByTime(500) })
    await act(async () => {})

    expect(mocks.searchClasses).toHaveBeenCalled()
  })

  it('selecting a class card fires onAddClass callback', async () => {
    const onAddClass = vi.fn()
    await render({ onAddClass })

    const card = container.querySelector<HTMLDivElement>('[data-testid="class-card-CS-101-01"]')
    expect(card).not.toBeNull()

    await act(async () => { card!.click() })
    expect(onAddClass).toHaveBeenCalledWith(CLASS_A)
  })

  it('filters out TBA sections without meeting times', async () => {
    const tbaSection: ClassSection = {
      ...CLASS_A,
      id: 'TBA-001',
      code: 'TBA 001',
      occurrenceData: {
        starts: 0,
        ends: 0,
        daysOccurring: { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [] },
      },
    }
    mocks.searchClasses.mockResolvedValue({
      classes: [CLASS_A, tbaSection],
      total: 2,
      limit: 50,
      offset: 0,
    })
    await render()

    expect(container.querySelector('[data-testid="class-card-CS-101-01"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="class-card-TBA-001"]')).toBeNull()
    expect(container.textContent).toContain('Showing 1 classes')
  })

  it('passes isAdded and conflictMessage to ClassCard', async () => {
    await render({
      addedClassIds: new Set(['CS-101-01']),
      conflicts: { 'MATH-201-01': 'Overlaps with CS 101' },
    })

    const csCard = renderedCards.find(c => c.classData.id === 'CS-101-01')
    const mathCard = renderedCards.find(c => c.classData.id === 'MATH-201-01')
    expect(csCard?.isAdded).toBe(true)
    expect(mathCard?.conflictMessage).toBe('Overlaps with CS 101')
  })

  it('loads subject filter options from API', async () => {
    await render()

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Filter classes by subject"]')
    expect(select).not.toBeNull()
    const options = Array.from(select!.options).map(o => o.value)
    expect(options).toContain('CS')
    expect(options).toContain('MATH')
    expect(options).toContain('ENG')
  })
})
