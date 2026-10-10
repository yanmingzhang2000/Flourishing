import fs from 'node:fs';
import {
  exerciseListResponseSchema,
  exerciseSchema,
  type Exercise,
  type ExerciseListResponse,
} from '@flourish/contracts';
import { Router, type Request, type Response } from 'express';
import { config } from '../../config';

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

function normalizeCoverPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const filename = raw.replace(/\\/g, '/').split('/').pop();
  if (!filename) return null;
  return `/images/exercises/${filename}`;
}

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
      ? { media: { coverImage: normalizeCoverPath(raw.media.cover_image), video: raw.media.video ?? null } }
      : {}),
  });
}

let cached: ExerciseListResponse | undefined;

export function loadExerciseLibrary(): ExerciseListResponse {
  if (cached) return cached;
  const raw = JSON.parse(fs.readFileSync(config.exerciseLibraryPath, 'utf8')) as RawCanonicalLibrary;
  const exercises = raw.exercises
    .filter((item) => item.review_status === 'approved')
    .map((item) => toContractExercise(item));
  const parsed = exerciseListResponseSchema.parse({
    libraryVersion: raw.library_version,
    exercises,
  });
  cached = parsed;
  return cached;
}

const exercisesRouter = Router();

exercisesRouter.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: loadExerciseLibrary() });
});

export { exercisesRouter };
