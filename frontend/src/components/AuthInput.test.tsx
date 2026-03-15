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

  it('renders the label text', async () => {
    await render({ label: 'Email Address', value: '', onChange: vi.fn() })
    expect(container.querySelector('label')?.textContent).toContain('Email Address')
  })

  it('links the label to the input via htmlFor / id', async () => {
    await render({ label: 'Email Address', value: '', onChange: vi.fn() })
    const labelFor = container.querySelector('label')?.getAttribute('for')
    const inputId = container.querySelector('input')?.id
    expect(labelFor).toBe(inputId)
    expect(inputId).toBeTruthy()
  })

  it('derives the id from the label when name is omitted', async () => {
    await render({ label: 'Email Address', value: '', onChange: vi.fn() })
    expect(container.querySelector('input')?.id).toBe('email-address')
  })

  it('uses the name prop as the input id when provided', async () => {
    await render({ label: 'Email Address', name: 'user-email', value: '', onChange: vi.fn() })
    expect(container.querySelector('input')?.id).toBe('user-email')
  })

  it('reflects the current value', async () => {
    await render({ label: 'Email', value: 'test@example.com', onChange: vi.fn() })
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('test@example.com')
  })

  it('calls onChange with the new value when the user types', async () => {
    const onChange = vi.fn()
    await render({ label: 'Email', value: '', onChange })
    const input = container.querySelector<HTMLInputElement>('input')!
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      nativeSetter?.call(input, 'typed@example.com')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('typed@example.com')
  })

  it('marks the input as required by default', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn() })
    expect(container.querySelector('input')?.required).toBe(true)
  })

  it('marks the input as not required when required=false', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn(), required: false })
    expect(container.querySelector('input')?.required).toBe(false)
  })

  it('defaults to email input type', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn() })
    expect(container.querySelector('input')?.type).toBe('email')
  })

  it('renders password type when type="password"', async () => {
    await render({ label: 'Password', value: '', onChange: vi.fn(), type: 'password' })
    expect(container.querySelector('input')?.type).toBe('password')
  })

  it('renders the icon when provided', async () => {
    await render({
      label: 'Email',
      value: '',
      onChange: vi.fn(),
      icon: <span data-testid="icon">@</span>,
    })
    expect(container.querySelector('[data-testid="icon"]')).not.toBeNull()
  })

  it('does not render an icon wrapper when icon is omitted', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn() })
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})
