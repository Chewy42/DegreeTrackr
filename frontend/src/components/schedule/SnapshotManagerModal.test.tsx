// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ScheduleSnapshot } from './types'

// ── Test factory ─────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    id: 'snap-1',
    userId: 'user-1',
    name: 'Morning Only',
    classIds: ['CS-101-01', 'MATH-201-02'],
    totalCredits: 6,
    classCount: 2,
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-02-01T10:00:00Z',
    ...overrides,
  }
}

const baseProps = {
  isOpen: true,
  loading: false,
  saving: false,
  error: null,
  onClose: vi.fn(),
  onRefresh: vi.fn(),
  onSave: vi.fn(),
  onLoad: vi.fn(),
  onDelete: vi.fn(),
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('SnapshotManagerModal', () => {
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
  })

  async function render(props: Parameters<typeof renderWithComponent>[0]) {
    return renderWithComponent(props)
  }

  async function renderWithComponent(props: {
    isOpen: boolean
    snapshots: ScheduleSnapshot[]
    loading: boolean
    saving: boolean
    error: string | null
    onClose: () => void
    onRefresh: () => void
    onSave: (name: string) => void
    onLoad: (snapshot: ScheduleSnapshot) => void
    onDelete: (snapshot: ScheduleSnapshot) => void
  }) {
    const { default: SnapshotManagerModal } = await import('./SnapshotManagerModal')
    await act(async () => {
      root.render(<SnapshotManagerModal {...props} />)
    })
  }

  it('renders list of saved snapshots with names and dates', async () => {
    const snap1 = makeSnapshot({ id: 'snap-1', name: 'Morning Only' })
    const snap2 = makeSnapshot({ id: 'snap-2', name: 'Full Day', classCount: 5, totalCredits: 15 })
    await render({ ...baseProps, snapshots: [snap1, snap2] })

    expect(container.textContent).toContain('Morning Only')
    expect(container.textContent).toContain('Full Day')
    expect(container.textContent).toContain('2 classes')
    expect(container.textContent).toContain('5 classes')
    expect(container.textContent).toContain('15 credits')
  })

  it('clicking "Load" on a snapshot calls onLoad with the snapshot', async () => {
    const onLoad = vi.fn()
    const snap = makeSnapshot()
    await render({ ...baseProps, snapshots: [snap], onLoad })

    const loadBtn = container.querySelector<HTMLButtonElement>(
      'button.bg-emerald-600',
    )
    expect(loadBtn).not.toBeNull()
    expect(loadBtn!.textContent).toContain('Load')

    await act(async () => { loadBtn!.click() })
    expect(onLoad).toHaveBeenCalledWith(snap)
  })

  it('"Delete" button calls onDelete with the snapshot', async () => {
    const onDelete = vi.fn()
    const snap = makeSnapshot({ name: 'To Delete' })
    await render({ ...baseProps, snapshots: [snap], onDelete })

    const deleteBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete snapshot To Delete"]',
    )
    expect(deleteBtn).not.toBeNull()

    await act(async () => { deleteBtn!.click() })
    expect(onDelete).toHaveBeenCalledWith(snap)
  })

  it('empty snapshot list shows empty state message', async () => {
    await render({ ...baseProps, snapshots: [] })

    expect(container.textContent).toContain('No snapshots yet')
  })

  it('close button fires onClose', async () => {
    const onClose = vi.fn()
    await render({ ...baseProps, snapshots: [], onClose })

    const closeBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close"]',
    )
    expect(closeBtn).not.toBeNull()

    await act(async () => { closeBtn!.click() })
    expect(onClose).toHaveBeenCalled()
  })

  it('returns null when isOpen is false', async () => {
    await render({ ...baseProps, snapshots: [], isOpen: false })
    expect(container.innerHTML).toBe('')
  })

  it('displays error message when error prop is set', async () => {
    await render({ ...baseProps, snapshots: [], error: 'Save failed' })
    expect(container.textContent).toContain('Save failed')
  })

  it('saves snapshot name on form submit', async () => {
    const onSave = vi.fn()
    await render({ ...baseProps, snapshots: [], onSave })

    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!
    await act(async () => {
      // Simulate typing
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value',
      )!.set!
      nativeInputValueSetter.call(input, 'My Snapshot')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(onSave).toHaveBeenCalledWith('My Snapshot')
  })

  it('shows loading state text', async () => {
    await render({ ...baseProps, snapshots: [], loading: true })
    expect(container.textContent).toContain('Loading snapshots')
  })
})
