// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import PasswordStrengthIndicator from './PasswordStrengthIndicator'

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

  async function renderPwd(password: string) {
    await act(async () => {
      root.render(<PasswordStrengthIndicator password={password} />)
    })
  }

  // --- Strength labels ---

  it('shows "Very weak" for empty string (score 0)', async () => {
    await renderPwd('')
    expect(container.textContent).toContain('Very weak')
  })

  it('shows "Needs work" for password meeting only 1 requirement', async () => {
    // Length ≥ 7 only: "aaaaaaa"
    await renderPwd('aaaaaaa')
    expect(container.textContent).toContain('Needs work')
  })

  it('shows "Getting there" for password meeting 2 requirements', async () => {
    // Length + number: "aaaaaaa1"
    await renderPwd('aaaaaaa1')
    expect(container.textContent).toContain('Getting there')
  })

  it('shows "Almost there" for password meeting 3 requirements', async () => {
    // Length + number + uppercase: "Aaaaaaa1"
    await renderPwd('Aaaaaaa1')
    expect(container.textContent).toContain('Almost there')
  })

  it('shows "Strong" for password meeting all 4 requirements', async () => {
    // Length + number + uppercase + special: "Aaaaaaa1!"
    await renderPwd('Aaaaaaa1!')
    expect(container.textContent).toContain('Strong')
  })

  // --- Individual requirement dot colours ---

  it('length dot is green when ≥ 7 chars', async () => {
    await renderPwd('abcdefg') // exactly 7
    const dots = container.querySelectorAll<HTMLSpanElement>('span.w-2.h-2.rounded-full')
    expect(dots[0].style.backgroundColor).toBe('rgb(34, 197, 94)') // #22c55e
  })

  it('length dot is grey when < 7 chars', async () => {
    await renderPwd('abcdef') // 6
    const dots = container.querySelectorAll<HTMLSpanElement>('span.w-2.h-2.rounded-full')
    expect(dots[0].style.backgroundColor).toBe('rgba(15, 23, 42, 0.2)')
  })

  it('number dot is green when password contains a digit', async () => {
    await renderPwd('aaaaaaa1')
    const dots = container.querySelectorAll<HTMLSpanElement>('span.w-2.h-2.rounded-full')
    expect(dots[1].style.backgroundColor).toBe('rgb(34, 197, 94)')
  })

  it('number dot is grey when password has no digit', async () => {
    await renderPwd('aaaaaaa')
    const dots = container.querySelectorAll<HTMLSpanElement>('span.w-2.h-2.rounded-full')
    expect(dots[1].style.backgroundColor).toBe('rgba(15, 23, 42, 0.2)')
  })

  it('uppercase dot is green when password contains uppercase', async () => {
    await renderPwd('Aaaaaaa')
    const dots = container.querySelectorAll<HTMLSpanElement>('span.w-2.h-2.rounded-full')
    expect(dots[2].style.backgroundColor).toBe('rgb(34, 197, 94)')
  })

  it('special char dot is green when password contains special character', async () => {
    await renderPwd('aaaaaaa!')
    const dots = container.querySelectorAll<HTMLSpanElement>('span.w-2.h-2.rounded-full')
    expect(dots[3].style.backgroundColor).toBe('rgb(34, 197, 94)')
  })

  // --- Bar width ---

  it('bar width is 0% for empty password', async () => {
    await renderPwd('')
    const bar = container.querySelector<HTMLDivElement>('div.h-full.rounded-full')!
    expect(bar.style.width).toBe('0%')
  })

  it('bar width is at least 8% for non-empty password (even if no requirements met)', async () => {
    await renderPwd('a') // short + no special requirements
    const bar = container.querySelector<HTMLDivElement>('div.h-full.rounded-full')!
    const width = parseFloat(bar.style.width)
    expect(width).toBeGreaterThanOrEqual(8)
  })

  it('bar width is 100% when all 4 requirements are met', async () => {
    await renderPwd('Aaaaaaa1!')
    const bar = container.querySelector<HTMLDivElement>('div.h-full.rounded-full')!
    expect(bar.style.width).toBe('100%')
  })

  // --- Static content ---

  it('renders "Password strength" heading', async () => {
    await renderPwd('')
    expect(container.textContent).toContain('Password strength')
  })

  it('renders all 4 requirement labels', async () => {
    await renderPwd('')
    expect(container.textContent).toContain('At least 7 characters')
    expect(container.textContent).toContain('Contains a number')
    expect(container.textContent).toContain('Contains an uppercase letter')
    expect(container.textContent).toContain('Contains a special character')
  })
})
