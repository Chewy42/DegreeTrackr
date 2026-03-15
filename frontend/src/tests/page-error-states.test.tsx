// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

// ---- DT182: Error states across pages ----

describe('Page error states — DT182', () => {
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
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('ProgressPage with error shows error fallback state', async () => {
    // Mock auth
    vi.doMock('../auth/AuthContext', () => ({
      useAuth: () => ({ jwt: 'test-jwt', preferences: { hasProgramEvaluation: false } }),
    }))
    // Mock convex to throw
    vi.doMock('../lib/convex', () => ({
      convexApi: { evaluations: { getCurrentProgramEvaluation: 'mock' } },
      getConvexClient: () => ({
        query: () => Promise.reject(new Error('Network failure')),
      }),
      syncCurrentProgramEvaluationFromLegacy: vi.fn(),
    }))
    // Mock hooks
    vi.doMock('../../hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }))
    vi.doMock('../hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }))

    const { default: ProgressPage } = await import('../components/progress/ProgressPage')
    await act(async () => { root.render(<ProgressPage />) })
    // Wait for async fetch to settle
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    expect(container.textContent).toContain('Error Loading Progress')
    expect(container.textContent).toContain('Network failure')

    vi.doUnmock('../auth/AuthContext')
    vi.doUnmock('../lib/convex')
    vi.doUnmock('../../hooks/usePageTitle')
    vi.doUnmock('../hooks/usePageTitle')
  })

  it('ProgressPage error state has Retry button that re-triggers fetch', async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error('Server error'))
    vi.doMock('../auth/AuthContext', () => ({
      useAuth: () => ({ jwt: 'test-jwt', preferences: { hasProgramEvaluation: false } }),
    }))
    vi.doMock('../lib/convex', () => ({
      convexApi: { evaluations: { getCurrentProgramEvaluation: 'mock' } },
      getConvexClient: () => ({ query: queryFn }),
      syncCurrentProgramEvaluationFromLegacy: vi.fn(),
    }))
    vi.doMock('../hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }))

    const { default: ProgressPage } = await import('../components/progress/ProgressPage')
    await act(async () => { root.render(<ProgressPage />) })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    const initialCount = queryFn.mock.calls.length
    const retryBtn = container.querySelector<HTMLButtonElement>('button')
    expect(retryBtn).not.toBeNull()
    expect(retryBtn!.textContent).toContain('Retry')

    await act(async () => { retryBtn!.click() })
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })

    expect(queryFn.mock.calls.length).toBeGreaterThan(initialCount)

    vi.doUnmock('../auth/AuthContext')
    vi.doUnmock('../lib/convex')
    vi.doUnmock('../hooks/usePageTitle')
  })

  it('ErrorBoundary catches unexpected throw and shows "Something went wrong"', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { default: ErrorBoundary } = await import('../components/ErrorBoundary')

    function BrokenComponent(): React.ReactElement {
      throw new Error('Kaboom')
    }

    await act(async () => {
      root.render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>,
      )
    })

    expect(container.textContent).toContain('Something went wrong')
    spy.mockRestore()
  })

  it('ErrorBoundary error state has "Try Again" button', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { default: ErrorBoundary } = await import('../components/ErrorBoundary')

    function BrokenComponent(): React.ReactElement {
      throw new Error('Boom')
    }

    await act(async () => {
      root.render(
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>,
      )
    })

    const tryAgainBtn = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('Try Again'),
    )
    expect(tryAgainBtn).toBeDefined()
    spy.mockRestore()
  })
})
