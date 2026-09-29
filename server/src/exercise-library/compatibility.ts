import {
  CanonicalExercise,
  ClientExerciseSnapshot,
  NormalizedProfile,
  ProfileNormalizationResult,
  ProjectId,
} from './types';
import {
  EQUIPMENT_IDS,
  EXPERIENCES,
  INJURY_SELECTIONS,
  LEGACY_EQUIPMENT_MAP,
  LEGACY_INJURY_MAP,
  LEGACY_PROJECT_MAP,
  PROJECT_IDS,
  isValue,
} from './vocabulary';
import { unavailableForInput } from './eligibility';

/** Version of the explicit profile compatibility mappings used at the API boundary. */
export const PROFILE_MAPPING_VERSION = '1';

/**
 * Explicit legacy labels accepted at the profile boundary. Values not listed
 * here are intentionally left unmatched instead of being guessed.
 */
export const LEGACY_EXPERIENCE_MAP: Record<string, NormalizedProfile['experience']> = {
  zero: 'zero',
  occasional: 'occasional',
  regular: 'regular',
  零基础: 'zero',
  偶尔练: 'occasional',
  经常练: 'regular',
};

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];

  const text = value.trim();
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // A malformed persisted JSON value is retained as one unmatched input so
    // callers receive a diagnostic rather than silently losing user intent.
    return [value];
  }
}

function uniqueStrings(values: readonly unknown[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    const text = String(value);
    if (!result.includes(text)) result.push(text);
  }
  return result;
}

function diagnostic(unknown: Array<{ field: 'injuries' | 'equipment' | 'experience' | 'selected_projects'; value: string }>): string[] {
  return unknown.map(item => `${item.field}:${item.value}`);
}

/**
 * Convert a stored or legacy profile into the closed vocabulary used by the
 * eligibility layer. The conversion is explicit and loss-aware: unmatched
 * injuries, projects, and experience stop generation; unmatched equipment is
 * retained as a diagnostic and never grants equipment eligibility.
 */
export function normalizeProfile(raw: Record<string, unknown>): ProfileNormalizationResult {
  const unknown: Array<{ field: 'injuries' | 'equipment' | 'experience' | 'selected_projects'; value: string }> = [];
  const rawExperience = String(raw.experience ?? '').trim();
  const experience = LEGACY_EXPERIENCE_MAP[rawExperience]
    || (isValue(EXPERIENCES, rawExperience) ? rawExperience : undefined);
  if (!experience) unknown.push({ field: 'experience', value: rawExperience });

  const injuries: NormalizedProfile['injuries'] = [];
  for (const rawValue of asArray(raw.injuries)) {
    const value = String(rawValue).trim();
    const mapped = LEGACY_INJURY_MAP[value]
      || (isValue(INJURY_SELECTIONS, value) ? value : undefined);
    if (mapped) {
      if (!injuries.includes(mapped)) injuries.push(mapped);
    } else {
      unknown.push({ field: 'injuries', value });
    }
  }

  const equipment: string[] = [];
  for (const rawValue of asArray(raw.equipment)) {
    const value = String(rawValue).trim();
    const mapped = LEGACY_EQUIPMENT_MAP[value]
      || (isValue(EQUIPMENT_IDS, value) ? value : undefined);
    if (mapped) {
      if (!equipment.includes(mapped)) equipment.push(mapped);
    } else {
      // This remains a diagnostic, rather than a usable equipment ID. A later
      // eligibility failure can still explain which project lacks equipment.
      unknown.push({ field: 'equipment', value });
    }
  }

  const rawProjects = raw.selected_projects ?? raw.selectedProjects;
  const requestedProjects = uniqueStrings(asArray(rawProjects));
  const selectedProjects: ProjectId[] = [];
  for (const value of requestedProjects) {
    const mapped = LEGACY_PROJECT_MAP[value]
      || (isValue(PROJECT_IDS, value) ? value : undefined);
    if (mapped) {
      if (!selectedProjects.includes(mapped)) selectedProjects.push(mapped);
    } else {
      unknown.push({ field: 'selected_projects', value });
    }
  }

  const diagnostics = diagnostic(unknown);
  const hasBlockingInput = unknown.some(item => item.field !== 'equipment');
  if (hasBlockingInput || selectedProjects.length === 0 || !experience) {
    return {
      unavailable: unavailableForInput(requestedProjects, experience || null, unknown),
      diagnostics,
    };
  }

  return {
    profile: {
      experience,
      injuries,
      equipment,
      selected_projects: selectedProjects,
    },
    diagnostics,
  };
}

/**
 * Adapt canonical content to the current React exercise contract. This is a
 * display adapter only; no display field participates in safety decisions.
 */
export function canonicalToClientExercise(
  exercise: CanonicalExercise,
  libraryVersion: string,
  prescription: { sets?: number; reps?: number; duration?: number } = {},
): ClientExerciseSnapshot {
  const category: ClientExerciseSnapshot['category'] = exercise.category === 'stretch'
    ? 'cooldown'
    : exercise.category === 'cardio'
      ? 'strength'
      : exercise.category;

  return {
    id: exercise.exercise_id,
    name: exercise.name,
    category,
    primary_muscle: exercise.muscle_group.primary[0] || '',
    equipment: [...exercise.equipment],
    difficulty: exercise.difficulty <= 1 ? 'beginner' : exercise.difficulty >= 4 ? 'advanced' : 'intermediate',
    sets: prescription.sets ?? 2,
    reps: prescription.reps ?? 12,
    duration: prescription.duration,
    rest_between_set: exercise.rest_seconds,
    rhythm: '',
    description: exercise.function.primary,
    steps: [...exercise.steps],
    tips: exercise.tips.join('\n'),
    warning: exercise.warning,
    canonical_exercise_id: exercise.exercise_id,
    library_version: libraryVersion,
  };
}
