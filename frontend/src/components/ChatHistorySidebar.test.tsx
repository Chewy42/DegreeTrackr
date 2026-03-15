// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ChatHistorySidebar from './ChatHistorySidebar'

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
  clearSessions: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ jwt: 'test-jwt' }),
}))

vi.mock('../lib/convex', () => ({
  listChatSessionsConvex: mocks.listSessions,
  deleteChatSessionConvex: mocks.deleteSession,
  clearExploreSessionsConvex: mocks.clearSessions,
}))

const SESSIONS = [
  {
    _id: 'session-abc',
    title: 'What can I do with CS?',
    scope: 'explore',
    lastMessageAt: null,
    createdAt: new Date('2025-01-15').getTime(),
  },
  {
    _id: 'session-def',
    title: 'Career paths in biology',
    scope: 'explore',
    lastMessageAt: null,
    createdAt: new Date('2025-01-16').getTime(),
  },
]

describe('ChatHistorySidebar', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.clearAllMocks()
    mocks.listSessions.mockResolvedValue(SESSIONS)
    mocks.deleteSession.mockResolvedValue(undefined)
    mocks.clearSessions.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render(props: React.ComponentProps<typeof ChatHistorySidebar> = {}) {
    await act(async () => {
      root.render(<ChatHistorySidebar {...props} />)
    })
  }

  it('shows a loading indicator while sessions are being fetched', async () => {
    let resolve!: (v: typeof SESSIONS) => void
    const deferred = new Promise<typeof SESSIONS>(res => { resolve = res })
    mocks.listSessions.mockReturnValueOnce(deferred)

    // Synchronous act: effects fire and set loading=true, but deferred promise stays pending
    await act(async () => { root.render(<ChatHistorySidebar />) })

    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading')

    // Resolve to avoid dangling promise
    await act(async () => { resolve([]) })
  })

  it('shows the empty state message when there are no sessions', async () => {
    mocks.listSessions.mockResolvedValue([])
    await render()
    expect(container.textContent).toContain('No saved explore chats yet')
  })

  it('renders the Chat History heading', async () => {
    await render()
    expect(container.querySelector('h2')?.textContent).toContain('Chat History')
  })

  it('renders a list item for each session', async () => {
    await render()
    expect(container.querySelectorAll('ul li').length).toBe(2)
  })

  it('renders session titles', async () => {
    await render()
    expect(container.textContent).toContain('What can I do with CS?')
    expect(container.textContent).toContain('Career paths in biology')
  })

  it('calls onSelectSession with the session id when a session is clicked', async () => {
    const onSelectSession = vi.fn()
    await render({ onSelectSession })
    const sessionItems = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
    const target = sessionItems.find(el => el.textContent?.includes('What can I do with CS?'))!
    await act(async () => { target.click() })
    expect(onSelectSession).toHaveBeenCalledWith('session-abc')
  })

  it('highlights the active session with a blue left border', async () => {
    await render({ currentSessionId: 'session-abc' })
    const sessionItems = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
    const activeItem = sessionItems.find(el => el.textContent?.includes('What can I do with CS?'))!
    expect(activeItem.className).toContain('border-blue-500')
  })

  it('does not apply the active border to inactive sessions', async () => {
    await render({ currentSessionId: 'session-abc' })
    const sessionItems = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
    const inactiveItem = sessionItems.find(el => el.textContent?.includes('Career paths in biology'))!
    expect(inactiveItem.className).not.toContain('border-blue-500')
  })

  it('renders a delete button for each session', async () => {
    await render()
    const deleteBtns = container.querySelectorAll<HTMLButtonElement>('button[aria-label="Delete session"]')
    expect(deleteBtns.length).toBe(2)
  })

  it('calls deleteChatSessionConvex with the session id when delete is clicked', async () => {
    await render()
    const deleteBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Delete session"]')!
    await act(async () => { deleteBtn.click() })
    expect(mocks.deleteSession).toHaveBeenCalledWith('session-abc')
  })

  it('does not fire onSelectSession when the delete button is clicked', async () => {
    const onSelectSession = vi.fn()
    await render({ onSelectSession })
    const deleteBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Delete session"]')!
    await act(async () => { deleteBtn.click() })
    expect(onSelectSession).not.toHaveBeenCalled()
  })

  it('shows an error alert if fetching sessions fails', async () => {
    mocks.listSessions.mockRejectedValueOnce(new Error('Network error'))
    await render()
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toContain("couldn't load")
  })

  it('all session items are keyboard-focusable (tabIndex not -1)', async () => {
    await render()
    const sessionItems = Array.from(container.querySelectorAll<HTMLElement>('[role="button"]'))
    expect(sessionItems.length).toBeGreaterThan(0)
    for (const item of sessionItems) {
      expect(item.tabIndex).not.toBe(-1)
    }
  })

  // --- Optimistic / immediate UI update ---

  it('removes the deleted session from the list immediately without a page reload', async () => {
    await render()
    expect(container.querySelectorAll('ul li').length).toBe(2)
    const deleteBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Delete session"]')!
    await act(async () => { deleteBtn.click() })
    expect(container.querySelectorAll('ul li').length).toBe(1)
    expect(container.textContent).not.toContain('What can I do with CS?')
  })

  it('calls onSelectSession(null) when the currently-active session is deleted', async () => {
    const onSelectSession = vi.fn()
    await render({ currentSessionId: 'session-abc', onSelectSession })
    const deleteBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Delete session"]')!
    await act(async () => { deleteBtn.click() })
    expect(onSelectSession).toHaveBeenCalledWith(null)
  })

  it('does not call onSelectSession when a non-active session is deleted', async () => {
    const onSelectSession = vi.fn()
    await render({ currentSessionId: 'session-def', onSelectSession })
    // First delete button belongs to session-abc (the non-active one)
    const deleteBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Delete session"]')!
    await act(async () => { deleteBtn.click() })
    expect(onSelectSession).not.toHaveBeenCalled()
  })

  it('shows an error alert and refreshes the list if deletion fails', async () => {
    // First call (render) resolves; second call (refresh after failure) also rejects so the
    // error alert stays visible when the act settles.
    mocks.listSessions
      .mockResolvedValueOnce(SESSIONS)
      .mockRejectedValueOnce(new Error('Refresh also failed'))
    mocks.deleteSession.mockRejectedValueOnce(new Error('Server error'))
    await render()
    const deleteBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Delete session"]')!
    await act(async () => { deleteBtn.click() })
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(mocks.listSessions).toHaveBeenCalledTimes(2)
  })

  // --- Clear-all flow ---

  it('does not render the clear-all button when there are no sessions', async () => {
    mocks.listSessions.mockResolvedValue([])
    await render()
    const clearBtn = container.querySelector<HTMLButtonElement>('button[title="Clear all Explore chats"]')
    expect(clearBtn).toBeNull()
  })

  it('calls clearExploreSessionsConvex when the clear-all confirm is accepted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    await render()
    const clearBtn = container.querySelector<HTMLButtonElement>('button[title="Clear all Explore chats"]')!
    await act(async () => { clearBtn.click() })
    expect(mocks.clearSessions).toHaveBeenCalledOnce()
  })

  it('does not call clearExploreSessionsConvex when the clear-all confirm is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await render()
    const clearBtn = container.querySelector<HTMLButtonElement>('button[title="Clear all Explore chats"]')!
    await act(async () => { clearBtn.click() })
    expect(mocks.clearSessions).not.toHaveBeenCalled()
  })

  it('removes all sessions from the list after clear-all is confirmed (no current session)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    await render()
    const clearBtn = container.querySelector<HTMLButtonElement>('button[title="Clear all Explore chats"]')!
    await act(async () => { clearBtn.click() })
    expect(container.querySelectorAll('ul li').length).toBe(0)
    expect(container.textContent).toContain('No saved explore chats yet')
  })

  it('keeps the active session in the list after clear-all when currentSessionId is set', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    await render({ currentSessionId: 'session-abc' })
    const clearBtn = container.querySelector<HTMLButtonElement>('button[title="Clear all Explore chats"]')!
    await act(async () => { clearBtn.click() })
    expect(container.querySelectorAll('ul li').length).toBe(1)
    expect(container.textContent).toContain('What can I do with CS?')
    expect(container.textContent).not.toContain('Career paths in biology')
  })
})
