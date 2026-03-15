// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { act } from 'react'
import { usePageTitle } from './usePageTitle'

// Minimal React hook runner without @testing-library/react
import React from 'react'
import { createRoot } from 'react-dom/client'

function renderHook(hook: () => void): { unmount: () => Promise<void> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  function HookRunner() {
    hook()
    return null
  }

  act(() => { root.render(React.createElement(HookRunner)) })

  return {
    unmount: async () => {
      await act(async () => { root.unmount() })
      container.remove()
    },
  }
}

afterEach(() => {
  document.title = ''
})

describe('usePageTitle', () => {
  it('sets document.title with page name on mount', async () => {
    const { unmount } = renderHook(() => usePageTitle('Schedule Builder'))
    expect(document.title).toBe('Schedule Builder | DegreeTrackr')
    await unmount()
  })

  it('sets document.title to just "DegreeTrackr" when pageTitle is null', async () => {
    const { unmount } = renderHook(() => usePageTitle(null))
    expect(document.title).toBe('DegreeTrackr')
    await unmount()
  })

  it('resets title on unmount to previous value', async () => {
    document.title = 'Previous Title'
    const { unmount } = renderHook(() => usePageTitle('Settings'))
    expect(document.title).toBe('Settings | DegreeTrackr')
    await unmount()
    expect(document.title).toBe('Previous Title')
  })
})
