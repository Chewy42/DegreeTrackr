// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ScheduledClass, RequirementsSummary } from './types'

// ── Test factories ───────────────────────────────────────────────────────────

function makeScheduledClass(overrides: Partial<ScheduledClass> = {}): ScheduledClass {
  return {
    id: 'CS-101-01',
    code: 'CS 101',
    subject: 'CS',
    number: '101',
    section: '01',
    title: 'Intro to CS',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '10:00am - 10:50am',
    location: 'Room 100',
    professor: 'Prof Test',
    professorRating: null,
    semester: 'spring2026',
    semestersOffered: [],
    requirementsSatisfied: [
      { type: 'major_core', label: 'Major Core', shortLabel: 'Core', color: 'blue' },
    ],
    occurrenceData: {
      starts: 0,
      ends: 0,
      daysOccurring: { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [] },
    },
    color: '#DBEAFE',
    ...overrides,
  }
}

function makeRequirementsSummary(): RequirementsSummary {
  return {
    total: 2,
    byType: { major_core: 1, ge: 1 },
    requirements: [
      { type: 'major_core', label: 'Major Core', creditsNeeded: 12 },
      { type: 'ge', label: 'General Education', creditsNeeded: 6 },
    ],
  }
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('ScheduleImpactModal', () => {
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

  async function render(props: {
    isOpen: boolean
    onClose: () => void
    scheduledClasses: ScheduledClass[]
    baseRequirements: RequirementsSummary | null
  }) {
    const { default: ScheduleImpactModal } = await import('./ScheduleImpactModal')
    await act(async () => {
      root.render(<ScheduleImpactModal {...props} />)
    })
  }

  it('renders nothing when isOpen is false', async () => {
    const onClose = vi.fn()
    await render({
      isOpen: false,
      onClose,
      scheduledClasses: [],
      baseRequirements: makeRequirementsSummary(),
    })
    expect(container.textContent).toBe('')
  })

  it('shows loading message when baseRequirements is null', async () => {
    const onClose = vi.fn()
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [],
      baseRequirements: null,
    })
    expect(container.textContent).toContain('Loading requirements')
  })

  it('shows "no remaining requirements" when impact data is empty', async () => {
    const onClose = vi.fn()
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [],
      baseRequirements: {
        total: 0,
        byType: {},
        requirements: [],
      },
    })
    expect(container.textContent).toContain('No remaining requirements')
  })

  it('renders requirement labels and credit counts', async () => {
    const onClose = vi.fn()
    const cls = makeScheduledClass({ credits: 3 })
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [cls],
      baseRequirements: makeRequirementsSummary(),
    })

    // Major Core requirement should show +3 added credits out of 12 needed
    expect(container.textContent).toContain('Major Core')
    expect(container.textContent).toContain('+3')
    expect(container.textContent).toContain('12')
    expect(container.textContent).toContain('cr needed')
    // Remaining: 12 - 3 = 9
    expect(container.textContent).toContain('9 remaining')
  })

  it('shows contributing class codes', async () => {
    const onClose = vi.fn()
    const cls = makeScheduledClass()
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [cls],
      baseRequirements: makeRequirementsSummary(),
    })

    expect(container.textContent).toContain('CS 101')
    expect(container.textContent).toContain('3 cr')
  })

  it('shows "Met" badge when requirement is fully satisfied', async () => {
    const onClose = vi.fn()
    const cls = makeScheduledClass({
      credits: 12,
      requirementsSatisfied: [
        { type: 'major_core', label: 'Major Core', shortLabel: 'Core', color: 'blue' },
      ],
    })
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [cls],
      baseRequirements: makeRequirementsSummary(),
    })

    expect(container.textContent).toContain('Met')
    expect(container.textContent).toContain('0 remaining')
  })

  it('close button fires onClose', async () => {
    const onClose = vi.fn()
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [],
      baseRequirements: makeRequirementsSummary(),
    })

    const closeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    expect(closeBtn).not.toBeNull()
    await act(async () => { closeBtn!.click() })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('footer Close button fires onClose', async () => {
    const onClose = vi.fn()
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [],
      baseRequirements: makeRequirementsSummary(),
    })

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    const footerClose = buttons.find(b => b.textContent === 'Close')
    expect(footerClose).not.toBeNull()
    await act(async () => { footerClose!.click() })
    expect(onClose).toHaveBeenCalled()
  })

  it('has proper dialog accessibility attributes', async () => {
    const onClose = vi.fn()
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [],
      baseRequirements: makeRequirementsSummary(),
    })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.getAttribute('aria-modal')).toBe('true')
    expect(dialog!.getAttribute('aria-labelledby')).toBe('schedule-impact-modal-title')
  })

  it('multiple classes contribute credits to the same requirement', async () => {
    const onClose = vi.fn()
    const cls1 = makeScheduledClass({ id: 'CS-101-01', code: 'CS 101', credits: 3 })
    const cls2 = makeScheduledClass({ id: 'CS-201-01', code: 'CS 201', credits: 4 })
    await render({
      isOpen: true,
      onClose,
      scheduledClasses: [cls1, cls2],
      baseRequirements: makeRequirementsSummary(),
    })

    // 3 + 4 = 7 added credits towards Major Core (12 needed)
    expect(container.textContent).toContain('+7')
    expect(container.textContent).toContain('5 remaining')
    expect(container.textContent).toContain('CS 101')
    expect(container.textContent).toContain('CS 201')
  })
})
