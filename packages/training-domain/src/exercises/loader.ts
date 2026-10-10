/**
 * Exercise library loader (FS isolation boundary).
 *
 * This is the ONLY module allowed to import 'fs' in training-domain.
 * All other modules must receive Exercise[] as function parameters.
 */

import { readFileSync } from 'node:fs';
import { exerciseSchema, type Exercise } from '@flourish/contracts';

/**
 * Raw JSON structure from canonical-exercise-library.json
 */
interface RawCanonicalExercise {
  exercise_id: string;
  name: string;
  name_en: string;
  muscle_group: { primary: string[]; secondary: string[] };
  difficulty: number;
  equipment: string[];
  function: { primary: string; secondary: string };
  category: string;
  target_projects: string[];
  contraindications: string[];
  alternative_exercise_ids: string[];
  review_status?: string;
  rest_seconds: number;
  steps: string[];
  tips: string[];
  warning: string;
  media?: { cover_image?: string | null; video?: string | null } | null;
}

interface RawCanonicalLibrary {
  library_version: string;
  exercises: RawCanonicalExercise[];
}

/**
 * Normalize cover image path from canonical format to web-friendly path.
 * Maps: ./images/foo_cover.jpg → /images/exercises/foo_cover.jpg
 */
function normalizeCoverPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const filename = raw.replace(/\\/g, '/').split('/').pop();
  if (!filename) return null;
  return `/images/exercises/${filename}`;
}

/**
 * Convert snake_case canonical structure to camelCase contracts.
 */
function toContractExercise(raw: RawCanonicalExercise): Exercise {
  return exerciseSchema.parse({
    exerciseId: raw.exercise_id,
    name: raw.name,
    nameEn: raw.name_en,
    muscleGroup: raw.muscle_group,
    difficulty: raw.difficulty,
    equipment: raw.equipment,
    function: raw.function,
    category: raw.category,
    targetProjects: raw.target_projects,
    contraindications: raw.contraindications,
    alternativeExerciseIds: raw.alternative_exercise_ids,
    restSeconds: raw.rest_seconds,
    steps: raw.steps,
    tips: raw.tips,
    warning: raw.warning,
    ...(raw.media
      ? {
          media: {
            coverImage: normalizeCoverPath(raw.media.cover_image),
            video: raw.media.video ?? null,
          },
        }
      : {}),
  });
}

export interface ExerciseLibrary {
  libraryVersion: string;
  exercises: Exercise[];
}

let cachedLibrary: ExerciseLibrary | undefined;

/**
 * Load and validate the canonical exercise library from JSON.
 * Filters only approved exercises and applies Zod validation.
 *
 * @param canonicalPath - Absolute path to canonical-exercise-library.json
 * @returns Validated exercise library with camelCase schema
 *
 * @throws {Error} If file not found or JSON invalid
 * @throws {z.ZodError} If any exercise fails contract validation
 */
export function loadExerciseLibrary(canonicalPath: string): ExerciseLibrary {
  if (cachedLibrary) return cachedLibrary;

  const raw = JSON.parse(readFileSync(canonicalPath, 'utf8')) as RawCanonicalLibrary;

  const exercises = raw.exercises
    .filter((item) => item.review_status === 'approved')
    .map((item) => toContractExercise(item));

  cachedLibrary = {
    libraryVersion: raw.library_version,
    exercises,
  };

  return cachedLibrary;
}

/**
 * Reset cache (for testing only).
 */
export function resetCache(): void {
  cachedLibrary = undefined;
}
