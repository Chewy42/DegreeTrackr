// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ProgramEvaluationViewer from './ProgramEvaluationViewer'

const PARSED_DATA = {
  email: 'student@example.com',
  uploaded_at: '2025-03-01T10:00:00.000Z',
  original_filename: 'my-eval.pdf',
  parsed_data: {},
}

const mocks = vi.hoisted(() => ({
  queryFn: vi.fn(),
  actionFn: vi.fn(),
  getConvexClient: vi.fn(),
  syncCurrentProgramEvaluationFromLegacy: vi.fn(),
}))

vi.mock('../lib/convex', () => ({
  convexApi: {
    evaluations: {
      getCurrentProgramEvaluation: 'evaluations:getCurrentProgramEvaluation',
      hydrateCurrentProgramEvaluationFromLegacy:
        'evaluations:hydrateCurrentProgramEvaluationFromLegacy',
    },
  },
  getConvexClient: mocks.getConvexClient,
  buildLegacyProgramEvaluationPreviewUrl: (jwt: string) =>
    `http://preview?token=${jwt}`,
  syncCurrentProgramEvaluationFromLegacy:
    mocks.syncCurrentProgramEvaluationFromLegacy,
}))

vi.mock('../lib/convex/legacyBoundary', () => {
  class LegacyBoundaryError extends Error {
    statusCode?: number
    constructor(message: string, statusCode?: number) {
      super(message)
      this.name = 'LegacyBoundaryError'
      this.statusCode = statusCode
    }
  }
  return { LegacyBoundaryError }
})

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: 'test-jwt',
    preferences: { hasProgramEvaluation: true },
  }),
}))

// Stub the nested upload form so it doesn't need its own deps
vi.mock('./ProgramEvaluationUpload', () => ({
  default: () =>
    React.createElement('div', { 'data-testid': 'upload-stub' }),
}))

describe('ProgramEvaluationViewer', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.getConvexClient.mockReturnValue({
      query: mocks.queryFn,
      action: mocks.actionFn,
    })
    mocks.queryFn.mockResolvedValue(PARSED_DATA)
    // jsdom does not implement URL blob methods
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  async function render() {
    await act(async () => {
      root.render(<ProgramEvaluationViewer />)
    })
    // Flush pending promises from initial fetch
    await act(async () => {})
  }

  function getButton(text: string): HTMLButtonElement | undefined {
    return Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find(b => b.textContent?.trim().includes(text))
  }

  // ── Loading state ───────────────────────────────────────────────────────

  it('shows loading text while fetching evaluation', async () => {
    let resolveQuery!: (v: unknown) => void
    mocks.queryFn.mockReturnValue(new Promise(r => { resolveQuery = r }))

    await act(async () => {
      root.render(<ProgramEvaluationViewer />)
    })

    expect(container.textContent).toContain('Loading program evaluation')

    // Resolve to avoid act() warnings
    await act(async () => { resolveQuery(PARSED_DATA) })
  })

  // ── Empty state ─────────────────────────────────────────────────────────

  it('shows empty state when no evaluation exists', async () => {
    mocks.queryFn.mockResolvedValue(null)
    mocks.syncCurrentProgramEvaluationFromLegacy.mockResolvedValue(null)
    await render()
    expect(container.textContent).toContain('No program evaluation uploaded yet')
  })

  // ── Error states ────────────────────────────────────────────────────────

  it('shows error message when fetch throws', async () => {
    mocks.queryFn.mockRejectedValue(new Error('Server unavailable'))
    await render()
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Server unavailable')
  })

  it('shows error when Convex client is unavailable', async () => {
    mocks.getConvexClient.mockReturnValue(null)
    await render()
    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('require the Convex-backed app runtime')
  })

  // ── Ready state ─────────────────────────────────────────────────────────

  it('shows filename and upload date when evaluation is loaded', async () => {
    await render()
    expect(container.textContent).toContain('my-eval.pdf')
    expect(container.textContent).toContain('Uploaded')
  })

  it('enables the View PDF button when evaluation is loaded', async () => {
    await render()
    const viewBtn = getButton('View PDF')
    expect(viewBtn?.disabled).toBe(false)
  })

  it('View PDF button is disabled while still loading', async () => {
    let resolveQuery!: (v: unknown) => void
    mocks.queryFn.mockReturnValue(new Promise(r => { resolveQuery = r }))

    await act(async () => {
      root.render(<ProgramEvaluationViewer />)
    })

    const viewBtn = getButton('View PDF')
    expect(viewBtn?.disabled).toBe(true)

    await act(async () => { resolveQuery(PARSED_DATA) })
  })

  // ── Refresh ─────────────────────────────────────────────────────────────

  it('Refresh button re-fetches the evaluation', async () => {
    await render()
    const callsAfterMount = mocks.queryFn.mock.calls.length

    const refreshBtn = getButton('Refresh')
    await act(async () => { refreshBtn?.click() })
    await act(async () => {})

    expect(mocks.queryFn.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })

  // ── Wave 1 useEffect split: modal open/close must not re-trigger fetch ──

  it('opening and closing the PDF modal does NOT call fetchParsed again', async () => {
    await render()
    const callsAfterMount = mocks.queryFn.mock.calls.length

    // Open the PDF modal
    const viewBtn = getButton('View PDF')
    expect(viewBtn?.disabled).toBe(false)
    await act(async () => { viewBtn?.click() })
    await act(async () => {})

    // Close the PDF modal via aria-label="Close"
    const closeBtns = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[aria-label="Close"]'),
    )
    // The PDF modal close button should be present
    expect(closeBtns.length).toBeGreaterThan(0)
    await act(async () => { closeBtns[0]?.click() })
    await act(async () => {})

    // fetchParsed (i.e. convexClient.query) must NOT have been called again
    expect(mocks.queryFn.mock.calls.length).toBe(callsAfterMount)
  })

  // ── Replace modal ───────────────────────────────────────────────────────

  it('Replace PDF button opens the replace modal', async () => {
    await render()
    const replaceBtn = getButton('Replace PDF')
    await act(async () => { replaceBtn?.click() })

    // The stub upload component should be visible inside the modal
    expect(container.querySelector('[data-testid="upload-stub"]')).not.toBeNull()
  })
})
