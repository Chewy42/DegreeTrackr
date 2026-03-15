// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AuthForm from './AuthForm'

// Stub AuthContext — AuthForm only imports AuthMode as a type annotation,
// but the module still loads at runtime, so provide a safe stub.
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: null }),
}))

describe('AuthForm', () => {
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

  function baseProps(overrides: Partial<React.ComponentProps<typeof AuthForm>> = {}): React.ComponentProps<typeof AuthForm> {
    return {
      mode: 'sign_in',
      email: '',
      password: '',
      confirmPassword: '',
      error: null,
      loading: false,
      setField: vi.fn(),
      onSubmit: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

  async function render(props = baseProps()) {
    await act(async () => {
      root.render(<AuthForm {...props} />)
    })
  }

  it('renders a form element', async () => {
    await render()
    expect(container.querySelector('form')).not.toBeNull()
  })

  it('renders email and password inputs in sign_in mode', async () => {
    await render()
    // TextField uses type="text" with inputMode="email" for email fields
    const inputs = container.querySelectorAll('input')
    expect(inputs.length).toBe(2)
  })

  it('renders a confirm password field in sign_up mode', async () => {
    await render(baseProps({ mode: 'sign_up' }))
    expect(container.querySelectorAll('input').length).toBe(3)
  })

  it('does not render confirm password in sign_in mode', async () => {
    await render()
    expect(container.querySelectorAll('input').length).toBe(2)
  })

  it('calls onSubmit when the form is submitted', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    await render(baseProps({ onSubmit }))
    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('disables the submit button when loading=true', async () => {
    await render(baseProps({ loading: true }))
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.disabled).toBe(true)
  })

  it('shows "Please wait..." on the submit button while loading', async () => {
    await render(baseProps({ loading: true }))
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.textContent).toContain('Please wait')
  })

  it('enables the submit button when not loading', async () => {
    await render()
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.disabled).toBe(false)
  })

  it('shows "Sign In" label on the submit button in sign_in mode', async () => {
    await render()
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.textContent).toContain('Sign In')
  })

  it('shows "Create Account" label on the submit button in sign_up mode', async () => {
    await render(baseProps({ mode: 'sign_up' }))
    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.textContent).toContain('Create Account')
  })

  it('displays the error message with role="alert" when error is set', async () => {
    await render(baseProps({ error: 'Invalid credentials' }))
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toContain('Invalid credentials')
  })

  it('does not render an alert when error is null', async () => {
    await render()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})
