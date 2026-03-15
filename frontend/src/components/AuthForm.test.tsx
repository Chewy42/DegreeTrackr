// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AuthForm from './AuthForm'
import type { AuthMode } from '../auth/AuthContext'

const BASE_PROPS = {
  mode: 'sign_in' as AuthMode,
  email: 'user@example.com',
  password: 'secret',
  confirmPassword: '',
  error: null,
  loading: false,
  setField: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
}

describe('AuthForm', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render(props: React.ComponentProps<typeof AuthForm> = BASE_PROPS) {
    await act(async () => { root.render(<AuthForm {...props} />) })
  }

  it('renders email field in sign_in mode (type=text with inputMode=email)', async () => {
    await render()
    // TextField renders email inputs as type="text" with inputMode="email"
    const emailInput = container.querySelector('input[inputmode="email"]')
    expect(emailInput).not.toBeNull()
  })

  it('renders password field in sign_in mode', async () => {
    await render()
    const pwInputs = container.querySelectorAll('input[type="password"]')
    expect(pwInputs.length).toBeGreaterThanOrEqual(1)
  })

  it('does not render confirm password field in sign_in mode', async () => {
    await render()
    const pwInputs = container.querySelectorAll('input[type="password"]')
    // sign_in mode has only 1 password field
    expect(pwInputs.length).toBe(1)
  })

  it('renders confirm password field in sign_up mode', async () => {
    await render({ ...BASE_PROPS, mode: 'sign_up' })
    const pwInputs = container.querySelectorAll('input[type="password"]')
    expect(pwInputs.length).toBe(2)
  })

  it('shows "Sign In" submit button in sign_in mode', async () => {
    await render()
    const btn = container.querySelector('button[type="submit"]')!
    expect(btn.textContent).toContain('Sign In')
  })

  it('shows "Create Account" submit button in sign_up mode', async () => {
    await render({ ...BASE_PROPS, mode: 'sign_up' })
    const btn = container.querySelector('button[type="submit"]')!
    expect(btn.textContent).toContain('Create Account')
  })

  it('calls onSubmit when form is submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    await render({ ...BASE_PROPS, onSubmit })
    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('shows error message when error prop is set', async () => {
    await render({ ...BASE_PROPS, error: 'Invalid password' })
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert!.textContent).toContain('Invalid password')
  })

  it('does not show error element when error is null', async () => {
    await render()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('submit button is disabled when loading=true', async () => {
    await render({ ...BASE_PROPS, loading: true })
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.disabled).toBe(true)
  })

  it('submit button is enabled when loading=false', async () => {
    await render()
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.disabled).toBe(false)
  })
})
