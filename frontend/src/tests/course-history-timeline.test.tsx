// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Course } from '../components/progress/ProgressPage'

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    term: 'Fall 2025',
    subject: 'CS',
    number: '101',
    title: 'Intro to CS',
    grade: 'A',
    credits: 3,
    ...overrides,
  }
}

describe('CourseHistoryTimeline — DT190', () => {
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

  it('renders courses with newest term first', async () => {
    const { default: CourseHistoryTimeline } = await import('../components/progress/CourseHistoryTimeline')
    const courses: Course[] = [
      makeCourse({ term: 'Spring 2024', subject: 'MATH', number: '201', title: 'Calculus' }),
      makeCourse({ term: 'Fall 2025', subject: 'CS', number: '301', title: 'Algorithms' }),
      makeCourse({ term: 'Fall 2024', subject: 'ENG', number: '101', title: 'Composition' }),
    ]
    await act(async () => {
      root.render(<CourseHistoryTimeline courses={courses} />)
    })
    // The default selected term (index 0) should be the newest: Fall 2025
    const termDisplay = container.textContent!
    expect(termDisplay).toContain('Fall 2025')
    expect(termDisplay).toContain('Algorithms')
  })

  it('completed course shows grade', async () => {
    const { default: CourseHistoryTimeline } = await import('../components/progress/CourseHistoryTimeline')
    const courses: Course[] = [
      makeCourse({ grade: 'B+', subject: 'PHYS', number: '201', title: 'Physics II' }),
    ]
    await act(async () => {
      root.render(<CourseHistoryTimeline courses={courses} />)
    })
    const gradeLabel = container.querySelector('[aria-label="Grade: B+"]')
    expect(gradeLabel).not.toBeNull()
    expect(gradeLabel!.textContent).toBe('B+')
  })

  it('in-progress course shows IP grade with In Progress legend', async () => {
    const { default: CourseHistoryTimeline } = await import('../components/progress/CourseHistoryTimeline')
    const courses: Course[] = [
      makeCourse({ grade: 'IP', subject: 'CS', number: '400', title: 'Senior Project' }),
    ]
    await act(async () => {
      root.render(<CourseHistoryTimeline courses={courses} />)
    })
    const gradeLabel = container.querySelector('[aria-label="Grade: IP"]')
    expect(gradeLabel).not.toBeNull()
    expect(gradeLabel!.textContent).toBe('IP')
    // Legend shows "In Progress" label
    expect(container.textContent).toContain('In Progress')
  })

  it('empty history shows placeholder message', async () => {
    const { default: CourseHistoryTimeline } = await import('../components/progress/CourseHistoryTimeline')
    await act(async () => {
      root.render(<CourseHistoryTimeline courses={[]} />)
    })
    expect(container.textContent).toContain('No course history available')
    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
  })
})
