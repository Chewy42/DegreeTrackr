// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import TextField from './TextField'

describe('TextField', () => {
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

  function getInput() {
    return container.querySelector<HTMLInputElement>('input')!
  }

  async function render(props: React.ComponentProps<typeof TextField>) {
    await act(async () => {
      root.render(<TextField {...props} />)
    })
  }

  it('renders the label text', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn() })
    expect(container.textContent).toContain('Email')
  })

  it('renders the input with the given value', async () => {
    await render({ label: 'Name', value: 'Alice', onChange: vi.fn() })
    expect(getInput().value).toBe('Alice')
  })

  it('calls onChange with the new value when the user types', async () => {
    const onChange = vi.fn()
    await render({ label: 'Name', value: '', onChange })
    const input = getInput()
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      nativeSetter?.call(input, 'Bob')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('Bob')
  })

  it('shows the required asterisk (*) when required is true', async () => {
    await render({ label: 'Password', value: '', onChange: vi.fn(), required: true })
    // The asterisk span has class text-danger
    const asterisk = container.querySelector('span.text-danger')
    expect(asterisk).not.toBeNull()
    expect(asterisk!.textContent).toBe('*')
  })

  it('does not show the required asterisk when required is not set', async () => {
    await render({ label: 'Password', value: '', onChange: vi.fn() })
    expect(container.querySelector('span.text-danger')).toBeNull()
  })

  it('renders leftIcon when provided', async () => {
    await render({
      label: 'Search',
      value: '',
      onChange: vi.fn(),
      leftIcon: <span data-testid="test-icon">🔍</span>,
    })
    expect(container.querySelector('[data-testid="test-icon"]')).not.toBeNull()
  })

  it('does not render an icon wrapper when leftIcon is omitted', async () => {
    await render({ label: 'Search', value: '', onChange: vi.fn() })
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('uses type=text and inputMode=email for email type', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn(), type: 'email' })
    const input = getInput()
    expect(input.getAttribute('type')).toBe('text')
    expect(input.getAttribute('inputmode')).toBe('email')
  })

  it('uses type=password for password type', async () => {
    await render({ label: 'Password', value: '', onChange: vi.fn(), type: 'password' })
    expect(getInput().getAttribute('type')).toBe('password')
  })

  it('passes required attribute to the underlying input', async () => {
    await render({ label: 'Email', value: '', onChange: vi.fn(), required: true })
    expect(getInput().required).toBe(true)
  })
})
