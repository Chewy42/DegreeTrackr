// @vitest-environment jsdom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import DegreeProgressCard from './DegreeProgressCard'

describe('DegreeProgressCard', () => {
  it('does not render NaN styles when total required credits are unavailable', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={0} totalCredits={0} earnedCredits={0} inProgressCredits={3} />,
    )

    expect(markup).not.toContain('NaN')
    expect(markup).toContain('0%')
  })

  it('renders 0.0 cr for a zero-credit category without going blank', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={0} totalCredits={120} earnedCredits={0} inProgressCredits={0} />,
    )

    expect(markup).not.toContain('NaN')
    expect(markup).toContain('0.0 cr')
  })

  it('shows fallback message when evaluation is not yet available', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard
        progress={0}
        totalCredits={0}
        earnedCredits={0}
        inProgressCredits={0}
        hasEvaluation={false}
      />,
    )

    expect(markup).toContain('Upload your transcript to see progress')
    expect(markup).not.toContain('Degree Progress')
  })

  it('renders the correct completion percentage', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={72} totalCredits={120} earnedCredits={86.4} inProgressCredits={3} />,
    )

    expect(markup).toContain('72%')
    expect(markup).not.toContain('NaN')
  })

  // ── Edge cases: credit boundary conditions ─────────────────────────────────

  it('shows 0% and zero earned credits when no credits have been earned', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={0} totalCredits={120} earnedCredits={0} inProgressCredits={0} />,
    )

    expect(markup).toContain('0%')
    // Progress bar is at 0 (aria-valuenow="0")
    expect(markup).toContain('aria-valuenow="0"')
    // Earned credit counter shows 0.0
    expect(markup).toContain('0.0 cr')
  })

  it('shows exactly 100% when earned credits exactly equal total required (no floating-point drift)', () => {
    // progress prop is already calculated by the caller; we verify the component
    // renders it faithfully without rounding artifacts.
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={100} totalCredits={120} earnedCredits={120} inProgressCredits={0} />,
    )

    expect(markup).toContain('100%')
    expect(markup).not.toContain('99%')
    expect(markup).not.toContain('101%')
    expect(markup).toContain('aria-valuenow="100"')
  })

  it('caps the progress bar at 100% when in-progress credits would overflow past 100', () => {
    // earnedCredits=120 fills 100% already; inProgressCredits=15 would push
    // totalProgressPercent above 100 without Math.min capping.
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={100} totalCredits={120} earnedCredits={120} inProgressCredits={15} />,
    )

    expect(markup).toContain('100%')
    expect(markup).toContain('aria-valuenow="100"')
    expect(markup).not.toContain('aria-valuenow="101"')
    expect(markup).not.toContain('aria-valuenow="108"')
  })

  it('renders correct credit breakdown for partial completion', () => {
    // 50% earned (60 of 120), 12 in progress
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={50} totalCredits={120} earnedCredits={60} inProgressCredits={12} />,
    )

    expect(markup).toContain('50%')
    expect(markup).toContain('60.0 cr')   // earned
    expect(markup).toContain('12.0 cr')   // in progress
    expect(markup).toContain('120.0 cr')  // total required
    expect(markup).not.toContain('NaN')
  })

  it('shows 100% and the "Complete" label when all degree credits are fulfilled', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={100} totalCredits={120} earnedCredits={120} inProgressCredits={0} />,
    )

    expect(markup).toContain('100%')
    expect(markup).toContain('Complete')
  })

  // ── Mobile 375px responsive ──────────────────────────────────────────────

  it('card layout stacks vertically on narrow screens via sm:flex-row', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={72} totalCredits={120} earnedCredits={86.4} inProgressCredits={3} />,
    )
    // Main flex container uses flex-col sm:flex-row for mobile stacking
    expect(markup).toContain('flex-col')
    expect(markup).toContain('sm:flex-row')
  })

  it('stats div has min-w-0 to prevent overflow on narrow screens', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={72} totalCredits={120} earnedCredits={86.4} inProgressCredits={3} />,
    )
    expect(markup).toContain('min-w-0')
  })

  // ── Dark mode ──────────────────────────────────────────────────────────────

  it('renders without hard-coded bg-white class in dark theme', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard progress={72} totalCredits={120} earnedCredits={86.4} inProgressCredits={3} />,
    )
    expect(markup).not.toContain('bg-white')
  })

  it('no-evaluation state renders without hard-coded bg-white class in dark theme', () => {
    const markup = renderToStaticMarkup(
      <DegreeProgressCard
        progress={0}
        totalCredits={0}
        earnedCredits={0}
        inProgressCredits={0}
        hasEvaluation={false}
      />,
    )
    expect(markup).not.toContain('bg-white')
  })

  describe('action buttons', () => {
    let container: HTMLDivElement
    let root: Root

    beforeEach(() => {
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
    })

    afterEach(() => {
      act(() => {
        root.unmount()
      })
      document.body.removeChild(container)
      vi.restoreAllMocks()
    })

    const defaultProps = {
      progress: 72,
      totalCredits: 120,
      earnedCredits: 86.4,
      inProgressCredits: 3,
    }

    function findButton(text: string) {
      return Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === text,
      )
    }

    it('"Copy share link" button is present', () => {
      act(() => {
        root.render(<DegreeProgressCard {...defaultProps} />)
      })
      expect(findButton('Copy share link')).toBeTruthy()
    })

    it('"Copy share link" triggers clipboard.writeText with current URL', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      })

      act(() => {
        root.render(<DegreeProgressCard {...defaultProps} />)
      })

      await act(async () => {
        findButton('Copy share link')!.click()
        await Promise.resolve()
      })

      expect(writeText).toHaveBeenCalledWith(window.location.href)
    })

    it('shows "Copied!" feedback after copy link is clicked', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
      })

      act(() => {
        root.render(<DegreeProgressCard {...defaultProps} />)
      })

      await act(async () => {
        findButton('Copy share link')!.click()
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(findButton('Copied!')).toBeTruthy()
    })

    it('"Export summary" button is present and triggers download', () => {
      const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
      const revokeObjectURL = vi.fn()
      global.URL.createObjectURL = createObjectURL
      global.URL.revokeObjectURL = revokeObjectURL
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {})

      act(() => {
        root.render(<DegreeProgressCard {...defaultProps} />)
      })

      const exportBtn = findButton('Export summary')
      expect(exportBtn).toBeTruthy()

      act(() => {
        exportBtn!.click()
      })

      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      expect(clickSpy).toHaveBeenCalled()
    })
  })
})
