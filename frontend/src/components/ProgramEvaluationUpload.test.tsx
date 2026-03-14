// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ProgramEvaluationUpload from './ProgramEvaluationUpload'

const mocks = vi.hoisted(() => ({
  replaceCurrentProgramEvaluationFromUpload: vi.fn().mockResolvedValue({}),
  getConvexClient: vi.fn(),
  mergePreferences: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../lib/convex', () => ({
  convexApi: {
    evaluations: {
      replaceCurrentProgramEvaluationFromUpload:
        'evaluations:replaceCurrentProgramEvaluationFromUpload',
    },
  },
  getConvexClient: mocks.getConvexClient,
  buildLegacyProgramEvaluationPreviewUrl: (jwt: string) =>
    `http://preview?token=${jwt}`,
  replaceCurrentProgramEvaluationFromUpload:
    mocks.replaceCurrentProgramEvaluationFromUpload,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    jwt: 'test-jwt',
    mergePreferences: mocks.mergePreferences,
    signOut: mocks.signOut,
  }),
}))

// File subclass that allows spoofing the size without allocating real bytes
class MockFile extends File {
  private _size: number
  constructor(name: string, sizeMB: number, type = 'application/pdf') {
    super([''], name, { type })
    this._size = Math.round(sizeMB * 1024 * 1024)
  }
  override get size(): number {
    return this._size
  }
}

describe('ProgramEvaluationUpload', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.getConvexClient.mockReturnValue({
      mutation: vi.fn().mockResolvedValue({}),
    })
    mocks.replaceCurrentProgramEvaluationFromUpload.mockResolvedValue({})
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  async function render(props: { onSuccess?: () => void } = {}) {
    await act(async () => {
      root.render(<ProgramEvaluationUpload {...props} />)
    })
  }

  function getUploadButton(): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      b => b.textContent?.trim().includes('Upload PDF') || b.textContent?.trim().includes('Uploading'),
    )
  }

  async function selectFile(file: File) {
    const input = container.querySelector<HTMLInputElement>(
      '#program-evaluation-file-input',
    )
    if (!input) throw new Error('File input not found')
    // FileList is read-only; use a plain object with the same shape
    const fileList = Object.assign(Object.create(null), {
      length: 1,
      0: file,
      item: (i: number) => (i === 0 ? file : null),
    }) as unknown as FileList
    Object.defineProperty(input, 'files', {
      value: fileList,
      configurable: true,
    })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  // ── Baseline state ──────────────────────────────────────────────────────

  it('upload button is disabled when no file is selected', async () => {
    await render()
    expect(getUploadButton()?.disabled).toBe(true)
  })

  it('shows the selected filename after file selection', async () => {
    await render()
    await selectFile(new MockFile('transcript.pdf', 1))
    expect(container.textContent).toContain('transcript.pdf')
  })

  it('upload button is enabled when a PDF is selected', async () => {
    await render()
    await selectFile(new MockFile('eval.pdf', 1))
    expect(getUploadButton()?.disabled).toBe(false)
  })

  // ── Non-PDF rejection ───────────────────────────────────────────────────

  it('rejects non-PDF files with an inline error', async () => {
    await render()
    const docx = new File([''], 'document.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    await selectFile(docx)
    expect(container.textContent).toContain('Upload a single PDF file.')
    expect(getUploadButton()?.disabled).toBe(true)
  })

  // ── Size warnings ───────────────────────────────────────────────────────

  it('shows a yellow size warning for files between 10 MB and 20 MB', async () => {
    await render()
    await selectFile(new MockFile('big.pdf', 15))
    expect(container.textContent).toMatch(/Large file.*MB/)
  })

  it('shows a harder warning for files over 20 MB', async () => {
    await render()
    await selectFile(new MockFile('huge.pdf', 25))
    expect(container.textContent).toMatch(/very large PDFs may fail/)
  })

  it('clears size warning for files under 10 MB', async () => {
    await render()
    await selectFile(new MockFile('small.pdf', 2))
    expect(container.textContent).not.toMatch(/Large file|very large/)
  })

  // ── Upload loading state ────────────────────────────────────────────────

  it('shows loading overlay and disables button while uploading', async () => {
    let resolveUpload!: () => void
    mocks.replaceCurrentProgramEvaluationFromUpload.mockReturnValue(
      new Promise<void>(r => {
        resolveUpload = r
      }),
    )

    await render()
    await selectFile(new MockFile('eval.pdf', 1))
    await act(async () => {
      getUploadButton()?.click()
    })

    // While in-flight: loading overlay visible, button disabled
    const statusEl = container.querySelector('[role="status"][aria-live="polite"]')
    expect(statusEl?.textContent).toContain('Uploading')
    expect(getUploadButton()?.disabled).toBe(true)

    await act(async () => {
      resolveUpload()
    })
  })

  // ── Success path ────────────────────────────────────────────────────────

  it('calls onSuccess and merges hasProgramEvaluation preference on success', async () => {
    const onSuccess = vi.fn()
    await render({ onSuccess })
    await selectFile(new MockFile('eval.pdf', 1))

    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    expect(mocks.replaceCurrentProgramEvaluationFromUpload).toHaveBeenCalled()
    expect(mocks.mergePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ hasProgramEvaluation: true }),
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it('enables the "Open program evaluation" button after a successful upload', async () => {
    await render()
    await selectFile(new MockFile('eval.pdf', 1))

    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    const openBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find(b => b.textContent?.includes('Open program evaluation'))
    expect(openBtn?.disabled).toBe(false)
  })

  // ── Error path ──────────────────────────────────────────────────────────

  it('shows error message and keeps file (retry possible) on upload failure', async () => {
    mocks.replaceCurrentProgramEvaluationFromUpload.mockRejectedValue(
      new Error('Network error'),
    )
    await render()
    await selectFile(new MockFile('eval.pdf', 1))

    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    // Error is displayed
    const alertEl = container.querySelector('[role="alert"]')
    expect(alertEl?.textContent).toContain('Network error')

    // File is retained — upload button re-enabled for retry
    expect(getUploadButton()?.disabled).toBe(false)
  })

  it('signs the user out when the server returns 401', async () => {
    mocks.replaceCurrentProgramEvaluationFromUpload.mockRejectedValue(
      new Error('401 Unauthorized'),
    )
    await render()
    await selectFile(new MockFile('eval.pdf', 1))

    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    expect(mocks.signOut).toHaveBeenCalled()
  })

  // ── Convex unavailable ──────────────────────────────────────────────────

  it('shows an error when the Convex client is unavailable', async () => {
    mocks.getConvexClient.mockReturnValue(null)
    await render()
    await selectFile(new MockFile('eval.pdf', 1))

    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    const alertEl = container.querySelector('[role="alert"]')
    expect(alertEl?.textContent).toContain('require the Convex-backed app runtime')
  })
})
