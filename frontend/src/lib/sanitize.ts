import DOMPurify from 'dompurify'

/**
 * Sanitize untrusted HTML to prevent XSS.
 * Used as a defense-in-depth layer; react-markdown v9 already strips raw HTML by default.
 */
export function sanitizeHtml(dirty: string): string {
  // DOMPurify works directly in the browser; in test (jsdom) the default
  // export may already be a callable or may need the window passed.
  const purify = typeof DOMPurify === 'function' ? DOMPurify(window) : DOMPurify
  return purify.sanitize(dirty)
}
