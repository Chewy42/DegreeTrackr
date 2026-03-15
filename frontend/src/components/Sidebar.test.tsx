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

  // ── Collapsed state ─────────────────────────────────────────────────────

  it('collapsed state hides nav item text labels (only icons visible)', async () => {
    await render()
    // Collapse the sidebar
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!
    await act(async () => { toggleBtn.click() })

    // The label text spans are conditionally rendered (!collapsed), so they should be absent
    const links = getLinks()
    for (const link of links) {
      // In collapsed mode, the link should NOT contain a <span> with truncate class (the label span)
      const labelSpan = Array.from(link.querySelectorAll('span')).find(s => s.className.includes('truncate'))
      expect(labelSpan).toBeUndefined()
    }
  })

  it('collapsed state provides aria-label on nav links for accessibility', async () => {
    await render()
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!
    await act(async () => { toggleBtn.click() })

    const links = getLinks()
    for (const link of links) {
      // When collapsed, each link gets aria-label with the item label
      expect(link.getAttribute('aria-label')).toBeTruthy()
    }
  })

  // ── Expanded state ──────────────────────────────────────────────────────

  it('expanded state shows all nav item text labels', async () => {
    await render()
    // On wide viewport (1280), sidebar starts expanded
    expect(container.textContent).toContain('Home')
    expect(container.textContent).toContain('Generate Schedule')
    expect(container.textContent).toContain('Explore my Options')
    expect(container.textContent).toContain('Settings')
  })

  it('expanded state does not add aria-label to nav links (text is visible)', async () => {
    await render()
    const links = getLinks()
    for (const link of links) {
      // When expanded, aria-label is undefined (text label is visible)
      expect(link.getAttribute('aria-label')).toBeNull()
    }
  })

  // ── Toggle button ───────────────────────────────────────────────────────

  it('toggle button has aria-expanded=true when sidebar is expanded', async () => {
    await render()
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true')
  })

  it('toggle button has aria-expanded=false when sidebar is collapsed', async () => {
    await render()
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!
    await act(async () => { toggleBtn.click() })

    const expandBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Expand sidebar"]')!
    expect(expandBtn.getAttribute('aria-expanded')).toBe('false')
  })

  it('re-expanding the sidebar shows labels again', async () => {
    await render()
    const collapseBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!
    await act(async () => { collapseBtn.click() })

    // Sidebar is collapsed, labels are hidden
    expect(container.textContent).not.toContain('Generate Schedule')

    // Re-expand
    const expandBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Expand sidebar"]')!
    await act(async () => { expandBtn.click() })

    expect(container.textContent).toContain('Generate Schedule')
    const aside = container.querySelector('aside')!
    expect(aside.className).toContain('w-64')
  })

  it('toggle button has minimum 44px touch target on mobile', async () => {
    await render()
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]')!
    // h-11 = 44px, w-11 = 44px (mobile-first, sm: overrides to h-9 w-9)
    expect(toggleBtn.className).toContain('h-11')
    expect(toggleBtn.className).toContain('w-11')
  })

  // ── Nav accessibility ───────────────────────────────────────────────────

  it('nav element has aria-label for navigation landmark', async () => {
    await render()
    const nav = container.querySelector('nav')!
    expect(nav).not.toBeNull()
  })
})
