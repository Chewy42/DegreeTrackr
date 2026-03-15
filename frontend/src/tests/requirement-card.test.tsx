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

describe('RequirementItem card rendering', () => {
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

  it('renders requirement name from props', () => {
    const reqs = [makeReq('Upper Division Credits', 45, 20)]
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })

    expect(container.textContent).toContain('Upper Division Credits')
  })

  it('renders credit hours as earned/required', () => {
    const reqs = [makeReq('General Education', 30, 18)]
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })

    // The component renders "{earned}/{required}" in the button
    expect(container.textContent).toContain('18/30')
  })

  it('completed requirement shows Complete in aria-label', () => {
    const reqs = [makeReq('Core Requirements', 24, 24)]
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })

    const button = container.querySelector('button[aria-expanded]')
    expect(button).not.toBeNull()
    expect(button!.getAttribute('aria-label')).toContain('Complete')

    // Progress bar at 100%
    const progressBar = container.querySelector('[role="progressbar"]')
    expect(progressBar!.getAttribute('aria-valuenow')).toBe('100')
  })

  it('in-progress requirement shows progress bar with partial fill', () => {
    // 10 earned + 5 in-progress out of 30 required = 50% total progress
    const reqs = [makeReq('Elective Credits', 30, 10, 5)]
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })

    const button = container.querySelector('button[aria-expanded]')
    expect(button!.getAttribute('aria-label')).toContain('In Progress')

    const progressBar = container.querySelector('[role="progressbar"]')
    expect(progressBar!.getAttribute('aria-valuenow')).toBe('50')
  })

  it('not-started requirement shows Not Started in aria-label', () => {
    const reqs = [makeReq('Capstone Project', 6, 0)]
    act(() => { root.render(<RequirementsChecklist requirements={reqs} />) })

    const button = container.querySelector('button[aria-expanded]')
    expect(button!.getAttribute('aria-label')).toContain('Not Started')

    const progressBar = container.querySelector('[role="progressbar"]')
    expect(progressBar!.getAttribute('aria-valuenow')).toBe('0')
  })
})
