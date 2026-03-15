// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ScheduleImpactModal from './ScheduleImpactModal'
import type { ScheduledClass, RequirementsSummary } from './types'

// ─── Helpers ────────────────────────────────────────────────────

function makeClass(overrides: Partial<ScheduledClass> = {}): ScheduledClass {
  return {
    id: 'CS-101-01',
    code: 'CS 101-01',
    subject: 'CS',
    number: '101',
    section: '01',
    title: 'Intro to CS',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '10:00am - 10:50am',
    location: 'SCI 101',
    professor: 'Dr. Smith',
    professorRating: 4.5,
    semester: 'spring2026',
    semestersOffered: ['Spring', 'Fall'],
    occurrenceData: {
      starts: 0,
      ends: 0,
      daysOccurring: { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [] },
    },
    requirementsSatisfied: [],
    color: '#3b82f6',
    ...overrides,
  }
}

const BASE_REQUIREMENTS: RequirementsSummary = {
  total: 2,
  byType: { major_core: 1, ge: 1 },
  requirements: [
    { type: 'major_core', label: 'Core CS', creditsNeeded: 9 },
    { type: 'ge', label: 'General Education', creditsNeeded: 6 },
  ],
}

describe('ScheduleImpactModal', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const onClose = vi.fn()

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function renderModal(
    isOpen: boolean,
    scheduledClasses: ScheduledClass[],
    baseRequirements: RequirementsSummary | null,
  ) {
    await act(async () => {
      root.render(
        <ScheduleImpactModal
          isOpen={isOpen}
          onClose={onClose}
          scheduledClasses={scheduledClasses}
          baseRequirements={baseRequirements}
        />,
      )
    })
  }

  // ─── isOpen gate ───────────────────────────────────────────

  it('renders nothing when isOpen is false', async () => {
    await renderModal(false, [], BASE_REQUIREMENTS)
    expect(container.firstChild).toBeNull()
  })

  it('renders the modal when isOpen is true', async () => {
    await renderModal(true, [], BASE_REQUIREMENTS)
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  })

  // ─── Header ────────────────────────────────────────────────

  it('shows "Projected Progress" title when open', async () => {
    await renderModal(true, [], BASE_REQUIREMENTS)
    expect(container.textContent).toContain('Projected Progress')
  })

  // ─── Close button ──────────────────────────────────────────

  it('calls onClose when the close button is clicked', async () => {
    await renderModal(true, [], BASE_REQUIREMENTS)
    const closeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!
    await act(async () => { closeBtn.click() })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the footer "Close" button is clicked', async () => {
    await renderModal(true, [], BASE_REQUIREMENTS)
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    const footerClose = buttons.find(b => b.textContent?.trim() === 'Close')!
    await act(async () => { footerClose.click() })
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ─── null requirements (loading) ───────────────────────────

  it('shows loading message when baseRequirements is null', async () => {
    await renderModal(true, [], null)
    expect(container.textContent).toContain('Loading requirements')
  })

  // ─── Empty impact data ──────────────────────────────────────

  it('shows "No remaining requirements" when all requirements have 0 creditsNeeded and no classes', async () => {
    const noNeeds: RequirementsSummary = {
      total: 1,
      byType: { major_core: 1 },
      requirements: [{ type: 'major_core', label: 'Core CS', creditsNeeded: 0 }],
    }
    await renderModal(true, [], noNeeds)
    expect(container.textContent).toContain('No remaining requirements')
  })

  // ─── Requirements with creditsNeeded shown ──────────────────

  it('shows requirement labels that still have credits needed', async () => {
    await renderModal(true, [], BASE_REQUIREMENTS)
    expect(container.textContent).toContain('Core CS')
    expect(container.textContent).toContain('General Education')
  })

  // ─── Classes that satisfy requirements ──────────────────────

  it('shows added credits when a class satisfies a requirement', async () => {
    const cls = makeClass({
      requirementsSatisfied: [
        { type: 'major_core', label: 'Core CS', shortLabel: 'Core', color: 'blue' },
      ],
    })
    await renderModal(true, [cls], BASE_REQUIREMENTS)
    expect(container.textContent).toContain('+3')
  })

  it('shows the class code in contributing classes section', async () => {
    const cls = makeClass({
      code: 'CS 101-01',
      requirementsSatisfied: [
        { type: 'major_core', label: 'Core CS', shortLabel: 'Core', color: 'blue' },
      ],
    })
    await renderModal(true, [cls], BASE_REQUIREMENTS)
    expect(container.textContent).toContain('CS 101-01')
  })

  it('shows "Met" badge when a requirement is fully satisfied', async () => {
    // 9 credits needed, add 3+3+3 = 9 → fully met
    const cls1 = makeClass({ id: 'cs-101', code: 'CS 101', credits: 3, requirementsSatisfied: [{ type: 'major_core', label: 'Core CS', shortLabel: 'Core', color: 'blue' }] })
    const cls2 = makeClass({ id: 'cs-201', code: 'CS 201', credits: 3, requirementsSatisfied: [{ type: 'major_core', label: 'Core CS', shortLabel: 'Core', color: 'blue' }] })
    const cls3 = makeClass({ id: 'cs-301', code: 'CS 301', credits: 3, requirementsSatisfied: [{ type: 'major_core', label: 'Core CS', shortLabel: 'Core', color: 'blue' }] })
    await renderModal(true, [cls1, cls2, cls3], BASE_REQUIREMENTS)
    expect(container.textContent).toContain('Met')
  })

  // ─── No class impact ─────────────────────────────────────────

  it('shows "0" added credits and remaining credits when no class satisfies a requirement', async () => {
    await renderModal(true, [], BASE_REQUIREMENTS)
    // Both requirements appear with no added credits
    expect(container.textContent).toContain('Core CS')
    expect(container.textContent).toContain('General Education')
    // The component renders "0/9 cr needed" and "0/6 cr needed" for unmet requirements
    expect(container.textContent).toContain('0/9 cr needed')
    expect(container.textContent).toContain('0/6 cr needed')
  })

  // ─── Backdrop click ──────────────────────────────────────────

  it('calls onClose when clicking the backdrop overlay', async () => {
    await renderModal(true, [], BASE_REQUIREMENTS)
    // The outer div (backdrop) has onClick=onClose
    const backdrop = container.querySelector<HTMLDivElement>('div.fixed.inset-0')!
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalled()
  })
})
