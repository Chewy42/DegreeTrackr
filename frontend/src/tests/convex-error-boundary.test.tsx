// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

// Component that throws on demand
function Thrower({ shouldThrow, message }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) throw new Error(message ?? 'test error')
  return <div>Child content works</div>
}

describe('ConvexErrorBoundary — DT189', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const originalReload = window.location.reload

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    // Suppress console.error from error boundary
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Mock reload
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: vi.fn() },
      writable: true,
    })
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: originalReload },
      writable: true,
    })
  })

  it('renders children normally when no error', async () => {
    const { default: ConvexErrorBoundary } = await import('../components/ConvexErrorBoundary')
    await act(async () => {
      root.render(
        <ConvexErrorBoundary>
          <Thrower shouldThrow={false} />
        </ConvexErrorBoundary>
      )
    })
    expect(container.textContent).toContain('Child content works')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('catches error and shows friendly error message', async () => {
    const { default: ConvexErrorBoundary } = await import('../components/ConvexErrorBoundary')
    await act(async () => {
      root.render(
        <ConvexErrorBoundary>
          <Thrower shouldThrow={true} />
        </ConvexErrorBoundary>
      )
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('Could not connect to the server')
    expect(container.textContent).not.toContain('Child content works')
  })

  it('reload button calls window.location.reload', async () => {
    const { default: ConvexErrorBoundary } = await import('../components/ConvexErrorBoundary')
    await act(async () => {
      root.render(
        <ConvexErrorBoundary>
          <Thrower shouldThrow={true} />
        </ConvexErrorBoundary>
      )
    })
    const button = container.querySelector('button')
    expect(button).not.toBeNull()
    expect(button!.textContent).toContain('Reload')
    await act(async () => { button!.click() })
    expect(window.location.reload).toHaveBeenCalled()
  })

  it('catches any error type and shows the same fallback UI', async () => {
    const { default: ConvexErrorBoundary } = await import('../components/ConvexErrorBoundary')
    // TypeError
    function TypeErrorThrower() {
      throw new TypeError('type error')
    }
    await act(async () => {
      root.render(
        <ConvexErrorBoundary>
          <TypeErrorThrower />
        </ConvexErrorBoundary>
      )
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('check your internet connection')
    expect(container.textContent).toContain('Reload')
  })
})
