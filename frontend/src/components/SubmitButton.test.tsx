// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SubmitButton from './SubmitButton'

describe('SubmitButton', () => {
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

  function getButton() {
    return container.querySelector('button')!
  }

  async function render(props: React.ComponentProps<typeof SubmitButton>) {
    await act(async () => {
      root.render(<SubmitButton {...props} />)
    })
  }

  it('renders children as the button label', async () => {
    await render({ children: 'Sign In' })
    expect(getButton().textContent).toBe('Sign In')
  })

  it('has type="submit" by default', async () => {
    await render({ children: 'Submit' })
    expect(getButton().getAttribute('type')).toBe('submit')
  })

  it('fires onClick when not loading', async () => {
    const onClick = vi.fn()
    await render({ children: 'Submit', onClick })
    await act(async () => { getButton().click() })
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('shows "Please wait..." and is disabled during loading', async () => {
    await render({ children: 'Submit', loading: true })
    const btn = getButton()
    expect(btn.textContent).toBe('Please wait...')
    expect(btn.disabled).toBe(true)
  })

  it('does not fire onClick when loading', async () => {
    const onClick = vi.fn()
    await render({ children: 'Submit', loading: true, onClick })
    await act(async () => { getButton().click() })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('sets aria-busy when loading', async () => {
    await render({ children: 'Submit', loading: true })
    expect(getButton().getAttribute('aria-busy')).toBe('true')
  })

  it('does not set aria-busy when not loading', async () => {
    await render({ children: 'Submit' })
    expect(getButton().getAttribute('aria-busy')).toBeNull()
  })
})
