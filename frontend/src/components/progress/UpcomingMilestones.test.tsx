// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreditRequirement, Course, StudentInfo } from './ProgressPage'

vi.mock('react-icons/fi', () => ({
  FiTarget: () => React.createElement('span', null, 'target'),
  FiAward: () => React.createElement('span', null, 'award'),
  FiCalendar: () => React.createElement('span', null, 'calendar'),
  FiTrendingUp: () => React.createElement('span', null, 'trending'),
  FiBookOpen: () => React.createElement('span', null, 'book'),
}))

function makeReq(
  label: string,
  required: number,
  earned: number,
  in_progress: number,
): CreditRequirement {
  return { label, required, earned, in_progress, needed: Math.max(0, required - earned - in_progress) }
}

function makeCourse(term: string, grade: string | null, credits = 3): Course {
  return { term, subject: 'CS', number: '101', title: 'Test', grade, credits, type: null }
}

describe('UpcomingMilestones', () => {
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
    creditRequirements: CreditRequirement[]
    courses?: { all_found: Course[]; in_progress: Course[]; completed: Course[] }
    studentInfo?: StudentInfo
  }) {
    const { default: UpcomingMilestones } = await import('./UpcomingMilestones')
    await act(async () => {
      root.render(<UpcomingMilestones {...props} />)
    })
  }

  it('renders milestone items from requirements and courses', async () => {
    const reqs = [
      makeReq('Gen Ed', 30, 27, 3),    // needed=0, complete
      makeReq('Major', 42, 38, 0),      // needed=4, near completion
    ]
    const courses = {
      all_found: [makeCourse('Fall 2023', 'A')],
      in_progress: [makeCourse('Spring 2024', null)],
      completed: [makeCourse('Fall 2023', 'A')],
    }
    await render({ creditRequirements: reqs, courses })

    // Should show "Complete Major" milestone (near completion, needed=4 ≤ 6)
    expect(container.textContent).toContain('Complete Major')
    // Should show current courses milestone
    expect(container.textContent).toContain('Complete Current Courses')
  })

  it('high priority milestones appear before low priority', async () => {
    const reqs = [
      makeReq('Major', 42, 38, 0), // needed=4 → high priority next-requirement
    ]
    const studentInfo: StudentInfo = { expected_graduation: 'Spring 2026' }
    await render({ creditRequirements: reqs, studentInfo })

    const text = container.textContent ?? ''
    const majorIdx = text.indexOf('Complete Major')
    const gradIdx = text.indexOf('Expected Graduation')
    expect(majorIdx).toBeGreaterThan(-1)
    expect(gradIdx).toBeGreaterThan(-1)
    // High priority "Complete Major" should come before low priority "Expected Graduation"
    expect(majorIdx).toBeLessThan(gradIdx)
  })

  it('renders nothing when no milestones are generated', async () => {
    // All complete, no near-completion, no in-progress courses, no graduation date
    const reqs = [makeReq('Gen Ed', 30, 30, 0)]
    await render({ creditRequirements: reqs })

    // Component returns null when milestones.length === 0
    // No milestones heading should be present
    expect(container.textContent).not.toContain('Upcoming Milestones')
    expect(container.innerHTML).toBe('')
  })

  it('shows graduation milestone for students at 75%+ progress', async () => {
    // 80/100 = 80% overall progress → triggers "Complete Your Degree!" milestone
    const reqs = [makeReq('Total', 100, 80, 0)]
    await render({ creditRequirements: reqs })

    expect(container.textContent).toContain('Complete Your Degree!')
  })

  it('shows halfway milestone for students between 25-50%', async () => {
    // 35/100 = 35%
    const reqs = [makeReq('Total', 100, 35, 0)]
    await render({ creditRequirements: reqs })

    expect(container.textContent).toContain('Reach 50% Completion')
  })

  it('shows expected graduation date from student info', async () => {
    const reqs = [makeReq('Major', 42, 38, 0)] // needed=4 to generate at least one milestone
    const studentInfo: StudentInfo = { expected_graduation: 'May 2027' }
    await render({ creditRequirements: reqs, studentInfo })

    expect(container.textContent).toContain('May 2027')
    expect(container.textContent).toContain('Expected Graduation')
  })

  it('progress bars have correct aria attributes', async () => {
    const reqs = [makeReq('Major', 42, 38, 0)] // needed=4
    await render({ creditRequirements: reqs })

    const progressbar = container.querySelector('[role="progressbar"]')
    expect(progressbar).not.toBeNull()
    expect(Number(progressbar!.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    expect(progressbar!.getAttribute('aria-valuemin')).toBe('0')
    expect(progressbar!.getAttribute('aria-valuemax')).toBe('100')
  })
})
