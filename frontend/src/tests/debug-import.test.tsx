// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// Try static import instead of dynamic
import WeeklyCalendar from '../components/schedule/WeeklyCalendar'

vi.mock('../components/schedule/ClassDetailsModal', () => ({
  default: () => React.createElement('div'),
}))
vi.mock('react-icons/fi', () => new Proxy({}, {
  get: (_t, n) => (p: any) => React.createElement('span', { ...p, 'data-icon': n }),
}))
vi.stubGlobal('ResizeObserver', vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })))

describe('debug', () => {
  it('static import works', () => {
    console.log('WeeklyCalendar type:', typeof WeeklyCalendar)
    expect(WeeklyCalendar).toBeDefined()
  })
})
