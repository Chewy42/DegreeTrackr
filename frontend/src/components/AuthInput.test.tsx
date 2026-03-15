// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import AuthInput from './AuthInput'

describe('AuthInput', () => {
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

  async function render(props: React.ComponentProps<typeof AuthInput>) {
    await act(async () => {
      root.render(<AuthInput {...props} />)
    })
  }

  it('renders a label with the provided text', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn() })
    expect(container.textContent).toContain('Email')
    expect(container.querySelector('label')).not.toBeNull()
  })

  it('renders an input with the provided value', async () => {
    await render({ label: 'Email', value: 'user@example.com', onChange: vi.fn() })
    const input = container.querySelector('input')!
    expect(input.value).toBe('user@example.com')
  })

  it('defaults to type="email"', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn() })
    expect(container.querySelector('input')!.type).toBe('email')
  })

  it('uses type="password" when specified', async () => {
    await render({ label: 'Password', type: 'password', value: '', onChange: vi.fn() })
    expect(container.querySelector('input')!.type).toBe('password')
  })

  it('calls onChange with the new value when input changes', async () => {
    const onChange = vi.fn()
    await render({ label: 'Email', value: '', onChange })
    const input = container.querySelector('input')!
    await act(async () => {
      Object.defineProperty(input, 'value', { writable: true, value: 'new@example.com' })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('new@example.com')
  })

  it('renders placeholder text', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn(), placeholder: 'you@example.com' })
    expect(container.querySelector('input')!.placeholder).toBe('you@example.com')
  })

  it('renders icon when provided', async () => {
    await render({
      label: 'Email',
      value: '',
      onChange: vi.fn(),
      icon: <span data-testid="icon">✉</span>,
    })
    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull()
  })

  it('does not render icon area when icon is not provided', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn() })
    expect(container.querySelector('[aria-hidden]')).toBeNull()
  })

  it('generates inputId from label (lowercased, spaces → dashes)', async () => {
    await render({ label: 'Full Name', value: '', onChange: vi.fn() })
    const input = container.querySelector('input')!
    expect(input.id).toBe('full-name')
    const label = container.querySelector('label')!
    expect(label.getAttribute('for')).toBe('full-name')
  })

  it('uses name prop as inputId when provided', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn(), name: 'user-email' })
    expect(container.querySelector('input')!.id).toBe('user-email')
  })

  it('sets required attribute by default', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn() })
    expect(container.querySelector('input')!.required).toBe(true)
  })

  it('does not set required when required=false', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn(), required: false })
    expect(container.querySelector('input')!.required).toBe(false)
  })
})
