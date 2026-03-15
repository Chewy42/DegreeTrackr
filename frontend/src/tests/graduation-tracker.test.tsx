// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import GraduationTracker from '../components/progress/GraduationTracker'

describe('GraduationTracker', () => {
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

  it('renders expected graduation year', () => {
    act(() => {
      root.render(
        <GraduationTracker expectedGradYear={2027} creditsCompleted={60} creditsExpected={60} />,
      )
    })
    const year = container.querySelector('[data-testid="grad-year"]')
    expect(year!.textContent).toBe('2027')
  })

  it('shows On Track when creditsCompleted equals creditsExpected', () => {
    act(() => {
      root.render(
        <GraduationTracker expectedGradYear={2027} creditsCompleted={60} creditsExpected={60} />,
      )
    })
    const status = container.querySelector('[data-testid="track-status"]')
    expect(status!.textContent).toBe('On Track')
  })

  it('shows Behind when creditsCompleted < creditsExpected - threshold', () => {
    act(() => {
      root.render(
        <GraduationTracker expectedGradYear={2027} creditsCompleted={50} creditsExpected={60} threshold={3} />,
      )
    })
    const status = container.querySelector('[data-testid="track-status"]')
    expect(status!.textContent).toBe('Behind')
  })

  it('shows Ahead when creditsCompleted > creditsExpected + threshold', () => {
    act(() => {
      root.render(
        <GraduationTracker expectedGradYear={2027} creditsCompleted={70} creditsExpected={60} threshold={3} />,
      )
    })
    const status = container.querySelector('[data-testid="track-status"]')
    expect(status!.textContent).toBe('Ahead')
  })

  it('renders default year without crash when totalCourses is 0', () => {
    act(() => {
      root.render(
        <GraduationTracker expectedGradYear={2028} creditsCompleted={0} creditsExpected={0} totalCourses={0} />,
      )
    })
    const year = container.querySelector('[data-testid="grad-year"]')
    expect(year!.textContent).toBe('2028')
    expect(container.textContent).not.toContain('courses')
  })
})
