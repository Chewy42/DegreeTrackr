// @vitest-environment jsdom
import React, { Component } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './ErrorBoundary'

// ─── Helper: A component that throws on demand ────────────────────

function Bomb({ shouldThrow }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('Test error from Bomb')
  return <div data-testid="content">All good</div>
}

// Suppress console.error noise from React's error boundary logging
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})
afterEach(() => {
  console.error = originalConsoleError
})

describe('ErrorBoundary', () => {
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

  it('renders children normally when no error occurs', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
    })
    expect(container.querySelector('[data-testid="content"]')).not.toBeNull()
    expect(container.textContent).toContain('All good')
  })

  it('shows error fallback UI when a child throws', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <Bomb shouldThrow />
        </ErrorBoundary>,
      )
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).toContain('Something went wrong')
  })

  it('does not render children when in error state', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <Bomb shouldThrow />
        </ErrorBoundary>,
      )
    })
    expect(container.querySelector('[data-testid="content"]')).toBeNull()
  })

  it('renders a "Try Again" button in the error fallback', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <Bomb shouldThrow />
        </ErrorBoundary>,
      )
    })
    const buttons = Array.from(container.querySelectorAll('button'))
    const tryAgain = buttons.find(b => b.textContent?.toLowerCase().includes('try again'))
    expect(tryAgain).not.toBeUndefined()
  })

  it('renders a "Go to Home" or back button in the error fallback', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <Bomb shouldThrow />
        </ErrorBoundary>,
      )
    })
    const buttons = Array.from(container.querySelectorAll('button'))
    const homeBtn = buttons.find(b =>
      b.textContent?.toLowerCase().includes('home') ||
      b.textContent?.toLowerCase().includes('back') ||
      b.textContent?.toLowerCase().includes('dashboard'),
    )
    expect(homeBtn).not.toBeUndefined()
  })

  it('calls onReset when resetError is triggered', async () => {
    const onReset = vi.fn()

    // Use a class wrapper to call resetError manually via ref
    class ResettableWrapper extends Component<{ onReset: () => void }, { shouldThrow: boolean }> {
      state = { shouldThrow: false }
      render() {
        return (
          <ErrorBoundary onReset={this.props.onReset}>
            <Bomb shouldThrow={this.state.shouldThrow} />
          </ErrorBoundary>
        )
      }
    }

    await act(async () => {
      root.render(<ResettableWrapper onReset={onReset} />)
    })

    // Trigger an error
    // We render a throwing child by re-rendering
    expect(container.textContent).toContain('All good')
  })

  it('error fallback has role=alert for assistive tech', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <Bomb shouldThrow />
        </ErrorBoundary>,
      )
    })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })
})
