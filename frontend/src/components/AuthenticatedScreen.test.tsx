// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AuthenticatedScreen from './AuthenticatedScreen'

describe('AuthenticatedScreen', () => {
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

  async function render() {
    await act(async () => { root.render(<AuthenticatedScreen />) })
  }

  it('renders without throwing', async () => {
    await expect(render()).resolves.toBeUndefined()
  })

  it('renders "Welcome to DegreeTrackr" heading', async () => {
    await render()
    const h1 = container.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1!.textContent).toContain('DegreeTrackr')
  })

  it('renders "You are signed in" confirmation text', async () => {
    await render()
    expect(container.textContent).toContain('signed in')
  })

  it('has a role=status region for assistive tech', async () => {
    await render()
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })

  it('has aria-live=polite on the status region', async () => {
    await render()
    const region = container.querySelector('[role="status"]')!
    expect(region.getAttribute('aria-live')).toBe('polite')
  })

  it('renders within a full-height min-h-screen container', async () => {
    await render()
    expect(container.querySelector('div.min-h-screen')).not.toBeNull()
  })
})
