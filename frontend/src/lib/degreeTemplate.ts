/**
 * Degree plan template utilities.
 * Provides preset course lists for common degree programs.
 */

export interface TemplateCourse {
  courseId: string
  name: string
  credits: number
  required: boolean
}

export interface DegreeTemplate {
  templateId: string
  label: string
  courses: TemplateCourse[]
}

const CS_TEMPLATE: DegreeTemplate = {
  templateId: 'computer-science',
  label: 'Computer Science',
  courses: [
    { courseId: 'CS101', name: 'Intro to Computer Science', credits: 3, required: true },
    { courseId: 'CS201', name: 'Data Structures', credits: 3, required: true },
    { courseId: 'CS301', name: 'Algorithms', credits: 3, required: true },
    { courseId: 'CS310', name: 'Operating Systems', credits: 3, required: true },
    { courseId: 'CS320', name: 'Database Systems', credits: 3, required: true },
    { courseId: 'MATH150', name: 'Calculus I', credits: 4, required: true },
    { courseId: 'MATH250', name: 'Linear Algebra', credits: 3, required: true },
  ],
}

const GENERAL_TEMPLATE: DegreeTemplate = {
  templateId: 'general',
  label: 'General / Undeclared',
  courses: [],
}

const TEMPLATES = new Map<string, DegreeTemplate>([
  [CS_TEMPLATE.templateId, CS_TEMPLATE],
  [GENERAL_TEMPLATE.templateId, GENERAL_TEMPLATE],
])

export function getDegreeTemplate(templateId: string): DegreeTemplate | null {
  return TEMPLATES.get(templateId) ?? null
}

/**
 * Apply a template's courses to a draft schedule (returns new array).
 */
export function applyTemplateToDraft(
  templateId: string,
  existingDraft: TemplateCourse[],
): TemplateCourse[] {
  const template = getDegreeTemplate(templateId)
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`)
  }
  const existingIds = new Set(existingDraft.map((c) => c.courseId))
  const newCourses = template.courses.filter((c) => !existingIds.has(c.courseId))
  return [...existingDraft, ...newCourses]
}
