// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitize'

describe('sanitizeHtml', () => {
  it('passes through plain text unchanged', () => {
    expect(sanitizeHtml('Hello world')).toBe('Hello world')
  })

  it('strips script tags', () => {
    const dirty = '<script>alert("xss")</script>Hello'
    const result = sanitizeHtml(dirty)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert("xss")')
    expect(result).toContain('Hello')
  })

  it('strips inline event handlers', () => {
    const dirty = '<img src="x" onerror="alert(1)" />'
    const result = sanitizeHtml(dirty)
    expect(result).not.toContain('onerror')
  })

  it('allows safe HTML tags like <b> and <i>', () => {
    const safe = '<b>bold</b> and <i>italic</i>'
    const result = sanitizeHtml(safe)
    expect(result).toContain('bold')
    expect(result).toContain('italic')
  })

  it('handles empty string gracefully', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('strips javascript: href XSS vector', () => {
    const dirty = '<a href="javascript:alert(1)">click me</a>'
    const result = sanitizeHtml(dirty)
    expect(result).not.toContain('javascript:')
  })

  it('returns plain text for a plain text input with no HTML', () => {
    const input = 'This is just plain text with no HTML'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('strips data: URL XSS vector', () => {
    const dirty = '<a href="data:text/html,<script>alert(1)</script>">link</a>'
    const result = sanitizeHtml(dirty)
    expect(result).not.toContain('data:text/html')
  })
})
