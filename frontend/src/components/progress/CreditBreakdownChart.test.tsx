// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreditRequirement } from './ProgressPage'

// Mock recharts — jsdom cannot render SVG charts
vi.mock('recharts', () => {
  const Passthrough = ({ children, ...props }: any) =>
    React.createElement('div', { 'data-testid': props['data-testid'] ?? 'recharts-mock' }, children)
  return {
    PieChart: Passthrough,
    Pie: ({ data, children }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'pie' },
        data?.map((d: any, i: number) =>
          React.createElement('span', { key: i, 'data-name': d.name, 'data-value': d.value }),
        ),
        children,
      ),
    Cell: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Sector: () => null,
    ResponsiveContainer: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  }
})

function makeReq(
  label: string,
  required: number,
  earned: number,
  in_progress: number,
): CreditRequirement {
  return { label, required, earned, in_progress, needed: Math.max(0, required - earned - in_progress) }
}

describe('CreditBreakdownChart', () => {
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

  async function render(props: {
    earned: number
    inProgress: number
    needed: number
    requirements: CreditRequirement[]
  }) {
    const { default: CreditBreakdownChart } = await import('./CreditBreakdownChart')
    await act(async () => {
      root.render(<CreditBreakdownChart {...props} />)
    })
  }

  it('renders credit totals per status category in legend', async () => {
    await render({
      earned: 60,
      inProgress: 15,
      needed: 45,
      requirements: [],
    })

    // Legend should show the three status categories with percentages
    expect(container.textContent).toContain('Earned')
    expect(container.textContent).toContain('In Progress')
    expect(container.textContent).toContain('Remaining')
    // 60/120 = 50%
    expect(container.textContent).toContain('50%')
  })

  it('category percentages sum correctly', async () => {
    await render({
      earned: 60,
      inProgress: 15,
      needed: 45,
      requirements: [],
    })

    // Total = 120. Earned=50%, InProgress=13% (12.5 rounded), Remaining=38% (37.5 rounded)
    // They may not sum to exactly 100 due to rounding, but each should be present
    const legendItems = container.querySelectorAll('[data-testid="pie"] span')
    const values = Array.from(legendItems).map((el) => Number(el.getAttribute('data-value')))
    const total = values.reduce((sum, v) => sum + v, 0)
    expect(total).toBe(120) // 60 + 15 + 45
  })

  it('zero credits renders without crash', async () => {
    await render({
      earned: 0,
      inProgress: 0,
      needed: 0,
      requirements: [],
    })

    // Should still render the container and heading
    expect(container.textContent).toContain('Credit Distribution')
    expect(container.querySelector('[data-testid="responsive-container"]')).not.toBeNull()
  })

  it('view mode toggle switches between Status and Category', async () => {
    const reqs = [
      makeReq('Gen Ed', 30, 20, 5),
      makeReq('Major', 42, 30, 3),
    ]
    await render({ earned: 50, inProgress: 8, needed: 62, requirements: reqs })

    // Initially in Status mode
    expect(container.textContent).toContain('By completion status')

    // Click Category button
    const categoryBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Category',
    )
    expect(categoryBtn).not.toBeUndefined()
    await act(async () => { categoryBtn!.click() })

    expect(container.textContent).toContain('By requirement category')
    // Should show requirement labels in legend
    expect(container.textContent).toContain('Gen Ed')
    expect(container.textContent).toContain('Major')
  })

  it('view toggle buttons have correct aria-pressed', async () => {
    await render({ earned: 60, inProgress: 10, needed: 50, requirements: [] })

    const group = container.querySelector('[role="group"]')
    expect(group).not.toBeNull()

    const statusBtn = Array.from(group!.querySelectorAll('button')).find(
      (b) => b.textContent === 'Status',
    )
    const categoryBtn = Array.from(group!.querySelectorAll('button')).find(
      (b) => b.textContent === 'Category',
    )

    expect(statusBtn!.getAttribute('aria-pressed')).toBe('true')
    expect(categoryBtn!.getAttribute('aria-pressed')).toBe('false')
  })

  it('filters out zero-value status entries from pie data', async () => {
    // No in-progress credits
    await render({ earned: 60, inProgress: 0, needed: 60, requirements: [] })

    const pieEntries = container.querySelectorAll('[data-testid="pie"] span[data-name]')
    const names = Array.from(pieEntries).map((el) => el.getAttribute('data-name'))

    expect(names).toContain('Earned')
    expect(names).toContain('Remaining')
    expect(names).not.toContain('In Progress')
  })
})
