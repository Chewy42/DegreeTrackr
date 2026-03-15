// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import UpcomingMilestones from './UpcomingMilestones'
import type { CreditRequirement, Course } from './ProgressPage'

describe('UpcomingMilestones', () => {
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

  async function renderMilestones(
    creditRequirements: CreditRequirement[],
    courses?: {
      all_found: Course[]
      in_progress: Course[]
      completed: Course[]
    },
    studentInfo?: { name?: string; expected_graduation?: string; program?: string },
  ) {
    await act(async () => {
      root.render(
        <UpcomingMilestones
          creditRequirements={creditRequirements}
          courses={courses}
          studentInfo={studentInfo}
        />,
      )
    })
  }

  // ─── Empty / null state ─────────────────────────────────────

  it('returns null (renders nothing) for empty requirements with no courses', async () => {
    await renderMilestones([])
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all requirements are fully met and no courses in progress', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 120, in_progress: 0, needed: 0 },
    ]
    await renderMilestones(reqs)
    // overallProgress = 100% → goes into the graduation milestone block (75–100%)
    // But "needed: 0" means no near-completion milestone from nearCompletion filter
    // 100% overall means none of the 25/50/75 blocks trigger either
    // So only courses/studentInfo could add items — none here
    expect(container.firstChild).toBeNull()
  })

  // ─── Near-completion milestone ───────────────────────────────

  it('shows "Complete <label>" milestone when a requirement has needed <= 6', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Math Electives', required: 12, earned: 9, in_progress: 0, needed: 3 },
    ]
    await renderMilestones(reqs)
    expect(container.textContent).toContain('Complete Math Electives')
    expect(container.textContent).toContain('3 more credits needed')
  })

  it('does not show near-completion milestone when needed > 6', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Core Requirements', required: 60, earned: 20, in_progress: 0, needed: 40 },
    ]
    await renderMilestones(reqs)
    expect(container.textContent).not.toContain('Complete Core Requirements')
  })

  // ─── Overall progress milestones ────────────────────────────

  it('shows "Reach 50% Completion" milestone when overall progress is 25–49%', async () => {
    // 30 of 120 earned = 25%
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 30, in_progress: 0, needed: 90 },
    ]
    await renderMilestones(reqs)
    expect(container.textContent).toContain('Reach 50% Completion')
  })

  it('shows "Reach 75% Completion" milestone when overall progress is 50–74%', async () => {
    // 72 of 120 = 60%
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 72, in_progress: 0, needed: 48 },
    ]
    await renderMilestones(reqs)
    expect(container.textContent).toContain('Reach 75% Completion')
  })

  it('shows graduation milestone when overall progress is 75–99%', async () => {
    // 90 of 120 = 75%
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 90, in_progress: 0, needed: 30 },
    ]
    await renderMilestones(reqs)
    expect(container.textContent).toContain('Complete Your Degree')
  })

  // ─── In-progress courses milestone ──────────────────────────

  it('shows "Complete Current Courses" milestone when courses are in progress', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 30, in_progress: 9, needed: 90 },
    ]
    const inProgress: Course[] = [
      { title: 'CS 401', credits: 3 },
      { title: 'MATH 301', credits: 3 },
      { title: 'ENG 201', credits: 3 },
    ]
    await renderMilestones(reqs, {
      all_found: inProgress,
      in_progress: inProgress,
      completed: [],
    })
    expect(container.textContent).toContain('Complete Current Courses')
    expect(container.textContent).toContain('3 courses')
    expect(container.textContent).toContain('9 credits')
  })

  it('does not show current courses milestone when in_progress is empty', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 30, in_progress: 0, needed: 90 },
    ]
    await renderMilestones(reqs, { all_found: [], in_progress: [], completed: [] })
    expect(container.textContent).not.toContain('Complete Current Courses')
  })

  // ─── Expected graduation milestone ──────────────────────────

  it('shows expected graduation milestone when studentInfo has expected_graduation', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 30, in_progress: 0, needed: 90 },
    ]
    await renderMilestones(reqs, undefined, { expected_graduation: 'Spring 2027' })
    expect(container.textContent).toContain('Expected Graduation')
    expect(container.textContent).toContain('Spring 2027')
  })

  it('does not show graduation date milestone when studentInfo has no expected_graduation', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 30, in_progress: 0, needed: 90 },
    ]
    await renderMilestones(reqs, undefined, { name: 'Jane' })
    expect(container.textContent).not.toContain('Expected Graduation')
  })

  // ─── Progress bar ────────────────────────────────────────────

  it('renders a progress bar for the near-completion milestone', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Math Electives', required: 12, earned: 9, in_progress: 0, needed: 3 },
    ]
    await renderMilestones(reqs)
    const progressBar = container.querySelector('[role="progressbar"]')
    expect(progressBar).not.toBeNull()
    const value = Number(progressBar!.getAttribute('aria-valuenow'))
    expect(value).toBeGreaterThan(0)
    expect(value).toBeLessThanOrEqual(100)
  })

  // ─── Max 4 milestones ────────────────────────────────────────

  it('renders at most 4 milestone tiles', async () => {
    // All conditions can fire: near-completion, 25-49% progress, in-progress courses, graduation date
    const reqs: CreditRequirement[] = [
      { label: 'Gen Ed', required: 40, earned: 6, in_progress: 0, needed: 4 },
      { label: 'Total', required: 120, earned: 30, in_progress: 9, needed: 90 },
    ]
    const inProgress: Course[] = [{ title: 'CS 301', credits: 3 }, { title: 'MATH 201', credits: 3 }, { title: 'ENG 201', credits: 3 }]
    await renderMilestones(
      reqs,
      { all_found: inProgress, in_progress: inProgress, completed: [] },
      { expected_graduation: 'Spring 2027' },
    )
    // Component slices to max 4
    const tiles = container.querySelectorAll('[class*="rounded-xl"][class*="border"]')
    expect(tiles.length).toBeLessThanOrEqual(4)
  })

  // ─── Static UI ───────────────────────────────────────────────

  it('renders "Upcoming Milestones" heading when milestones exist', async () => {
    const reqs: CreditRequirement[] = [
      { label: 'Total', required: 120, earned: 30, in_progress: 0, needed: 90 },
    ]
    await renderMilestones(reqs, undefined, { expected_graduation: 'Spring 2027' })
    expect(container.textContent).toContain('Upcoming Milestones')
  })
})
