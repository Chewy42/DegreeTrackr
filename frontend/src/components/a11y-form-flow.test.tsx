// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import TextField from './TextField'
import SubmitButton from './SubmitButton'

describe('a11y form flow', () => {
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

  function getInput() {
    return container.querySelector<HTMLInputElement>('input')!
  }

  function getButton() {
    return container.querySelector('button')!
  }

  describe('TextField — error state', () => {
    it('sets aria-invalid on the input when error is provided', async () => {
      await act(async () => {
        root.render(<TextField label="Email" value="" onChange={vi.fn()} error="Invalid email" />)
      })
      expect(getInput().getAttribute('aria-invalid')).toBe('true')
    })

    it('aria-describedby on input matches the error element id', async () => {
      await act(async () => {
        root.render(<TextField label="Email" value="" onChange={vi.fn()} error="Invalid email" />)
      })
      const input = getInput()
      const describedById = input.getAttribute('aria-describedby')
      expect(describedById).not.toBeNull()
      const errorEl = document.getElementById(describedById!)
      expect(errorEl).not.toBeNull()
      expect(errorEl!.textContent).toBe('Invalid email')
    })

    it('does not set aria-invalid when error is absent', async () => {
      await act(async () => {
        root.render(<TextField label="Email" value="" onChange={vi.fn()} />)
      })
      expect(getInput().getAttribute('aria-invalid')).toBeNull()
    })

    it('does not set aria-describedby when error is absent', async () => {
      await act(async () => {
        root.render(<TextField label="Email" value="" onChange={vi.fn()} />)
      })
      expect(getInput().getAttribute('aria-describedby')).toBeNull()
    })
  })

  describe('TextField — required state', () => {
    it('sets aria-required="true" when required is true', async () => {
      await act(async () => {
        root.render(<TextField label="Password" value="" onChange={vi.fn()} required />)
      })
      expect(getInput().getAttribute('aria-required')).toBe('true')
    })

    it('does not set aria-required when required is not provided', async () => {
      await act(async () => {
        root.render(<TextField label="Password" value="" onChange={vi.fn()} />)
      })
      expect(getInput().getAttribute('aria-required')).toBeNull()
    })
  })

  describe('SubmitButton — loading state', () => {
    it('sets aria-busy="true" when loading', async () => {
      await act(async () => {
        root.render(<SubmitButton loading>Submit</SubmitButton>)
      })
      expect(getButton().getAttribute('aria-busy')).toBe('true')
    })

    it('sets aria-disabled="true" when loading', async () => {
      await act(async () => {
        root.render(<SubmitButton loading>Submit</SubmitButton>)
      })
      expect(getButton().getAttribute('aria-disabled')).toBe('true')
    })

    it('does not set aria-busy or aria-disabled when not loading', async () => {
      await act(async () => {
        root.render(<SubmitButton>Submit</SubmitButton>)
      })
      expect(getButton().getAttribute('aria-busy')).toBeNull()
      expect(getButton().getAttribute('aria-disabled')).toBeNull()
    })
  })
})
