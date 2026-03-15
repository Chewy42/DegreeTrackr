// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

// ── Test suite ───────────────────────────────────────────────────────────────

describe('WarningModal', () => {
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

  async function render(props: {
    isOpen: boolean
    onClose: () => void
    warnings: string[]
  }) {
    const { default: WarningModal } = await import('./WarningModal')
    await act(async () => {
      root.render(<WarningModal {...props} />)
    })
  }

  it('renders warning message text correctly', async () => {
    const onClose = vi.fn()
    await render({
      isOpen: true,
      onClose,
      warnings: ['Time conflict between CS 101 and MATH 201', 'Exceeds 18 credit limit'],
    })

    expect(container.textContent).toContain('Time conflict between CS 101 and MATH 201')
    expect(container.textContent).toContain('Exceeds 18 credit limit')
  })

  it('"Close" button fires onClose callback', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, warnings: ['Some warning'] })

    // Find the "Close" text button in the footer
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    const closeTextBtn = buttons.find((btn) => btn.textContent?.trim() === 'Close')
    expect(closeTextBtn).toBeDefined()

    await act(async () => { closeTextBtn!.click() })
    expect(onClose).toHaveBeenCalled()
  })

  it('close icon button fires onClose', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, warnings: ['Warning'] })

    const iconBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    expect(iconBtn).not.toBeNull()

    await act(async () => { iconBtn!.click() })
    expect(onClose).toHaveBeenCalled()
  })

  it('renders title "Schedule Warnings"', async () => {
    await render({ isOpen: true, onClose: vi.fn(), warnings: ['Test warning'] })
    expect(container.textContent).toContain('Schedule Warnings')
  })

  it('returns null when isOpen is false', async () => {
    await render({ isOpen: false, onClose: vi.fn(), warnings: ['Hidden warning'] })
    expect(container.innerHTML).toBe('')
  })

  it('shows empty state when warnings array is empty', async () => {
    await render({ isOpen: true, onClose: vi.fn(), warnings: [] })
    expect(container.textContent).toContain('No warnings to display')
  })

  it('clicking backdrop fires onClose', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, warnings: ['Backdrop test'] })

    // The outermost div is the backdrop
    const backdrop = container.firstElementChild as HTMLDivElement
    await act(async () => { backdrop.click() })
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking dialog content does NOT fire onClose (stopPropagation)', async () => {
    const onClose = vi.fn()
    await render({ isOpen: true, onClose, warnings: ['Click test'] })

    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]')!
    await act(async () => { dialog.click() })
    expect(onClose).not.toHaveBeenCalled()
  })
})
