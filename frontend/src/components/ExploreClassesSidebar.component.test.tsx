// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ExploreClassesSidebar from './ExploreClassesSidebar'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  queryFn: vi.fn(),
  getConvexClient: vi.fn(),
}))

vi.mock('../lib/convex', () => ({
  convexApi: {
    evaluations: {
      getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation',
    },
  },
  getConvexClient: mocks.getConvexClient,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    preferences: { hasProgramEvaluation: true },
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(courses: unknown[]) {
  return {
    parsed_data: {
      courses: { in_progress: courses },
    },
  }
}

function makeCourse(n: number) {
  return {
    subject: 'CPSC',
    number: String(100 + n),
    title: `Course ${n}`,
    term: 'Spring 2026',
  }
}

const nativeSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  'value',
)?.set

async function typeIntoSearch(input: HTMLInputElement, value: string) {
  await act(async () => {
    nativeSetter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ExploreClassesSidebar (component render)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.getConvexClient.mockReturnValue({ query: mocks.queryFn })
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render() {
    await act(async () => { root.render(<ExploreClassesSidebar />) })
    // Flush the async fetch triggered by useEffect
    await act(async () => {})
  }

  function getSearchInput(): HTMLInputElement {
    return container.querySelector<HTMLInputElement>('input[type="text"]')!
  }

  // ── Empty DB ──────────────────────────────────────────────────────────────

  it('shows empty state when Convex returns no in-progress courses', async () => {
    mocks.queryFn.mockResolvedValue(makePayload([]))
    await render()

    const statusNodes = container.querySelectorAll('[role="status"]')
    const text = Array.from(statusNodes)
      .map((n) => n.textContent)
      .join(' ')
    expect(text).toContain('No in-progress courses were found')
  })

  // ── One result ────────────────────────────────────────────────────────────

  it('renders a single class card when query returns one course', async () => {
    mocks.queryFn.mockResolvedValue(makePayload([makeCourse(1)]))
    await render()

    expect(container.textContent).toContain('CPSC 101')
    expect(container.textContent).toContain('Course 1')
  })

  // ── Many results ──────────────────────────────────────────────────────────

  it('renders all 10 class cards when query returns 10 courses', async () => {
    const courses = Array.from({ length: 10 }, (_, i) => makeCourse(i + 1))
    mocks.queryFn.mockResolvedValue(makePayload(courses))
    await render()

    for (let i = 1; i <= 10; i++) {
      expect(container.textContent).toContain(`CPSC ${100 + i}`)
    }
  })

  // ── Debounced search ──────────────────────────────────────────────────────
  // The component fetches data once on mount via Convex; client-side useMemo
  // filtering handles all subsequent keystrokes with no additional queries.

  it('fires the Convex query exactly once on mount regardless of rapid typing', async () => {
    vi.useFakeTimers()

    mocks.queryFn.mockResolvedValue(makePayload([makeCourse(1)]))

    await act(async () => { root.render(<ExploreClassesSidebar />) })
    // Flush the mount fetch (fake timers: drain microtasks manually)
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })

    const callsAfterMount = mocks.queryFn.mock.calls.length

    const input = getSearchInput()

    // Simulate rapid keystrokes — C, P, S, C in quick succession
    for (const char of ['C', 'CP', 'CPS', 'CPSC']) {
      await act(async () => {
        nativeSetter?.call(input, char)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }

    // Drain all pending timers
    await act(async () => { vi.runAllTimers() })
    await act(async () => {})

    // Convex query must not have been called again
    expect(mocks.queryFn.mock.calls.length).toBe(callsAfterMount)

    vi.useRealTimers()
  })

  // ── Search clears ─────────────────────────────────────────────────────────

  it('resets to full results when the search input is cleared', async () => {
    const courses = [makeCourse(1), makeCourse(2), makeCourse(3)]
    mocks.queryFn.mockResolvedValue(makePayload(courses))
    await render()

    // Verify all 3 are shown initially
    expect(container.textContent).toContain('CPSC 101')
    expect(container.textContent).toContain('CPSC 102')
    expect(container.textContent).toContain('CPSC 103')

    const input = getSearchInput()

    // Filter to a single course
    await typeIntoSearch(input, 'CPSC 101')

    expect(container.textContent).toContain('CPSC 101')
    expect(container.textContent).not.toContain('CPSC 102')
    expect(container.textContent).not.toContain('CPSC 103')

    // Clear the search — full list should return
    await typeIntoSearch(input, '')

    expect(container.textContent).toContain('CPSC 101')
    expect(container.textContent).toContain('CPSC 102')
    expect(container.textContent).toContain('CPSC 103')
  })

  // ── No-match state ────────────────────────────────────────────────────────

  it('shows "No matching classes found" when the search query matches nothing', async () => {
    mocks.queryFn.mockResolvedValue(makePayload([makeCourse(1)]))
    await render()

    const input = getSearchInput()
    await typeIntoSearch(input, 'PHYS 999 nonexistent')

    const statusNodes = container.querySelectorAll('[role="status"]')
    const text = Array.from(statusNodes)
      .map((n) => n.textContent)
      .join(' ')
    expect(text).toContain('No matching classes found')
  })

  // ── DT69 render cap ────────────────────────────────────────────────────────

  it('renders at most 50 class cards initially when given 100+ items', async () => {
    const courses = Array.from({ length: 100 }, (_, i) => makeCourse(i + 1))
    mocks.queryFn.mockResolvedValue(makePayload(courses))
    await render()

    // Count rendered class cards (each card contains a FiBookOpen icon with the code)
    const cards = container.querySelectorAll('.rounded-xl.border')
    expect(cards.length).toBe(50)

    // "Show more" button should be visible
    const showMoreBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Show more')
    )
    expect(showMoreBtn).toBeDefined()
    expect(showMoreBtn!.textContent).toContain('50 remaining')
  })

  it('"Show more" reveals the next batch of 50 classes', async () => {
    const courses = Array.from({ length: 100 }, (_, i) => makeCourse(i + 1))
    mocks.queryFn.mockResolvedValue(makePayload(courses))
    await render()

    // Click "Show more"
    const showMoreBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Show more')
    )!
    await act(async () => { showMoreBtn.click() })

    // All 100 should now be rendered
    const cards = container.querySelectorAll('.rounded-xl.border')
    expect(cards.length).toBe(100)

    // "Show more" should be gone
    const showMoreAfter = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Show more')
    )
    expect(showMoreAfter).toBeUndefined()
  })
})
