// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

describe('AuthForm — DT179', () => {
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

  const defaults = {
    mode: 'sign_in' as const,
    email: '',
    password: '',
    confirmPassword: '',
    error: null as string | null,
    loading: false,
    setField: vi.fn(),
    onSubmit: vi.fn(async (e: React.FormEvent) => { e.preventDefault() }),
  }

  async function render(overrides: Partial<typeof defaults> = {}) {
    const { default: AuthForm } = await import('../components/AuthForm')
    const props = { ...defaults, ...overrides }
    await act(async () => { root.render(<AuthForm {...props} />) })
    return props
  }

  it('renders email and password fields', async () => {
    await render()
    const labels = Array.from(container.querySelectorAll('label'))
    const labelTexts = labels.map(l => l.textContent)
    expect(labelTexts).toContain('Email')
    expect(labelTexts).toContain('Password')
  })

  it('displays error message when error prop is set (e.g. invalid email)', async () => {
    await render({ error: 'Invalid email format' })
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert!.textContent).toBe('Invalid email format')
  })

  it('displays password-too-short error via error prop', async () => {
    await render({ error: 'Password too short' })
    const alert = container.querySelector('[role="alert"]')
    expect(alert!.textContent).toBe('Password too short')
  })

  it('submitting form calls onSubmit handler', async () => {
    const onSubmit = vi.fn(async (e: React.FormEvent) => { e.preventDefault() })
    await render({ email: 'user@test.edu', password: 'strongpass1', onSubmit })

    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(onSubmit).toHaveBeenCalled()
  })
})
