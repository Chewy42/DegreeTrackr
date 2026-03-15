// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ConvexErrorBoundary from './ConvexErrorBoundary'

function ThrowingChild(): React.ReactNode {
  throw new Error('simulated convex connection error')
}

describe('ConvexErrorBoundary', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
    vi.restoreAllMocks()
  })

  it('renders children normally when no error occurs', async () => {
    await act(async () => {
      root.render(
        <ConvexErrorBoundary>
          <span data-testid="child">connected</span>
        </ConvexErrorBoundary>
      )
    })
    expect(container.textContent).toContain('connected')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('shows connection error fallback when a child throws', async () => {
    await act(async () => {
      root.render(
        <ConvexErrorBoundary>
          <ThrowingChild />
        </ConvexErrorBoundary>
      )
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('Could not connect to the server')
    expect(container.textContent).toContain('internet connection')
  })

  it('fallback includes a Reload button', async () => {
    await act(async () => {
      root.render(
        <ConvexErrorBoundary>
          <ThrowingChild />
        </ConvexErrorBoundary>
      )
    })
    const buttons = Array.from(container.querySelectorAll('button'))
    const reload = buttons.find(b => b.textContent?.trim() === 'Reload')
    expect(reload).not.toBeUndefined()
  })
})
