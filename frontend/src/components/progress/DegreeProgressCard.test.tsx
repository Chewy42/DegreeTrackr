import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

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
})

