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

describe('Evaluation error handling — ConvexError recovery + success path', () => {
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

  // ── ConvexError("Upload failed") shows error message to user ──────────

  it('shows error message when replaceCurrentProgramEvaluation throws ConvexError("Upload failed")', async () => {
    mocks.replaceCurrentProgramEvaluationFromUpload.mockRejectedValueOnce(
      new Error('Upload failed'),
    )

    await render()
    await selectFile(new MockFile('transcript.pdf', 2))
    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    const alertEl = container.querySelector('[role="alert"]')
    expect(alertEl).not.toBeNull()
    expect(alertEl?.textContent).toContain('Upload failed')
  })

  // ── Previous evaluation data is preserved (not wiped) after error ─────

  it('previous evaluation data is still displayed after upload error (not wiped)', async () => {
    mocks.replaceCurrentProgramEvaluationFromUpload.mockRejectedValueOnce(
      new Error('Upload failed'),
    )

    await render()
    const testFile = new MockFile('my-degree-eval.pdf', 3)
    await selectFile(testFile)

    // File name visible before upload
    expect(container.textContent).toContain('my-degree-eval.pdf')

    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    // File name still visible after failed upload — data not wiped
    expect(container.textContent).toContain('my-degree-eval.pdf')

    // Error is shown
    expect(container.querySelector('[role="alert"]')).not.toBeNull()

    // Button is re-enabled for retry
    const btn = getUploadButton()
    expect(btn?.disabled).toBe(false)
    expect(btn?.textContent?.trim()).toBe('Upload PDF')
  })

  // ── Success path after recovery ───────────────────────────────────────

  it('shows success state when replaceCurrentProgramEvaluation succeeds', async () => {
    const onSuccess = vi.fn()
    mocks.replaceCurrentProgramEvaluationFromUpload.mockResolvedValueOnce({
      courses: [],
      gpa: 3.5,
    })

    await render({ onSuccess })
    await selectFile(new MockFile('good-eval.pdf', 1))
    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    // No error alert shown
    expect(container.querySelector('[role="alert"]')).toBeNull()

    // onSuccess callback was invoked
    expect(onSuccess).toHaveBeenCalled()
  })

  // ── Error then retry succeeds ─────────────────────────────────────────

  it('can recover from error — retry after failure succeeds', async () => {
    const onSuccess = vi.fn()

    // First call fails
    mocks.replaceCurrentProgramEvaluationFromUpload.mockRejectedValueOnce(
      new Error('Upload failed'),
    )
    // Second call succeeds
    mocks.replaceCurrentProgramEvaluationFromUpload.mockResolvedValueOnce({
      courses: [],
    })

    await render({ onSuccess })
    await selectFile(new MockFile('retry-eval.pdf', 1))

    // First attempt — fails
    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})
    expect(container.querySelector('[role="alert"]')).not.toBeNull()

    // File is preserved, retry
    expect(container.textContent).toContain('retry-eval.pdf')
    await act(async () => {
      getUploadButton()?.click()
    })
    await act(async () => {})

    // Error cleared on success, callback fired
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(onSuccess).toHaveBeenCalled()
  })
})
