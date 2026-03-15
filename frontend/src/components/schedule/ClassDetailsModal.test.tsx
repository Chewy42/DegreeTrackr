// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ScheduledClass } from './types'

// ── Test factory ─────────────────────────────────────────────────────────────

function makeScheduledClass(overrides: Partial<ScheduledClass> = {}): ScheduledClass {
  return {
    id: 'CS-101-01',
    code: 'CS 101',
    subject: 'CS',
    number: '101',
    section: '01',
    title: 'Intro to Computer Science',
    credits: 3,
    displayDays: 'MWF',
    displayTime: '10:00am - 10:50am',
    location: 'Science Hall 201',
    professor: 'Dr. Smith',
    professorRating: 4.5,
    semester: 'spring2026',
    semestersOffered: ['Spring', 'Fall'],
    requirementsSatisfied: [],
    occurrenceData: {
      starts: 0,
      ends: 0,
      daysOccurring: { M: [], Tu: [], W: [], Th: [], F: [], Sa: [], Su: [] },
    },
    color: '#DBEAFE',
    ...overrides,
  }
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('ClassDetailsModal', () => {
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
    classData: ScheduledClass | null
  }) {
    const { default: ClassDetailsModal } = await import('./ClassDetailsModal')
    await act(async () => {
      root.render(<ClassDetailsModal {...props} />)
    })
  }

  it('renders nothing when isOpen is false', async () => {
    const onClose = vi.fn()
    await render({ isOpen: false, onClose, classData: makeScheduledClass() })
    expect(container.textContent).toBe('')
  })

  it('renders nothing when classData is null', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, classData: null })
    expect(container.textContent).toBe('')
  })

  it('renders course code, title, credits, schedule, time, location, and professor', async () => {
    const onClose = vi.fn()
    const cls = makeScheduledClass()
    await render({ isOpen: true, onClose, classData: cls })

    expect(container.textContent).toContain('CS 101')
    expect(container.textContent).toContain('Intro to Computer Science')
    expect(container.textContent).toContain('3')
    expect(container.textContent).toContain('credit')
    expect(container.textContent).toContain('MWF')
    expect(container.textContent).toContain('10:00am - 10:50am')
    expect(container.textContent).toContain('Science Hall 201')
    expect(container.textContent).toContain('Dr. Smith')
  })

  it('shows professor rating when available', async () => {
    const onClose = vi.fn()
    const cls = makeScheduledClass({ professorRating: 4.5 })
    await render({ isOpen: true, onClose, classData: cls })

    expect(container.textContent).toContain('4.5')
    expect(container.textContent).toContain('rating')
  })

  it('shows TBA for missing schedule fields', async () => {
    const onClose = vi.fn()
    const cls = makeScheduledClass({
      displayDays: '',
      displayTime: '',
      location: '',
      professor: '',
    })
    await render({ isOpen: true, onClose, classData: cls })

    const text = container.textContent!
    expect(text.match(/TBA/g)!.length).toBeGreaterThanOrEqual(3)
  })

  it('close button fires onClose', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, classData: makeScheduledClass() })

    const closeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    expect(closeBtn).not.toBeNull()

    await act(async () => { closeBtn!.click() })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('footer Close button fires onClose', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, classData: makeScheduledClass() })

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    const footerClose = buttons.find(b => b.textContent === 'Close')
    expect(footerClose).not.toBeNull()

    await act(async () => { footerClose!.click() })
    expect(onClose).toHaveBeenCalled()
  })

  it('backdrop click fires onClose', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, classData: makeScheduledClass() })

    // The backdrop is the outermost fixed div
    const backdrop = container.querySelector<HTMLDivElement>('.fixed')
    expect(backdrop).not.toBeNull()

    await act(async () => {
      backdrop!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('renders requirements section when requirementsSatisfied is non-empty', async () => {
    const onClose = vi.fn()
    const cls = makeScheduledClass({
      requirementsSatisfied: [
        { type: 'major_core', label: 'Major Core', shortLabel: 'Core', color: 'blue' },
        { type: 'ge', label: 'General Education', shortLabel: 'GE', color: 'green' },
      ],
    })
    await render({ isOpen: true, onClose, classData: cls })

    expect(container.textContent).toContain('Satisfies Requirements')
    expect(container.textContent).toContain('Major Core')
    expect(container.textContent).toContain('General Education')
  })

  it('has proper dialog accessibility attributes', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, classData: makeScheduledClass() })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.getAttribute('aria-modal')).toBe('true')
    expect(dialog!.getAttribute('aria-labelledby')).toBe('class-details-title')
  })
})
