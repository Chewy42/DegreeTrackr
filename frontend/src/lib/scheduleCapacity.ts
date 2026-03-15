/**
 * Schedule capacity validation utilities.
 *
 * Enforces a hard cap on courses per draft schedule and prevents
 * duplicate entries before the data reaches the Convex mutation.
 */

export const MAX_SCHEDULE_COURSES = 20

/**
 * Add a course to the schedule, enforcing capacity and uniqueness.
 *
 * @returns The updated classIds array.
 * @throws {Error} If the schedule is already at capacity.
 * @throws {Error} If the course is already in the schedule.
 */
export function addCourseToSchedule(
  classIds: string[],
  newClassId: string,
): string[] {
  if (classIds.includes(newClassId)) {
    throw new Error('Course already in schedule')
  }
  if (classIds.length >= MAX_SCHEDULE_COURSES) {
    throw new Error('Schedule full')
  }
  return [...classIds, newClassId]
}
