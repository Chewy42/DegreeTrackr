// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Course } from './ProgressPage'

vi.mock('react-icons/fi', () => ({
  FiChevronLeft: () => React.createElement('span', null, '<'),
  FiChevronRight: () => React.createElement('span', null, '>'),
  FiBook: () => React.createElement('span', null, 'book'),
}))

function makeCourse(
  term: string,
  subject: string,
  number: string,
  title: string,
  grade: string | null,
  credits = 3,
): Course {
  return { term, subject, number, title, grade, credits, type: null }
}

describe('CourseHistoryTimeline', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    container.remove()
  })

  async function render(courses: Course[]) {
    const { default: CourseHistoryTimeline } = await import('./CourseHistoryTimeline')
    await act(async () => {
      root.render(<CourseHistoryTimeline courses={courses} />)
    })
  }

  it('renders courses with most recent term shown first', async () => {
    const courses = [
      makeCourse('Fall 2023', 'CS', '101', 'Intro CS', 'A'),
      makeCourse('Spring 2024', 'CS', '201', 'Data Structures', 'B+'),
    ]
    await render(courses)

    // Most recent term (Spring 2024) should be the default view
    expect(container.textContent).toContain('Spring 2024')
    // The term selector should show the current term's courses
    expect(container.textContent).toContain('CS 201')
  })

  it('each course shows name, grade, and credits', async () => {
    const courses = [
      makeCourse('Fall 2023', 'MATH', '201', 'Calculus II', 'A-', 4),
    ]
    await render(courses)

    expect(container.textContent).toContain('MATH 201')
    expect(container.textContent).toContain('Calculus II')
    expect(container.textContent).toContain('4 cr')

    // Grade badge
    const gradeBadge = container.querySelector('[aria-label="Grade: A-"]')
    expect(gradeBadge).not.toBeNull()
    expect(gradeBadge!.textContent).toBe('A-')
  })

  it('empty history renders empty state', async () => {
    await render([])

    expect(container.textContent).toContain('No course history available')
    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
  })

  it('shows term count and course count in header', async () => {
    const courses = [
      makeCourse('Fall 2023', 'CS', '101', 'Intro', 'A'),
      makeCourse('Fall 2023', 'MATH', '101', 'Algebra', 'B'),
      makeCourse('Spring 2024', 'CS', '201', 'DS', 'A-'),
    ]
    await render(courses)

    expect(container.textContent).toContain('2 terms')
    expect(container.textContent).toContain('3 courses')
  })

  it('navigating to next term shows older courses', async () => {
    const courses = [
      makeCourse('Fall 2023', 'CS', '101', 'Intro CS', 'A'),
      makeCourse('Spring 2024', 'CS', '201', 'Data Structures', 'B+'),
    ]
    await render(courses)

    // Initially showing Spring 2024 (most recent)
    expect(container.textContent).toContain('Spring 2024')

    // Click next term button (navigates to older term)
    const nextBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Next term"]')
    expect(nextBtn).not.toBeNull()
    await act(async () => { nextBtn!.click() })

    // Now should show Fall 2023
    expect(container.textContent).toContain('Fall 2023')
    expect(container.textContent).toContain('CS 101')
  })

  it('term dot buttons have aria-pressed and jump to term', async () => {
    const courses = [
      makeCourse('Fall 2023', 'CS', '101', 'Intro', 'A'),
      makeCourse('Spring 2024', 'CS', '201', 'DS', 'B'),
    ]
    await render(courses)

    const dots = container.querySelectorAll('button[aria-pressed]')
    // Filter to term dots only (exclude filter buttons etc.)
    const termDots = Array.from(dots).filter((d) =>
      d.getAttribute('aria-label')?.startsWith('Jump to'),
    )
    expect(termDots).toHaveLength(2)

    // First dot (Spring 2024) should be pressed
    expect(termDots[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(termDots[1]!.getAttribute('aria-pressed')).toBe('false')

    // Click second dot to jump to Fall 2023
    await act(async () => { (termDots[1] as HTMLButtonElement).click() })
    expect(container.textContent).toContain('Fall 2023')
  })

  it('grade legend is rendered', async () => {
    const courses = [makeCourse('Fall 2023', 'CS', '101', 'Intro', 'A')]
    await render(courses)

    expect(container.textContent).toContain('Excellent')
    expect(container.textContent).toContain('Good')
    expect(container.textContent).toContain('Average')
    expect(container.textContent).toContain('In Progress')
  })

  it('course without grade shows dash', async () => {
    const courses = [makeCourse('Fall 2023', 'CS', '101', 'Intro', null)]
    await render(courses)

    const gradeBadge = container.querySelector('[aria-label="Grade: not graded"]')
    expect(gradeBadge).not.toBeNull()
    expect(gradeBadge!.textContent).toBe('—')
  })
})
