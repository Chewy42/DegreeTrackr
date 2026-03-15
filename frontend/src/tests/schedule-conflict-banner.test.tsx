// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ScheduleConflictBanner, { type ConflictInfo } from '../components/schedule/ScheduleConflictBanner'

function makeConflict(name1: string, name2: string, day = 'MWF'): ConflictInfo {
  return { classId1: name1, classId2: name2, name1, name2, day }
}

describe('ScheduleConflictBanner', () => {
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

  it('does not render when conflicts is empty', () => {
    act(() => { root.render(<ScheduleConflictBanner conflicts={[]} />) })
    expect(container.innerHTML).toBe('')
  })

  it('renders alert when a conflict exists', () => {
    const conflicts = [makeConflict('CS101', 'CS201')]
    act(() => { root.render(<ScheduleConflictBanner conflicts={conflicts} />) })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('shows both conflicting course names in the text', () => {
    const conflicts = [makeConflict('CS101', 'CS201')]
    act(() => { root.render(<ScheduleConflictBanner conflicts={conflicts} />) })
    expect(container.textContent).toContain('CS101')
    expect(container.textContent).toContain('CS201')
  })

  it('dismiss button calls onDismiss callback', () => {
    const onDismiss = vi.fn()
    const conflicts = [makeConflict('CS101', 'CS201')]
    act(() => { root.render(<ScheduleConflictBanner conflicts={conflicts} onDismiss={onDismiss} />) })

    const btn = container.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement
    expect(btn).not.toBeNull()
    act(() => { btn.click() })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('renders multiple conflicts as separate list items', () => {
    const conflicts = [
      makeConflict('CS101', 'CS201'),
      makeConflict('MATH200', 'PHYS150'),
    ]
    act(() => { root.render(<ScheduleConflictBanner conflicts={conflicts} />) })

    const items = container.querySelectorAll('li')
    expect(items.length).toBe(2)
    expect(container.textContent).toContain('MATH200')
    expect(container.textContent).toContain('PHYS150')
  })
})
