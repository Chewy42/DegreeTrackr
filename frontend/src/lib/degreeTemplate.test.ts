// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { getDegreeTemplate, applyTemplateToDraft, type TemplateCourse } from './degreeTemplate'

describe('getDegreeTemplate', () => {
  it('returns the computer-science template', () => {
    const t = getDegreeTemplate('computer-science')
    expect(t).not.toBeNull()
    expect(t!.templateId).toBe('computer-science')
    expect(t!.label).toBe('Computer Science')
  })

  it('CS template has courses with required fields', () => {
    const t = getDegreeTemplate('computer-science')!
    expect(t.courses.length).toBeGreaterThan(0)
    for (const c of t.courses) {
      expect(typeof c.courseId).toBe('string')
      expect(typeof c.name).toBe('string')
      expect(typeof c.credits).toBe('number')
      expect(typeof c.required).toBe('boolean')
    }
  })

  it('returns the general/undeclared template', () => {
    const t = getDegreeTemplate('general')
    expect(t).not.toBeNull()
    expect(t!.courses).toHaveLength(0)
  })

  it('returns null for unknown template', () => {
    expect(getDegreeTemplate('unknown-major')).toBeNull()
  })
})

describe('applyTemplateToDraft', () => {
  it('applies all CS template courses to an empty draft', () => {
    const result = applyTemplateToDraft('computer-science', [])
    expect(result.length).toBeGreaterThan(0)
    expect(result.some(c => c.courseId === 'CS101')).toBe(true)
  })

  it('does not add duplicate courses already in the draft', () => {
    const existing: TemplateCourse[] = [
      { courseId: 'CS101', name: 'Intro to CS', credits: 3, required: true },
    ]
    const result = applyTemplateToDraft('computer-science', existing)
    const cs101s = result.filter(c => c.courseId === 'CS101')
    expect(cs101s).toHaveLength(1)
  })

  it('preserves existing draft courses', () => {
    const existing: TemplateCourse[] = [
      { courseId: 'HIST100', name: 'World History', credits: 3, required: false },
    ]
    const result = applyTemplateToDraft('computer-science', existing)
    expect(result.some(c => c.courseId === 'HIST100')).toBe(true)
  })

  it('applies general template (empty courses) without changing draft', () => {
    const existing: TemplateCourse[] = [
      { courseId: 'ART100', name: 'Art Appreciation', credits: 2, required: false },
    ]
    const result = applyTemplateToDraft('general', existing)
    expect(result).toEqual(existing)
  })

  it('throws for unknown template', () => {
    expect(() => applyTemplateToDraft('unknown', [])).toThrow(/unknown template/i)
  })
})
