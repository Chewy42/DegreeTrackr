// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import PasswordStrengthIndicator from './PasswordStrengthIndicator'

// Strength tiers:
// score 0 → "Very weak"   — color #ef4444 (red)
// score 1 → "Needs work"  — color #ef4444 (red)
// score 2 → "Getting there" — color #f97316 (orange)
// score 3 → "Almost there"  — color #84cc16 (lime)
// score 4 → "Strong"       — color #22c55e (green)

const STRENGTH_LABELS = ['Very weak', 'Needs work', 'Getting there', 'Almost there', 'Strong']

function getStrengthLabel(container: HTMLElement): string | null {
  const spans = Array.from(container.querySelectorAll('span'))
  const found = spans.find((s) => STRENGTH_LABELS.includes(s.textContent?.trim() ?? ''))
  return found?.textContent?.trim() ?? null
}

function getBarWidth(container: HTMLElement): string {
  // The progress bar is the inner div with class h-full inside the track
  const bar = container.querySelector<HTMLElement>('.h-full')
  return bar?.style.width ?? ''
}

function getLabelColor(container: HTMLElement): string {
  const spans = Array.from(container.querySelectorAll('span'))
  const found = spans.find((s) => STRENGTH_LABELS.includes(s.textContent?.trim() ?? ''))
  return (found as HTMLElement | undefined)?.style.color ?? ''
}

describe('PasswordStrengthIndicator', () => {
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

  async function render(password: string) {
    await act(async () => {
      root.render(<PasswordStrengthIndicator password={password} />)
    })
  }

  it('empty string → "Very weak" label and 0% bar', async () => {
    await render('')
    expect(getStrengthLabel(container)).toBe('Very weak')
    expect(getBarWidth(container)).toBe('0%')
  })

  it('weak password ("abc") → "Very weak" label and minimum 8% bar', async () => {
    // "abc": length <7, no number, no uppercase, no special → score 0
    await render('abc')
    expect(getStrengthLabel(container)).toBe('Very weak')
    expect(getBarWidth(container)).toBe('8%')
  })

  it('score-1 password ("abc123") → "Needs work" label and 25% bar', async () => {
    // "abc123": length <7 ✗, has number ✓, no uppercase ✗, no special ✗ → score 1
    await render('abc123')
    expect(getStrengthLabel(container)).toBe('Needs work')
    expect(getBarWidth(container)).toBe('25%')
  })

  it('score-2 password ("Abcdefg") → "Getting there" label and 50% bar', async () => {
    // "Abcdefg": length ≥7 ✓, no number ✗, has uppercase ✓, no special ✗ → score 2
    await render('Abcdefg')
    expect(getStrengthLabel(container)).toBe('Getting there')
    expect(getBarWidth(container)).toBe('50%')
  })

  it('score-3 password ("Abcdefg1") → "Almost there" label and 75% bar', async () => {
    // "Abcdefg1": length ≥7 ✓, has number ✓, has uppercase ✓, no special ✗ → score 3
    await render('Abcdefg1')
    expect(getStrengthLabel(container)).toBe('Almost there')
    expect(getBarWidth(container)).toBe('75%')
  })

  it('strong password ("Abcdefg1!") → "Strong" label and 100% bar', async () => {
    // "Abcdefg1!": all 4 requirements met → score 4
    await render('Abcdefg1!')
    expect(getStrengthLabel(container)).toBe('Strong')
    expect(getBarWidth(container)).toBe('100%')
  })

  it('label color is red for weak passwords (score ≤ 1)', async () => {
    await render('abc123')
    // score 1 → color #ef4444
    expect(getLabelColor(container)).toBe('rgb(239, 68, 68)')
  })

  it('label color is orange for score 2', async () => {
    await render('Abcdefg')
    // score 2 → color #f97316
    expect(getLabelColor(container)).toBe('rgb(249, 115, 22)')
  })

  it('label color is lime for score 3', async () => {
    await render('Abcdefg1')
    // score 3 → color #84cc16
    expect(getLabelColor(container)).toBe('rgb(132, 204, 22)')
  })

  it('label color is green for strong password (score 4)', async () => {
    await render('Abcdefg1!')
    // score 4 → color #22c55e
    expect(getLabelColor(container)).toBe('rgb(34, 197, 94)')
  })

  it('renders all four requirement labels', async () => {
    await render('')
    expect(container.textContent).toContain('At least 7 characters')
    expect(container.textContent).toContain('Contains a number')
    expect(container.textContent).toContain('Contains an uppercase letter')
    expect(container.textContent).toContain('Contains a special character')
  })

  it('satisfied requirements show green indicator dots', async () => {
    // "Abcdefg1!" satisfies all → 4 green dots
    await render('Abcdefg1!')
    const dots = Array.from(container.querySelectorAll<HTMLElement>('span.w-2.h-2'))
    const greenDots = dots.filter((d) => d.style.backgroundColor === 'rgb(34, 197, 94)')
    expect(greenDots).toHaveLength(4)
  })
})
