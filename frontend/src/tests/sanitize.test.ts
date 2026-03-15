// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '../lib/sanitize'

describe('sanitizeHtml', () => {
  it('strips <script> tags from input', () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script>'
    const result = sanitizeHtml(dirty)
    expect(result).not.toContain('<script')
    expect(result).toContain('<p>Hello</p>')
  })

  it('preserves plain text unchanged', () => {
    expect(sanitizeHtml('Just plain text')).toBe('Just plain text')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('handles null/undefined gracefully', () => {
    // DOMPurify coerces non-string to string; verify no throw
    expect(() => sanitizeHtml(null as unknown as string)).not.toThrow()
    expect(() => sanitizeHtml(undefined as unknown as string)).not.toThrow()
  })
})
