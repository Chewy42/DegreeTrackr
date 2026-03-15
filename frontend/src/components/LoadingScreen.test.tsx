// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import LoadingScreen from './LoadingScreen'

describe('LoadingScreen', () => {
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
    await act(async () => { root.render(<LoadingScreen />) })
  }

  it('renders a status region with role=status', async () => {
    await render()
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })

  it('has aria-live="polite" on the status element', async () => {
    await render()
    const status = container.querySelector('[role="status"]')!
    expect(status.getAttribute('aria-live')).toBe('polite')
  })

  it('renders loading message text', async () => {
    await render()
    expect(container.textContent).toContain('DegreeTrackr')
  })

  it('renders the outer full-height container', async () => {
    await render()
    const outer = container.querySelector('div.min-h-screen')
    expect(outer).not.toBeNull()
  })

  it('renders without throwing', async () => {
    await expect(render()).resolves.toBeUndefined()
  })
})
