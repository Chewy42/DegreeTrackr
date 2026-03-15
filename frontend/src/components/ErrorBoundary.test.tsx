// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './ErrorBoundary'

function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('test render error')
  return <span data-testid="child">child content</span>
}

describe('ErrorBoundary', () => {
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
        <ErrorBoundary>
          <span>hello world</span>
        </ErrorBoundary>
      )
    })
    expect(container.textContent).toContain('hello world')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('shows fallback UI when a child throws during render', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      )
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('Something went wrong')
  })

  it('fallback UI contains a "Try Again" recovery CTA', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      )
    })
    const buttons = Array.from(container.querySelectorAll('button'))
    const tryAgain = buttons.find((b) => b.textContent?.trim() === 'Try Again')
    expect(tryAgain).not.toBeUndefined()
  })

  it('key prop change resets the boundary and re-renders the child', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary key="a">
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>
      )
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()

    // Changing the key unmounts + remounts a fresh ErrorBoundary with reset state
    await act(async () => {
      root.render(
        <ErrorBoundary key="b">
          <ThrowingChild shouldThrow={false} />
        </ErrorBoundary>
      )
    })
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[data-testid="child"]')).not.toBeNull()
    expect(container.textContent).toContain('child content')
  })

  it('componentDidCatch calls console.error (suppressed by spy)', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      )
    })
    expect(console.error).toHaveBeenCalled()
  })
})
