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
})

