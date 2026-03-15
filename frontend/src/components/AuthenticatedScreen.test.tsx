// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
    await act(async () => {
      root.render(<AuthenticatedScreen />)
    })
  }

  it('renders the welcome heading', async () => {
    await render()
    const h1 = container.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1!.textContent).toContain('Welcome to DegreeTrackr')
  })

  it('displays the signed-in confirmation message', async () => {
    await render()
    expect(container.textContent).toContain('You are signed in.')
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

  it('does not render any interactive form elements — this is a post-auth display', async () => {
    await render()
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })
})
