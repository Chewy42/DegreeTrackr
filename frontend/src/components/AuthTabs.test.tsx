// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AuthTabs from './AuthTabs'

// AuthMode is a type-only import in the component; mirror it here as a string union
type AuthMode = 'sign_in' | 'sign_up'

describe('AuthTabs', () => {
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

  async function render(mode: AuthMode, onChange = vi.fn()) {
    await act(async () => {
      root.render(<AuthTabs mode={mode} onChange={onChange} />)
    })
  }

  function getTabs(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  }

  it('renders a tablist container', async () => {
    await render('sign_in')
    expect(container.querySelector('[role="tablist"]')).not.toBeNull()
  })

  it('has the accessible label "Authentication mode" on the tablist', async () => {
    await render('sign_in')
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Authentication mode')
  })

  it('renders exactly two tabs', async () => {
    await render('sign_in')
    expect(getTabs().length).toBe(2)
  })

  it('renders "Sign In" and "Sign Up" labels', async () => {
    await render('sign_in')
    const labels = getTabs().map(t => t.textContent?.trim())
    expect(labels).toContain('Sign In')
    expect(labels).toContain('Sign Up')
  })

  it('marks Sign In as selected when mode is sign_in', async () => {
    await render('sign_in')
    const tabs = getTabs()
    const signInTab = tabs.find(t => t.textContent?.includes('Sign In'))!
    const signUpTab = tabs.find(t => t.textContent?.includes('Sign Up'))!
    expect(signInTab.getAttribute('aria-selected')).toBe('true')
    expect(signUpTab.getAttribute('aria-selected')).toBe('false')
  })

  it('marks Sign Up as selected when mode is sign_up', async () => {
    await render('sign_up')
    const tabs = getTabs()
    const signInTab = tabs.find(t => t.textContent?.includes('Sign In'))!
    const signUpTab = tabs.find(t => t.textContent?.includes('Sign Up'))!
    expect(signUpTab.getAttribute('aria-selected')).toBe('true')
    expect(signInTab.getAttribute('aria-selected')).toBe('false')
  })

  it('calls onChange with "sign_up" when the Sign Up tab is clicked', async () => {
    const onChange = vi.fn()
    await render('sign_in', onChange)
    const signUpTab = getTabs().find(t => t.textContent?.includes('Sign Up'))!
    await act(async () => { signUpTab.click() })
    expect(onChange).toHaveBeenCalledWith('sign_up')
  })

  it('calls onChange with "sign_in" when the Sign In tab is clicked', async () => {
    const onChange = vi.fn()
    await render('sign_up', onChange)
    const signInTab = getTabs().find(t => t.textContent?.includes('Sign In'))!
    await act(async () => { signInTab.click() })
    expect(onChange).toHaveBeenCalledWith('sign_in')
  })

  it('calls onChange exactly once per click', async () => {
    const onChange = vi.fn()
    await render('sign_in', onChange)
    const signUpTab = getTabs().find(t => t.textContent?.includes('Sign Up'))!
    await act(async () => { signUpTab.click() })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('all tabs are keyboard-focusable (tabIndex not -1)', async () => {
    await render('sign_in')
    for (const tab of getTabs()) {
      expect(tab.tabIndex).not.toBe(-1)
    }
  })
})
