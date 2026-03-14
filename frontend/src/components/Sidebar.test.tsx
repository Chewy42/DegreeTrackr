// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Sidebar from './Sidebar'

const mocks = vi.hoisted(() => ({
  pathname: '/',
  toggleMode: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mocks.pathname }),
  Link: ({ to, children, className, 'aria-current': ariaCurrent, 'aria-label': ariaLabel }: {
    to: string
    children: React.ReactNode
    className?: string
    'aria-current'?: string
    'aria-label'?: string
  }) =>
    React.createElement('a', { href: to, className, 'aria-current': ariaCurrent, 'aria-label': ariaLabel }, children),
}))

vi.mock('./ThemeModeToggle', () => ({
  default: ({ collapsed }: { collapsed?: boolean }) =>
    React.createElement('div', { 'data-testid': 'theme-toggle', 'data-collapsed': String(collapsed ?? false) }),
}))

vi.mock('../theme/AppThemeProvider', () => ({
  useAppTheme: () => ({ mode: 'light' as const, toggleMode: mocks.toggleMode }),
}))

describe('Sidebar', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mocks.pathname = '/'
    vi.clearAllMocks()
    // Default to wide viewport so sidebar starts expanded
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    container.remove()
  })

  async function render() {
    await act(async () => {
      root.render(<Sidebar />)
    })
  }

  function getLinks(): HTMLAnchorElement[] {
    return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
  }

  it('renders all four nav links with correct href paths', async () => {
    await render()
    const hrefs = getLinks().map(a => a.getAttribute('href'))
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/schedule-gen-home')
    expect(hrefs).toContain('/exploration-assistant')
    expect(hrefs).toContain('/settings')
  })

  it('marks the active link with aria-current="page" for the home route', async () => {
    mocks.pathname = '/'
    await render()
    const homeLink = getLinks().find(a => a.getAttribute('href') === '/')
    expect(homeLink?.getAttribute('aria-current')).toBe('page')
  })

  it('marks /progress-page as active on the home nav item', async () => {
    mocks.pathname = '/progress-page'
    await render()
    const homeLink = getLinks().find(a => a.getAttribute('href') === '/')
    expect(homeLink?.getAttribute('aria-current')).toBe('page')
  })

  it('marks the correct link active when on /exploration-assistant', async () => {
    mocks.pathname = '/exploration-assistant'
    await render()
    const exploreLink = getLinks().find(a => a.getAttribute('href') === '/exploration-assistant')
    const homeLink = getLinks().find(a => a.getAttribute('href') === '/')
    expect(exploreLink?.getAttribute('aria-current')).toBe('page')
    expect(homeLink?.getAttribute('aria-current')).toBeNull()
  })

  it('renders the ThemeModeToggle', async () => {
    await render()
    expect(container.querySelector('[data-testid="theme-toggle"]')).not.toBeNull()
  })

  it('starts expanded on a wide viewport and shows the brand name', async () => {
    await render()
    expect(container.textContent).toContain('DegreeTrackr')
    const aside = container.querySelector('aside')!
    expect(aside.className).toContain('w-64')
  })

  it('collapses when the toggle button is clicked', async () => {
    await render()
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!
    await act(async () => { toggleBtn.click() })

    const aside = container.querySelector('aside')!
    expect(aside.className).toContain('w-20')
  })

  it('passes collapsed=true to ThemeModeToggle when sidebar is collapsed', async () => {
    await render()
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!
    await act(async () => { toggleBtn.click() })

    const toggle = container.querySelector<HTMLElement>('[data-testid="theme-toggle"]')!
    expect(toggle.dataset.collapsed).toBe('true')
  })

  it('all nav links are keyboard-focusable (tabIndex not -1)', async () => {
    await render()
    const links = getLinks()
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      // tabIndex defaults to 0 for anchor elements with href; none should be explicitly -1
      expect(link.tabIndex).not.toBe(-1)
    }
  })

  it('collapsed sidebar starts on narrow viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 })
    await render()
    const aside = container.querySelector('aside')!
    expect(aside.className).toContain('w-20')
  })
})
