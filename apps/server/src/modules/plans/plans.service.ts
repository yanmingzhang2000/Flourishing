/**
 * Plan generation and management service.
 *
 * Orchestrates:
 * - Exercise library loading and caching
 * - User profile validation
 * - Calling training-domain generatePlanDays()
 * - Converting domain output to contract format (ExerciseSnapshot, PlanDay)
 * - Storing plan in database
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  type ExerciseSnapshot,
  type GeneratePlanInput,
  type PlanDay,
  type WeeklyPlan,
} from '@flourish/contracts';
import { exercises, generator } from '@flourish/training-domain';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { userProfiles, weeklyPlans } from '../../db/schema';
import { AppError } from '../../shared/errors';

/**
 * Exercise library cache (global, persistent across requests).
 * Loaded once and reused.
 */
let cachedLibrary: ReturnType<typeof exercises.loadExerciseLibrary> | undefined;

/**
 * Load exercise library (cached).
 * Falls back to canonical path if not provided.
 */
function getExerciseLibrary(
  canonicalPath?: string,
): ReturnType<typeof exercises.loadExerciseLibrary> {
  if (cachedLibrary) return cachedLibrary;

  const libPath =
    canonicalPath ||
    path.resolve(__dirname, '../../../../../data/exercise-library/canonical-exercise-library.json');

  cachedLibrary = exercises.loadExerciseLibrary(libPath);
  return cachedLibrary;
}

/**
 * Convert a PlannedExercise from training-domain into an ExerciseSnapshot
 * for the contract layer.
 *
 * ExerciseSnapshot requires:
 *   - exerciseId, name, sets, reps, durationSeconds, restSeconds, difficulty, warning, libraryVersion
 *
 * PlannedExercise provides:
 *   - exercise (Exercise), sets, reps (string), restSeconds
 *
 * We compute durationSeconds from the exercise's category/difficulty/sets/reps
 * (rough estimate: 30s per rep + rest seconds).
 */
function toExerciseSnapshot(
  planned: ReturnType<typeof generator.generatePlanDays>['trainingDays'][0]['exercises'][0],
  libraryVersion: string,
): ExerciseSnapshot {
  const { exercise, sets, reps, restSeconds } = planned;

  // Rough time estimate per exercise: (reps * 2 seconds) per set + rest
  // For a range like "8-12", take midpoint (10) as representative.
  const repsStr = reps.split('-')[0];
  const repsNum = Number(repsStr) || 10;
  const durationPerSet = repsNum * 2; // 2 seconds per rep
  const durationSeconds = (durationPerSet + restSeconds) * sets;

  return {
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    sets,
    reps,
    durationSeconds,
    restSeconds,
    difficulty: exercise.difficulty,
    warning: exercise.warning,
    libraryVersion,
  };
}

/**
 * Convert training-domain GeneratedPlanDay into contract PlanDay.
 */
function toPlanDay(
  generatedDay: ReturnType<typeof generator.generatePlanDays>['trainingDays'][0],
  libraryVersion: string,
): PlanDay {
  return {
    date: generatedDay.date,
    exercises: generatedDay.exercises.map((planned) => toExerciseSnapshot(planned, libraryVersion)),
    estimatedDurationMinutes: generatedDay.estimatedDurationMinutes,
  };
}

/**
 * Generate a new training plan.
 *
 * @param userId - User ID
 * @param input - GeneratePlanInput (startDate, targetProjects, trainingDays, optional targetMinutesPerSession)
 * @returns Generated WeeklyPlan (with infrastructure fields: id, userId, createdAt, status)
 *
 * @throws AppError if user profile not found, or if plan generation fails
 */
export function generatePlan(userId: string, input: GeneratePlanInput): WeeklyPlan {
  const db = getDb();

  // Load user profile
  const profile = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();

  if (!profile) {
    throw new AppError(400, 'profile_not_found', 'User profile not found. Complete your profile first.');
  }

  // Load exercise library
  const library = getExerciseLibrary();

  // Map injury strings to training-domain format (already stored as JSON in DB)
  const injuryTags = profile.injuries || [];

  // Null = legacy row predating the column → contract default
  // (bodyweight + mat, see DEFAULT_AVAILABLE_EQUIPMENT).
  const availableEquipment = profile.availableEquipment ?? [...DEFAULT_AVAILABLE_EQUIPMENT];

  // Call training-domain generator
  const result = generator.generatePlanDays({
    exercisePool: library.exercises,
    startDate: input.startDate,
    trainingDays: input.trainingDays,
    targetProjects: input.targetProjects,
    availableEquipment,
    injuryTags,
    experienceLevel: (profile.experienceLevel as any) || null,
  });

  if (result.trainingDays.length === 0) {
    throw new AppError(
      400,
      'plan_generation_failed',
      'Could not generate a valid plan. Try different settings.',
    );
  }

  // Convert to contract format
  const planDays: PlanDay[] = result.trainingDays.map((day) => toPlanDay(day, library.libraryVersion));

  const now = new Date();
  const planId = randomUUID();

  // Store in database
  db.insert(weeklyPlans)
    .values({
      id: planId,
      userId,
      startDate: input.startDate,
      status: 'active',
      days: planDays,
      libraryVersion: library.libraryVersion,
      createdAt: Math.floor(now.getTime() / 1000),
    })
    .run();

  // Return the generated plan as a WeeklyPlan contract object
  const plan: WeeklyPlan = {
    id: planId,
    userId,
    startDate: input.startDate,
    status: 'active',
    days: planDays,
    libraryVersion: library.libraryVersion,
    createdAt: now.toISOString(),
  };

  return plan;
}

/**
 * Clear the exercise library cache (for testing purposes).
 */
export function resetLibraryCache(): void {
  cachedLibrary = undefined;
}
