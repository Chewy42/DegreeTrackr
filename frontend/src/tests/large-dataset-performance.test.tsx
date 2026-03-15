// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ExploreClassesSidebar from '../components/ExploreClassesSidebar'

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

const DEPARTMENTS = ['CPSC', 'MATH', 'PHYS', 'ENGL', 'CHEM', 'BIOL', 'HIST', 'ECON']

function makeCourse(n: number) {
  const dept = DEPARTMENTS[n % DEPARTMENTS.length]
  return {
    subject: dept,
    number: String(100 + n),
    title: `${dept} Course ${n}`,
    term: n % 2 === 0 ? 'Spring 2026' : 'Fall 2026',
  }
}

function makePayload(courses: unknown[]) {
  return {
    parsed_data: {
      courses: { in_progress: courses },
    },
  }
}

function generate200Courses() {
  return Array.from({ length: 200 }, (_, i) => makeCourse(i + 1))
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

function countCards(container: HTMLDivElement): number {
  return container.querySelectorAll('.rounded-xl.border').length
}

function findShowMore(container: HTMLDivElement): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(b =>
    b.textContent?.includes('Show more'),
  ) as HTMLButtonElement | undefined
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ExploreClassesSidebar — large dataset (200 courses)', () => {
  let container: HTMLDivElement
  let root: Root
  const courses200 = generate200Courses()

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.getConvexClient.mockReturnValue({ query: mocks.queryFn })
    mocks.queryFn.mockResolvedValue(makePayload(courses200))
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render() {
    await act(async () => { root.render(<ExploreClassesSidebar />) })
    await act(async () => {})
  }

  // ── Render performance ──────────────────────────────────────────────────

  it('renders 200-course dataset in under 1000ms', async () => {
    const t0 = performance.now()
    await render()
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(1000)
    // Sanity: cards are present
    expect(countCards(container)).toBeGreaterThan(0)
  })

  // ── Render cap: only 50 shown initially ─────────────────────────────────

  it('caps initial render to 50 cards out of 200', async () => {
    await render()

    expect(countCards(container)).toBe(50)

    const btn = findShowMore(container)
    expect(btn).toBeDefined()
    expect(btn!.textContent).toContain('150 remaining')
  })

  // ── Show more: 50 → 100 → 150 → 200 ───────────────────────────────────

  it('progressively reveals cards via "Show more" (50 → 100 → 150 → 200)', async () => {
    await render()
    expect(countCards(container)).toBe(50)

    // Click 1: 50 → 100
    await act(async () => { findShowMore(container)!.click() })
    expect(countCards(container)).toBe(100)
    expect(findShowMore(container)!.textContent).toContain('100 remaining')

    // Click 2: 100 → 150
    await act(async () => { findShowMore(container)!.click() })
    expect(countCards(container)).toBe(150)
    expect(findShowMore(container)!.textContent).toContain('50 remaining')

    // Click 3: 150 → 200
    await act(async () => { findShowMore(container)!.click() })
    expect(countCards(container)).toBe(200)
    expect(findShowMore(container)).toBeUndefined()
  })

  // ── Search filter on large list ─────────────────────────────────────────

  it('filters 200-item list correctly by department', async () => {
    await render()

    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!

    // Filter to MATH courses (every 8th course starting at index 2: n%8===1 → MATH)
    await typeIntoSearch(input, 'MATH')

    const cards = countCards(container)
    // 200/8 = 25 MATH courses
    expect(cards).toBe(25)

    // All visible cards should contain MATH
    const cardEls = container.querySelectorAll('.rounded-xl.border')
    for (const card of cardEls) {
      expect(card.textContent).toContain('MATH')
    }
  })

  it('filters respond quickly on 200-item list (< 200ms)', async () => {
    await render()

    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!

    const t0 = performance.now()
    await typeIntoSearch(input, 'PHYS')
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(200)
    expect(countCards(container)).toBeGreaterThan(0)
  })

  it('search resets display limit and filters across all 200 courses', async () => {
    await render()

    // Expand to 100 first
    await act(async () => { findShowMore(container)!.click() })
    expect(countCards(container)).toBe(100)

    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!

    // Search should reset displayLimit to 50 and filter all 200 items
    await typeIntoSearch(input, 'CPSC')

    // 200/8 = 25 CPSC courses — all fit within the 50 cap
    expect(countCards(container)).toBe(25)

    // Clear search — should reset to 50 cap
    await typeIntoSearch(input, '')
    expect(countCards(container)).toBe(50)
  })
})
