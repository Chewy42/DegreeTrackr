// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import EmailConfirmationNotice from './EmailConfirmationNotice'

describe('EmailConfirmationNotice', () => {
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

  async function render(props: React.ComponentProps<typeof EmailConfirmationNotice>) {
    await act(async () => {
      root.render(<EmailConfirmationNotice {...props} />)
    })
  }

  it('displays the provided email address', async () => {
    await render({ email: 'user@example.com', onResend: vi.fn(), onBack: vi.fn() })
    expect(container.textContent).toContain('user@example.com')
  })

  it('renders the resend button with initial label', async () => {
    await render({ email: 'a@b.com', onResend: vi.fn(), onBack: vi.fn() })
    const btn = container.querySelector('button[type="submit"]')!
    expect(btn.textContent).toContain('Resend confirmation email')
  })

  it('calls onResend when resend button is clicked', async () => {
    const onResend = vi.fn().mockResolvedValue(undefined)
    await render({ email: 'a@b.com', onResend, onBack: vi.fn() })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    })
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it('shows loading state while resend is in flight', async () => {
    let resolve!: () => void
    const onResend = vi.fn().mockReturnValue(
      new Promise<void>((res) => { resolve = res })
    )
    await render({ email: 'a@b.com', onResend, onBack: vi.fn() })

    act(() => { container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click() })
    await act(async () => {})

    const btn = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.textContent).toContain('Please wait')

    await act(async () => { resolve() })
  })

  it('disables the submit button while sending', async () => {
    let resolve!: () => void
    const onResend = vi.fn().mockReturnValue(
      new Promise<void>((res) => { resolve = res })
    )
    await render({ email: 'a@b.com', onResend, onBack: vi.fn() })

    act(() => { container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click() })
    await act(async () => {})

    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true)

    await act(async () => { resolve() })
  })

  it('shows success confirmation after resend completes', async () => {
    const onResend = vi.fn().mockResolvedValue(undefined)
    await render({ email: 'a@b.com', onResend, onBack: vi.fn() })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    })
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Confirmation email sent.')
  })

  it('updates resend button label to "Email sent" after success', async () => {
    const onResend = vi.fn().mockResolvedValue(undefined)
    await render({ email: 'a@b.com', onResend, onBack: vi.fn() })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    })
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.textContent).toContain('Email sent')
  })

  it('shows error alert when resend fails', async () => {
    const onResend = vi.fn().mockRejectedValue(new Error('Network error'))
    await render({ email: 'a@b.com', onResend, onBack: vi.fn() })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    })
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert!.textContent).toBe('Network error')
  })

  it('shows a generic error message when a non-Error is thrown', async () => {
    const onResend = vi.fn().mockRejectedValue('plain string error')
    await render({ email: 'a@b.com', onResend, onBack: vi.fn() })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Unable to resend email.')
  })

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn()
    await render({ email: 'a@b.com', onResend: vi.fn().mockResolvedValue(undefined), onBack })
    const buttons = Array.from(container.querySelectorAll('button'))
    const backBtn = buttons.find(b => b.textContent?.includes('Back to sign in'))!
    await act(async () => { backBtn.click() })
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders the "Confirm your email" heading', async () => {
    await render({ email: 'a@b.com', onResend: vi.fn(), onBack: vi.fn() })
    expect(container.querySelector('h1')?.textContent).toContain('Confirm your email')
  })
})
