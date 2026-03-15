// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ProgramEvaluationUpload from '../components/ProgramEvaluationUpload'

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

describe('Evaluation upload error handling — ConvexError + data preservation', () => {
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
      (b) =>
        b.textContent?.trim().includes('Upload PDF') ||
        b.textContent?.trim().includes('Uploading'),
    )
  }

  async function selectFile(file: File) {
    const input = container.querySelector<HTMLInputElement>(
      '#program-evaluation-file-input',
    )
    if (!input) throw new Error('File input not found')
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

  // ── ConvexError shows error message, does not crash ───────────────────

  it('shows error toast when replaceCurrentProgramEvaluationFromUpload throws ConvexError', async () => {
    // Simulate ConvexError — the component catches Error instances and reads .message
    mocks.replaceCurrentProgramEvaluationFromUpload.mockRejectedValueOnce(
      new Error('File size exceeds the 50 MB limit.'),
    )

    await render()
    await selectFile(new MockFile('eval.pdf', 1))
    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    // Error alert is displayed (not a crash)
    const alertEl = container.querySelector('[role="alert"]')
    expect(alertEl).not.toBeNull()
    expect(alertEl?.textContent).toContain('File size exceeds the 50 MB limit.')

    // Upload button is re-enabled for retry
    expect(getUploadButton()?.disabled).toBe(false)
  })

  // ── Old evaluation data (selected file) persists after failed upload ──

  it('preserves selected file info after failed upload so user can retry', async () => {
    mocks.replaceCurrentProgramEvaluationFromUpload.mockRejectedValueOnce(
      new Error('Server validation failed'),
    )

    await render()
    const testFile = new MockFile('my-transcript.pdf', 2)
    await selectFile(testFile)

    // File name is displayed before upload attempt
    expect(container.textContent).toContain('my-transcript.pdf')

    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    // After failed upload: file name is still displayed (data preserved)
    expect(container.textContent).toContain('my-transcript.pdf')

    // Error is shown
    const alertEl = container.querySelector('[role="alert"]')
    expect(alertEl).not.toBeNull()

    // Upload button is re-enabled — state is "idle", not stuck in "uploading"
    const btn = getUploadButton()
    expect(btn?.disabled).toBe(false)
    expect(btn?.textContent?.trim()).toBe('Upload PDF')
  })
})
