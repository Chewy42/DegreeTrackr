/**
 * Schedule API functions for the schedule builder feature.
 * Provides typed API calls for class search, validation, and requirements.
 *
 * Snapshot functions require Convex. Legacy Flask snapshot fallbacks are
 * intentionally disabled so frontend runtime does not silently depend on `/api/*`.
 */
import type {
	  ClassSection,
	  ClassSearchParams,
	  ClassesSearchResponse,
	  DegreeRequirement,
	  RequirementsSummary,
	  ScheduleValidation,
	  StatsResponse,
	  SubjectsResponse,
	  ScheduleSnapshot,
	} from '../components/schedule/types';
import { getActiveDays, minutesToTime, timeSlotsOverlap } from '../components/schedule/types';
import { getConvexClient } from './convex/client';
import { convexApi } from './convex/api';
import type { ScheduleSnapshotResult } from './convex/api';
import type { ProgramEvaluationPayload } from './convex';
import { apiUrl } from './runtimeConfig';

const API_BASE = apiUrl('/api');

function inferRequirementType(label: string): DegreeRequirement['type'] {
	const normalized = label.toLowerCase();
	if (normalized.includes('major') && normalized.includes('elective')) return 'major_elective';
	if (normalized.includes('major')) return 'major_core';
	if (normalized.includes('minor')) return 'minor';
	if (normalized.includes('concentration')) return 'concentration';
	if (normalized.includes('ge') || normalized.includes('general education')) return 'ge';
	return 'other';
}

type ParsedCreditRequirement = {
	label?: string;
	required?: number;
	earned?: number;
	in_progress?: number;
	needed?: number;
};

export function deriveRequirementsSummaryFromProgramEvaluation(
	payload: ProgramEvaluationPayload | null | undefined,
): RequirementsSummary | null {
	const rawRequirements = payload?.parsed_data?.credit_requirements;
	if (!Array.isArray(rawRequirements)) {
		return null;
	}

	const requirements = rawRequirements
		.map((entry): DegreeRequirement | null => {
			if (!entry || typeof entry !== 'object') return null;
			const requirement = entry as ParsedCreditRequirement;
			const label = requirement.label?.trim();
			if (!label) return null;
			const creditsNeeded = Math.max(0, Number(requirement.needed ?? 0));
			return {
				type: inferRequirementType(label),
				label,
				creditsNeeded,
			};
		})
		.filter((entry): entry is DegreeRequirement => entry !== null);

	const byType = requirements.reduce<Record<string, number>>((acc, requirement) => {
		acc[requirement.type] = (acc[requirement.type] ?? 0) + requirement.creditsNeeded;
		return acc;
	}, {});

	return {
		total: requirements.reduce((sum, requirement) => sum + requirement.creditsNeeded, 0),
		byType,
		requirements,
	};
}

export function validateScheduledClassesLocally(classes: ClassSection[]): ScheduleValidation {
	const conflicts: ScheduleValidation['conflicts'] = [];
	const warnings: string[] = [];
	const totalCredits = classes.reduce((sum, cls) => sum + (cls.credits ?? 0), 0);

	for (let i = 0; i < classes.length; i += 1) {
		for (let j = i + 1; j < classes.length; j += 1) {
			const classA = classes[i];
			const classB = classes[j];
			if (!classA || !classB) continue;

			for (const day of getActiveDays(classA)) {
				const slotsA = classA.occurrenceData.daysOccurring[day] ?? [];
				const slotsB = classB.occurrenceData.daysOccurring[day] ?? [];

				for (const slotA of slotsA) {
					for (const slotB of slotsB) {
						if (!timeSlotsOverlap(slotA, slotB)) continue;
						const overlapStart = Math.max(slotA.startTime, slotB.startTime);
						const overlapEnd = Math.min(slotA.endTime, slotB.endTime);
						conflicts.push({
							classId1: classA.id,
							classId2: classB.id,
							day,
							timeRange: `${minutesToTime(overlapStart)} - ${minutesToTime(overlapEnd)}`,
							message: `${classA.code} conflicts with ${classB.code} on ${day} at ${minutesToTime(overlapStart)}.`,
						});
					}
				}
			}
		}
	}

	if (totalCredits > 18) {
		warnings.push('Heavy schedule: more than 18 credits may be difficult to manage.');
	}

	return {
		valid: conflicts.length === 0,
		conflicts,
		totalCredits,
		warnings,
	};
}

function requireSnapshotClient() {
  const client = getConvexClient();
  if (!client) {
    throw new Error('Schedule snapshots require Convex and are unavailable in legacy mode.');
  }
  return client;
}

/**
 * Search and filter available classes.
 */
