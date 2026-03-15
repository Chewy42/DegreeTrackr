// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreditRequirement } from './ProgressPage'

vi.mock('react-icons/fi', () => ({
  FiCheck: (props: any) => React.createElement('span', { ...props, 'data-icon': 'check' }),
  FiClock: (props: any) => React.createElement('span', { ...props, 'data-icon': 'clock' }),
  FiCircle: (props: any) => React.createElement('span', { ...props, 'data-icon': 'circle' }),
  FiChevronDown: () => React.createElement('span', null, 'v'),
  FiChevronUp: () => React.createElement('span', null, '^'),
}))

function makeReq(
  label: string,
  required: number,
  earned: number,
  in_progress: number,
): CreditRequirement {
  return { label, required, earned, in_progress, needed: Math.max(0, required - earned - in_progress) }
}

describe('RequirementsChecklist', () => {
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

  async function render(requirements: CreditRequirement[]) {
    const { default: RequirementsChecklist } = await import('./RequirementsChecklist')
    await act(async () => {
      root.render(<RequirementsChecklist requirements={requirements} />)
    })
  }

  it('completed requirement shows check icon', async () => {
    const reqs = [makeReq('General Education', 30, 30, 0)]
    await render(reqs)

    const checkIcon = container.querySelector('[data-icon="check"]')
    expect(checkIcon).not.toBeNull()
  })

  it('completed requirement button aria-label contains Complete', async () => {
    const reqs = [makeReq('General Education', 30, 30, 0)]
    await render(reqs)

    const button = container.querySelector('button[aria-expanded]')
    expect(button).not.toBeNull()
    expect(button!.getAttribute('aria-label')).toContain('Complete')
    expect(button!.getAttribute('aria-label')).toContain('30 of 30')
  })

  it('incomplete requirement shows progress fraction', async () => {
    const reqs = [makeReq('Major Credits', 12, 6, 0)]
    await render(reqs)

    // Shows "6/12" in the button area
    expect(container.textContent).toContain('6/12')
  })

  it('in-progress requirement shows clock icon', async () => {
    const reqs = [makeReq('Electives', 18, 9, 3)]
    await render(reqs)

    const clockIcon = container.querySelector('[data-icon="clock"]')
    expect(clockIcon).not.toBeNull()
  })

  it('empty requirements renders empty state, not crash', async () => {
    await render([])

    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(container.textContent).toContain('No requirements found')
  })

  it('shows completion count in header', async () => {
    const reqs = [
      makeReq('Gen Ed', 30, 30, 0),   // complete
      makeReq('Major', 42, 21, 3),     // incomplete
      makeReq('Electives', 12, 12, 0), // complete
    ]
    await render(reqs)

    expect(container.textContent).toContain('2 of 3 categories complete')
  })

  it('filter tabs work — Incomplete hides completed items', async () => {
    const reqs = [
      makeReq('Gen Ed', 30, 30, 0),   // complete (needed=0)
      makeReq('Major', 42, 21, 3),     // incomplete
    ]
    await render(reqs)

    // Both visible initially
    expect(container.textContent).toContain('Gen Ed')
    expect(container.textContent).toContain('Major')

    // Click Incomplete filter
    const incompleteBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Incomplete',
    )
    expect(incompleteBtn).not.toBeUndefined()
    await act(async () => { incompleteBtn!.click() })

    // Gen Ed should be hidden, Major should remain
    const buttons = Array.from(container.querySelectorAll('button[aria-expanded]'))
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.getAttribute('aria-label')).toContain('Major')
  })

  it('progressbar has correct aria attributes', async () => {
    const reqs = [makeReq('Science', 20, 10, 5)]
    await render(reqs)

    const progressbar = container.querySelector('[role="progressbar"]')
    expect(progressbar).not.toBeNull()
    // progress = (10+5)/20 * 100 = 75
    expect(progressbar!.getAttribute('aria-valuenow')).toBe('75')
    expect(progressbar!.getAttribute('aria-valuemin')).toBe('0')
    expect(progressbar!.getAttribute('aria-valuemax')).toBe('100')
  })

  it('expanding a requirement shows earned/in-progress/required/needed detail', async () => {
    const reqs = [makeReq('Major Credits', 42, 21, 3)]
    await render(reqs)

    const expandBtn = container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')
    expect(expandBtn).not.toBeNull()
    await act(async () => { expandBtn!.click() })

    expect(container.textContent).toContain('Earned')
    expect(container.textContent).toContain('21.0')
    expect(container.textContent).toContain('In Progress')
    expect(container.textContent).toContain('3.0')
    expect(container.textContent).toContain('Required')
    expect(container.textContent).toContain('42.0')
    expect(container.textContent).toContain('Still Needed')
    expect(container.textContent).toContain('18.0')
  })
})
