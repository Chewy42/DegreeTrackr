// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import RequirementsChecklist from '../components/progress/RequirementsChecklist'
import type { CreditRequirement } from '../components/progress/ProgressPage'

function makeReq(
  label: string,
  required: number,
  earned: number,
  inProgress = 0,
): CreditRequirement {
  return {
    label,
    required,
    earned,
    in_progress: inProgress,
    needed: Math.max(0, required - earned - inProgress),
  }
}

function buildRequirements(total: number, completeCount: number): CreditRequirement[] {
  return Array.from({ length: total }, (_, i) => {
    const done = i < completeCount
    return makeReq(`Requirement ${i + 1}`, 10, done ? 10 : 0)
  })
}

describe('Degree completion checklist', () => {
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

  it('10 requirements with 5 complete → 5 checked items and 5 unchecked', () => {
    const reqs = buildRequirements(10, 5)
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })

    // Check status text shows 5 of 10 complete
    expect(container.textContent).toContain('5 of 10 categories complete')

    // 5 items have emerald check icons (complete), 5 have slate circle (not started)
    const progressBars = container.querySelectorAll('[role="progressbar"]')
    expect(progressBars).toHaveLength(10)

    const fullBars = Array.from(progressBars).filter(
      (bar) => bar.getAttribute('aria-valuenow') === '100',
    )
    const emptyBars = Array.from(progressBars).filter(
      (bar) => bar.getAttribute('aria-valuenow') === '0',
    )
    expect(fullBars).toHaveLength(5)
    expect(emptyBars).toHaveLength(5)
  })

  it('all 10 complete → shows 100% complete', () => {
    const reqs = buildRequirements(10, 10)
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })

    expect(container.textContent).toContain('10 of 10 categories complete')
    expect(container.textContent).toContain('100% complete')
  })

  it('0 complete → all unchecked, 0% progress bar', () => {
    const reqs = buildRequirements(10, 0)
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })

    expect(container.textContent).toContain('0 of 10 categories complete')
    expect(container.textContent).toContain('0% complete')

    const progressBars = container.querySelectorAll('[role="progressbar"]')
    const allZero = Array.from(progressBars).every(
      (bar) => bar.getAttribute('aria-valuenow') === '0',
    )
    expect(allZero).toBe(true)
  })

  it('completing one requirement updates count from 5 to 6 of 10', () => {
    const reqs = buildRequirements(10, 5)
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })
    expect(container.textContent).toContain('5 of 10 categories complete')

    // Simulate completing requirement 6 by re-rendering with updated data
    const updated = [...reqs]
    updated[5] = makeReq('Requirement 6', 10, 10)
    act(() => { root.render(<RequirementsChecklist requirements={updated} />) })

    expect(container.textContent).toContain('6 of 10 categories complete')
    expect(container.textContent).toContain('60% complete')
  })

  it('empty requirements list → graceful empty state', () => {
    act(() => { root.render(<RequirementsChecklist requirements={[]} />) })

    expect(container.textContent).toContain('0 of 0 categories complete')
    expect(container.textContent).toContain('No requirements found')
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(0)
  })
})