export async function searchClasses(
  params: ClassSearchParams = {},
  jwt?: string
): Promise<ClassesSearchResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.search) searchParams.set('search', params.search);
  if (params.days?.length) searchParams.set('days', params.days.join(','));
  if (params.timeStart !== undefined) searchParams.set('time_start', params.timeStart.toString());
  if (params.timeEnd !== undefined) searchParams.set('time_end', params.timeEnd.toString());
  if (params.creditsMin !== undefined) searchParams.set('credits_min', params.creditsMin.toString());
  if (params.creditsMax !== undefined) searchParams.set('credits_max', params.creditsMax.toString());
  if (params.subject) searchParams.set('subject', params.subject);
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
  if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
  if (params.includeRequirements !== undefined) {
    searchParams.set('include_requirements', params.includeRequirements.toString());
  }
  
  const url = `${API_BASE}/schedule/classes?${searchParams.toString()}`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }
  
  const res = await fetch(url, { headers });
  
  if (!res.ok) {
    throw new Error(`Failed to search classes: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Get a single class by ID.
 */
export async function getClassById(
  classId: string,
  jwt?: string
): Promise<ClassSection> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }
  
  const res = await fetch(`${API_BASE}/schedule/classes/${classId}`, { headers });
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Class not found');
    }
    throw new Error(`Failed to get class: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Validate a schedule for conflicts.
 */
export async function validateSchedule(
  classIds: string[]
): Promise<ScheduleValidation> {
  const res = await fetch(`${API_BASE}/schedule/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ classes: classIds }),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to validate schedule: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Get user's remaining degree requirements.
 * Requires authentication.
 */
export async function getUserRequirements(
  jwt: string
): Promise<RequirementsSummary> {
  const res = await fetch(`${API_BASE}/schedule/user-requirements`, {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/json',
    },
  });
  
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    throw new Error(`Failed to get requirements: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Auto-generate a schedule based on user preferences.
 * Requires authentication.
 */
export async function generateAutoSchedule(
  jwt: string
): Promise<{ class_ids: string[]; message?: string }> {
  const res = await fetch(`${API_BASE}/schedule/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    // Try to parse error message from response
    let errorMessage = `Failed to generate schedule: ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore JSON parse errors for error response
    }
    
    if (res.status === 401) {
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error(errorMessage);
  }
  
  return res.json();
}

/**
 * Get list of all available subjects.
 */
export async function getSubjects(): Promise<SubjectsResponse> {
  const res = await fetch(`${API_BASE}/schedule/subjects`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to get subjects: ${res.status}`);
  }
  
  return res.json();
}

/**
 * Get statistics about available classes.
 */
export async function getScheduleStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/schedule/stats`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to get stats: ${res.status}`);
  }
  
  return res.json();
}

// ── Convex ↔ ScheduleSnapshot adapter ──────────────────────────────────────

/**
 * Convert a Convex ScheduleSnapshotResult to the local ScheduleSnapshot type.
 * createdAt is epoch ms from Convex; the frontend type expects ISO strings.
 */
function convexSnapshotToFrontend(r: ScheduleSnapshotResult): ScheduleSnapshot {
	const createdAtIso = new Date(r.createdAt).toISOString();
	return {
		id: r.id,
		userId: r.userId,
		name: r.name,
		classIds: r.classIds,
		totalCredits: r.totalCredits,
		classCount: r.classCount,
		createdAt: createdAtIso,
		updatedAt: createdAtIso, // Convex doesn't track updatedAt separately
	};
}

// ── Snapshot helpers ────────────────────────────────────────────────────────

/**
 * Save the current schedule as a named snapshot for the authenticated user.
 */
export async function createScheduleSnapshot(
	name: string,
	classIds: string[],
	totalCredits: number,
	jwt: string,
): Promise<ScheduleSnapshot> {
	void jwt;
	const client = requireSnapshotClient();
	const result = await client.mutation(convexApi.scheduleSnapshots.createCurrentScheduleSnapshot, {
		name,
		classIds,
		totalCredits,
	});
	return convexSnapshotToFrontend(result);
}

/**
 * Get all schedule snapshots for the authenticated user.
 */
export async function listScheduleSnapshots(jwt: string): Promise<ScheduleSnapshot[]> {
	void jwt;
	const client = requireSnapshotClient();
	const results = await client.query(convexApi.scheduleSnapshots.listCurrentScheduleSnapshots, {});
	return results.map(convexSnapshotToFrontend);
}

/**
 * Delete a schedule snapshot by ID for the authenticated user.
 */
export async function deleteScheduleSnapshot(
	snapshotId: string,
	jwt: string,
): Promise<void> {
	void jwt;
	const client = requireSnapshotClient();
	await client.mutation(convexApi.scheduleSnapshots.deleteCurrentScheduleSnapshot, { id: snapshotId });
}
