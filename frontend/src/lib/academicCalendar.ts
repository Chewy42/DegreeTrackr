/**
 * Academic calendar utilities.
 *
 * Detects the current academic semester based on a given date.
 */

/**
 * Determine the academic semester for a given date.
 *
 * Rules:
 * - Jan 1 – May 15 → Spring <year>
 * - May 16 – Aug 15 → Summer <year>
 * - Aug 16 – Dec 31 → Fall <year>
 */
export function getCurrentSemester(date: Date = new Date()): string {
  const month = date.getMonth() // 0-indexed
  const day = date.getDate()
  const year = date.getFullYear()

  // Jan (0) through mid-May (4, day <=15)
  if (month < 4 || (month === 4 && day <= 15)) {
    return `Spring ${year}`
  }

  // Mid-May through mid-Aug (7, day <=15)
  if (month < 7 || (month === 7 && day <= 15)) {
    return `Summer ${year}`
  }

  // Aug 16 – Dec 31
  return `Fall ${year}`
}
