// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Course } from '../components/progress/ProgressPage'

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCourse(term: string, grade: string, credits = 3): Course {
  return { term, grade, credits, subject: 'CS', number: '101', title: 'Test', type: null }
}

describe('GPATrendChart — data-change regression', () => {
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
    const { default: GPATrendChart } = await import('../components/progress/GPATrendChart')
    await act(async () => {
      root.render(<GPATrendChart courses={courses} />)
    })
  }

  async function rerender(courses: Course[]) {
    const { default: GPATrendChart } = await import('../components/progress/GPATrendChart')
    await act(async () => {
      root.render(<GPATrendChart courses={courses} />)
    })
  }

  it('renders 3 data points for 3 semesters (GPAs: 3.2→3.5→3.8)', async () => {
    // B+ ≈ 3.3 is close to 3.2, A- = 3.7 close to 3.5, A = 4.0 ≈ 3.8 — use exact grade mapping
    // To get exact GPAs we use courses with specific credit mixes
    const courses = [
      makeCourse('Fall 2023', 'B+'),    // term GPA 3.3
      makeCourse('Spring 2024', 'A-'),  // term GPA 3.7
      makeCourse('Fall 2024', 'A'),     // term GPA 4.0
    ]
    await render(courses)

    // Accessible data table should have 3 rows (one per term)
    const rows = container.querySelectorAll('table tbody tr')
    expect(rows).toHaveLength(3)

    // Verify term labels in accessible table
    expect(rows[0]!.textContent).toContain('Fall 2023')
    expect(rows[1]!.textContent).toContain('Spring 2024')
    expect(rows[2]!.textContent).toContain('Fall 2024')
  })

  it('adding a 4th semester updates to 4 data points', async () => {
    const initial = [
      makeCourse('Fall 2023', 'B+'),
      makeCourse('Spring 2024', 'A-'),
      makeCourse('Fall 2024', 'A'),
    ]
    await render(initial)

    let rows = container.querySelectorAll('table tbody tr')
    expect(rows).toHaveLength(3)

    // Add a 4th semester
    const updated = [
      ...initial,
      makeCourse('Spring 2025', 'A-'),  // GPA 3.7 (close to 3.6)
    ]
    await rerender(updated)

    rows = container.querySelectorAll('table tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[3]!.textContent).toContain('Spring 2025')
  })

  it('shows ↑ trend when last semester cumulative > previous cumulative', async () => {
    // Term 1: C (2.0), Term 2: A (4.0) → cumulative rises from 2.0 to 3.0
    const courses = [
      makeCourse('Fall 2023', 'C'),
      makeCourse('Spring 2024', 'A'),
    ]
    await render(courses)

    const upIndicator = container.querySelector('.gpa-trend-up')
    expect(upIndicator).not.toBeNull()
    expect(upIndicator!.textContent).toContain('↑')
    expect(container.querySelector('.gpa-trend-down')).toBeNull()
  })

  it('shows ↓ trend when last semester cumulative < previous cumulative', async () => {
    // Term 1: A (4.0), Term 2: C (2.0) → cumulative drops from 4.0 to 3.0
    const courses = [
      makeCourse('Fall 2023', 'A'),
      makeCourse('Spring 2024', 'C'),
    ]
    await render(courses)

    const downIndicator = container.querySelector('.gpa-trend-down')
    expect(downIndicator).not.toBeNull()
    expect(downIndicator!.textContent).toContain('↓')
    expect(container.querySelector('.gpa-trend-up')).toBeNull()
  })

  it('shows no trend arrow when all grades are equal (cumulative stays flat)', async () => {
    // All B grades → cumulative GPA stays 3.0 every term
    const courses = [
      makeCourse('Fall 2023', 'B'),
      makeCourse('Spring 2024', 'B'),
      makeCourse('Fall 2024', 'B'),
    ]
    await render(courses)

    // No trend indicator when cumulative is flat
    expect(container.querySelector('.gpa-trend-up')).toBeNull()
    expect(container.querySelector('.gpa-trend-down')).toBeNull()
  })

  it('empty data renders gracefully without crash', async () => {
    await render([])

    // Should show empty state message
    expect(container.textContent).toContain('No grade data available')

    // No chart region, no table
    expect(container.querySelector('[role="region"]')).toBeNull()
    expect(container.querySelector('table')).toBeNull()

    // No trend indicators
    expect(container.querySelector('.gpa-trend-up')).toBeNull()
    expect(container.querySelector('.gpa-trend-down')).toBeNull()
  })

  it('trend indicator updates correctly when data changes from rising to falling', async () => {
    // Start with rising trend
    const rising = [
      makeCourse('Fall 2023', 'C'),
      makeCourse('Spring 2024', 'A'),
    ]
    await render(rising)
    expect(container.querySelector('.gpa-trend-up')).not.toBeNull()

    // Rerender with falling trend
    const falling = [
      makeCourse('Fall 2023', 'A'),
      makeCourse('Spring 2024', 'C'),
    ]
    await rerender(falling)
    expect(container.querySelector('.gpa-trend-up')).toBeNull()
    expect(container.querySelector('.gpa-trend-down')).not.toBeNull()
  })

  it('per-term summary chips render for each semester', async () => {
    const courses = [
      makeCourse('Fall 2023', 'B+'),
      makeCourse('Spring 2024', 'A-'),
      makeCourse('Fall 2024', 'A'),
    ]
    await render(courses)

    // Check that per-term chips contain the term names
    const text = container.textContent!
    expect(text).toContain('Fall 2023')
    expect(text).toContain('Spring 2024')
    expect(text).toContain('Fall 2024')
  })
})
