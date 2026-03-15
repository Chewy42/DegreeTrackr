// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
    await act(async () => {
      root.render(<LoadingScreen />)
    })
  }

  it('renders the loading message', async () => {
    await render()
    expect(container.textContent).toContain('Preparing your DegreeTrackr workspace...')
  })

  it('has role="status" for accessibility', async () => {
    await render()
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })

  it('has aria-live="polite" on the status element', async () => {
    await render()
    const status = container.querySelector('[role="status"]')!
    expect(status.getAttribute('aria-live')).toBe('polite')
  })

  it('renders a full-screen centered layout', async () => {
    await render()
    const outer = container.querySelector('div')!
    expect(outer.className).toContain('min-h-screen')
    expect(outer.className).toContain('flex')
    expect(outer.className).toContain('items-center')
    expect(outer.className).toContain('justify-center')
  })

  it('does not overflow the viewport — no overflow class set', async () => {
    await render()
    const outer = container.querySelector('div')!
    expect(outer.className).not.toContain('overflow-')
  })
})
