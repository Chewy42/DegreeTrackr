// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ExploreChatLayout from './ExploreChatLayout'

// Stub child components to isolate layout behaviour
vi.mock('./ExploreChat', () => ({
  default: ({ sessionId, onSessionChange }: { sessionId: string | null; onSessionChange: (id: string | null) => void }) =>
    React.createElement('div', {
      'data-testid': 'explore-chat',
      'data-session-id': sessionId ?? '',
      onClick: () => onSessionChange('new-session'),
    }, 'ExploreChat'),
}))

vi.mock('./ChatHistorySidebar', () => ({
  default: ({ currentSessionId }: { currentSessionId: string | null }) =>
    React.createElement('div', {
      'data-testid': 'chat-history-sidebar',
      'data-session-id': currentSessionId ?? '',
    }, 'ChatHistorySidebar'),
}))

describe('ExploreChatLayout', () => {
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

  async function render() {
    await act(async () => {
      root.render(<ExploreChatLayout />)
    })
  }

  it('renders the chat area', async () => {
    await render()
    expect(container.querySelector('[data-testid="explore-chat"]')).not.toBeNull()
  })

  it('renders the chat history sidebar', async () => {
    await render()
    expect(container.querySelector('[data-testid="chat-history-sidebar"]')).not.toBeNull()
  })

  it('passes the selected session id down to both ExploreChat and ChatHistorySidebar', async () => {
    await render()

    // Initially both receive null session
    const chat = container.querySelector<HTMLElement>('[data-testid="explore-chat"]')!
    const sidebar = container.querySelector<HTMLElement>('[data-testid="chat-history-sidebar"]')!
    expect(chat.dataset.sessionId).toBe('')
    expect(sidebar.dataset.sessionId).toBe('')

    // Simulate ExploreChat calling onSessionChange
    await act(async () => { chat.click() })

    expect(chat.dataset.sessionId).toBe('new-session')
    expect(sidebar.dataset.sessionId).toBe('new-session')
  })

  it('sets the page title to "Explore | DegreeTrackr"', async () => {
    await render()
    expect(document.title).toBe('Explore | DegreeTrackr')
  })
})
