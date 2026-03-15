// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { usePageTitle } from './usePageTitle'

function TitleSetter({ title }: { title: string | null }) {
  usePageTitle(title)
  return null
}

describe('usePageTitle', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const originalTitle = document.title

  beforeEach(() => {
    document.title = 'Initial Title'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
    document.title = originalTitle
  })

  it('sets document.title to "Page | DegreeTrackr" on render', async () => {
    await act(async () => { root.render(createElement(TitleSetter, { title: 'Schedule Builder' })) })
    expect(document.title).toBe('Schedule Builder | DegreeTrackr')
  })

  it('sets document.title to just "DegreeTrackr" when title is null', async () => {
    await act(async () => { root.render(createElement(TitleSetter, { title: null })) })
    expect(document.title).toBe('DegreeTrackr')
  })

  it('updates document.title when the title prop changes', async () => {
    await act(async () => { root.render(createElement(TitleSetter, { title: 'Page A' })) })
    expect(document.title).toBe('Page A | DegreeTrackr')

    await act(async () => { root.render(createElement(TitleSetter, { title: 'Page B' })) })
    expect(document.title).toBe('Page B | DegreeTrackr')
  })

  it('resets document.title to the previous value on unmount', async () => {
    expect(document.title).toBe('Initial Title')

    await act(async () => { root.render(createElement(TitleSetter, { title: 'Temp Page' })) })
    expect(document.title).toBe('Temp Page | DegreeTrackr')

    await act(async () => { root.unmount() })
    expect(document.title).toBe('Initial Title')

    // Prevent afterEach from calling unmount again on an already-unmounted root
    root = createRoot(container)
  })
})
