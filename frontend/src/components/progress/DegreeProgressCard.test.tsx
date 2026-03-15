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
