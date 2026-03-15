import { describe, expect, it } from 'vitest'
import {
  applyTemplateToDraft,
  getDegreeTemplate,
} from '../lib/degreeTemplate'

describe('Degree plan template — DT161', () => {
  it('select "Computer Science" template → returns at least 5 required courses', () => {
    const template = getDegreeTemplate('computer-science')
    expect(template).not.toBeNull()
    expect(template!.courses.length).toBeGreaterThanOrEqual(5)
  })

  it('template courses have required fields: courseId, name, credits, required', () => {
    const template = getDegreeTemplate('computer-science')!
    for (const course of template.courses) {
      expect(course).toHaveProperty('courseId')
      expect(course).toHaveProperty('name')
      expect(course).toHaveProperty('credits')
      expect(course).toHaveProperty('required')
      expect(typeof course.courseId).toBe('string')
      expect(typeof course.credits).toBe('number')
    }
  })

  it('select "General" template → returns empty course list', () => {
    const template = getDegreeTemplate('general')
    expect(template).not.toBeNull()
    expect(template!.courses).toEqual([])
  })

  it('apply template to schedule → courses added to draftSchedule', () => {
    const draft = applyTemplateToDraft('computer-science', [])
    expect(draft.length).toBeGreaterThanOrEqual(5)
    expect(draft.some((c) => c.courseId === 'CS101')).toBe(true)
  })

  it('unknown template ID → throws error', () => {
    expect(() => applyTemplateToDraft('nonexistent', [])).toThrow('Unknown template')
    expect(getDegreeTemplate('nonexistent')).toBeNull()
  })
})
