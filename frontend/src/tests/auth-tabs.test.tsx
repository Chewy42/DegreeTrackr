// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

describe('AuthTabs — DT194', () => {
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

  async function render(mode: 'sign_in' | 'sign_up' = 'sign_in', onChange = vi.fn()) {
    const { default: AuthTabs } = await import('../components/AuthTabs')
    await act(async () => { root.render(<AuthTabs mode={mode} onChange={onChange} />) })
    return onChange
  }

  it('renders "Sign In" and "Sign Up" tabs', async () => {
    await render()
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]!.textContent).toBe('Sign In')
    expect(tabs[1]!.textContent).toBe('Sign Up')
  })

  it('clicking "Sign Up" tab calls onChange with sign_up', async () => {
    const onChange = await render('sign_in')
    const signUpTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      t => t.textContent === 'Sign Up'
    )!
    await act(async () => { signUpTab.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onChange).toHaveBeenCalledWith('sign_up')
  })

  it('clicking "Sign In" tab calls onChange with sign_in', async () => {
    const onChange = await render('sign_up')
    const signInTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      t => t.textContent === 'Sign In'
    )!
    await act(async () => { signInTab.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onChange).toHaveBeenCalledWith('sign_in')
  })

  it('active tab has aria-selected="true"', async () => {
    await render('sign_up')
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('false')
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
  })
})

describe('AuthenticatedView — DT194', () => {
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

  it('renders welcome heading for authenticated users', async () => {
    const { default: AuthenticatedView } = await import('../components/AuthenticatedView')
    await act(async () => { root.render(<AuthenticatedView />) })
    const heading = container.querySelector('h1')
    expect(heading).not.toBeNull()
    expect(heading!.textContent).toBe('Welcome to DegreeTrackr')
  })
})
