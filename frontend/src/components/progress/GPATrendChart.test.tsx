// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Course } from './ProgressPage'

// Mock recharts — jsdom cannot render SVG charts
vi.mock('recharts', () => {
  const Passthrough = ({ children, ...props }: any) =>
    React.createElement('div', { 'data-testid': props['data-testid'] ?? 'recharts-mock' }, children)
  return {
    LineChart: Passthrough,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    ReferenceLine: () => null,
    Area: () => null,
    ComposedChart: Passthrough,
  }
})

function makeCourse(term: string, grade: string, credits = 3): Course {
  return { term, grade, credits, subject: 'CS', number: '101', title: 'Test', type: null }
}

describe('GPATrendChart', () => {
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
    const { default: GPATrendChart } = await import('./GPATrendChart')
    await act(async () => {
      root.render(<GPATrendChart courses={courses} />)
    })
  }

  it('renders chart container with sample GPA data', async () => {
    const courses = [
      makeCourse('Fall 2023', 'B+'),   // 3.3
      makeCourse('Spring 2024', 'A-'),  // 3.7
    ]
    await render(courses)

    const region = container.querySelector('[role="region"]')
    expect(region).not.toBeNull()
    expect(container.querySelector('[data-testid="responsive-container"]')).not.toBeNull()
  })

  it('renders empty state without crash when courses are empty', async () => {
    await render([])
    expect(container.textContent).toContain('No grade data available')
    // No chart region when empty
    expect(container.querySelector('[role="region"]')).toBeNull()
  })

  it('renders empty state when courses have no graded entries', async () => {
    const courses = [
      { term: 'Fall 2023', grade: null, credits: 3, subject: 'CS', number: '101', title: 'X', type: null },
    ]
    await render(courses)
    expect(container.textContent).toContain('No grade data available')
  })

  it('shows upward trend indicator when cumulative GPA is increasing', async () => {
    const courses = [
      makeCourse('Fall 2023', 'B'),     // 3.0
      makeCourse('Spring 2024', 'A'),   // 4.0 → cumulative rises
    ]
    await render(courses)

    const upIndicator = container.querySelector('.gpa-trend-up')
    expect(upIndicator).not.toBeNull()
    expect(upIndicator!.textContent).toContain('↑')
  })

  it('shows downward trend indicator when cumulative GPA is decreasing', async () => {
    const courses = [
      makeCourse('Fall 2023', 'A'),     // 4.0
      makeCourse('Spring 2024', 'C'),   // 2.0 → cumulative drops
    ]
    await render(courses)

    const downIndicator = container.querySelector('.gpa-trend-down')
    expect(downIndicator).not.toBeNull()
    expect(downIndicator!.textContent).toContain('↓')
  })

  it('shows no trend indicator with only one semester', async () => {
    const courses = [makeCourse('Fall 2023', 'A')]
    await render(courses)

    expect(container.querySelector('.gpa-trend-up')).toBeNull()
    expect(container.querySelector('.gpa-trend-down')).toBeNull()
  })

  it('chart wrapper has aria-label containing "GPA"', async () => {
    const courses = [makeCourse('Fall 2023', 'A')]
    await render(courses)

    const region = container.querySelector('[role="region"]')
    expect(region).not.toBeNull()
    expect(region!.getAttribute('aria-label')).toContain('GPA')
  })

  it('accessible data table is present with correct term data', async () => {
    const courses = [
      makeCourse('Fall 2023', 'B+', 3),
      makeCourse('Spring 2024', 'A-', 4),
    ]
    await render(courses)

    const table = container.querySelector('table')
    expect(table).not.toBeNull()

    const caption = table!.querySelector('caption')
    expect(caption!.textContent).toContain('GPA trend')

    const rows = table!.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)

    // First row should be Fall 2023
    expect(rows[0]!.textContent).toContain('Fall 2023')
  })

  it('displays correct stats summary values', async () => {
    const courses = [
      makeCourse('Fall 2023', 'B', 3),    // 3.0
      makeCourse('Spring 2024', 'A', 3),  // 4.0
    ]
    await render(courses)

    // Latest term GPA should be 4.00, cumulative should be 3.50, best should be 4.00
    expect(container.textContent).toContain('4.00')
    expect(container.textContent).toContain('3.50')
    expect(container.textContent).toContain('Latest Term')
    expect(container.textContent).toContain('Cumulative')
    expect(container.textContent).toContain('Best Term')
  })
})
