import fs from 'fs';
import path from 'path';
import {
  CanonicalExercise,
  CanonicalExerciseLibrary,
  LibraryValidationReport,
  MigrationReport,
} from './types';
import { validateLibrary } from './validator';

/** Error returned when no valid Published_Library is available. */
export class PublishedLibraryUnavailableError extends Error {
  readonly code = 'published_library_unavailable';

  constructor(message = '动作库暂不可用') {
    super(message);
    this.name = 'PublishedLibraryUnavailableError';
  }
}

export interface PublicationResult {
  published: boolean;
  report: LibraryValidationReport;
}

/**
 * Freeze parsed JSON recursively so callers cannot mutate the runtime snapshot
 * used by plan generation and current-content consumers.
 */
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(freezeDeep);
  }
  return value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function defaultPublishedPath(): string {
  return path.join(__dirname, '../../../data/canonical-exercise-library.json');
}

/**
 * Runtime access to the sole published exercise library.
 *
 * The path argument is intentionally injectable for the migration CLI and
 * isolated tests. Runtime callers use the default canonical path; this class
 * never falls back to either legacy exercise JSON source.
 */
export class ExerciseLibraryService {
  private readonly publishedPath: string;
  private cached: Readonly<CanonicalExerciseLibrary> | null = null;
  private cachedReport: Readonly<LibraryValidationReport> | null = null;

  constructor(publishedPath = defaultPublishedPath()) {
    this.publishedPath = publishedPath;
  }

  get path(): string {
    return this.publishedPath;
  }

  /** Load the cached valid Published_Library, or validate it on first access. */
  load(): Readonly<CanonicalExerciseLibrary> {
    return this.cached || this.reload();
  }

  /**
   * Reload the published file. A bad reload never evicts a previously valid
   * snapshot; an invalid first load fails with the stable service error code.
   */
  reload(): Readonly<CanonicalExerciseLibrary> {
    let parsed: CanonicalExerciseLibrary;
    try {
      parsed = JSON.parse(fs.readFileSync(this.publishedPath, 'utf8')) as CanonicalExerciseLibrary;
    } catch (error) {
      return this.retainOrThrow(error instanceof Error ? error.message : '读取失败');
    }

    let validated: ReturnType<typeof validateLibrary>;
    try {
      validated = validateLibrary(parsed);
    } catch (error) {
      return this.retainOrThrow(error instanceof Error ? error.message : '校验失败');
    }

    if (validated.report.publication_gate !== 'passed') {
      return this.retainOrThrow('published library validation failed');
    }

    const library = freezeDeep(validated.library);
    const report = freezeDeep(validated.report);
    this.cached = library;
    this.cachedReport = report;
    return library;
  }

  getValidationReport(): LibraryValidationReport | null {
    return this.cachedReport;
  }

  /** Return only approved records from the currently cached Published_Library. */
  getApprovedExercises(): readonly CanonicalExercise[] {
    return this.load().exercises.filter(exercise => exercise.review_status === 'approved');
  }

  /** Return current approved content, never deprecated or otherwise unapproved records. */
  getCurrentExercise(exerciseId: string): CanonicalExercise | null {
    return this.getApprovedExercises().find(exercise => exercise.exercise_id === exerciseId) || null;
  }

  /** Return current approved content targeted at a project. */
  getProjectExercises(projectId: string): CanonicalExercise[] {
    return this.getApprovedExercises().filter(exercise => exercise.target_projects.includes(projectId as CanonicalExercise['target_projects'][number]));
  }

  /**
   * Validate and atomically publish a candidate. Validation evidence is written
   * before the gate is evaluated. A failed gate leaves the published file and
   * the in-memory snapshot untouched.
   */
  publishCandidate(candidatePath: string, migrationReport?: MigrationReport): PublicationResult {
    let candidate: CanonicalExerciseLibrary;
    try {
      candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8')) as CanonicalExerciseLibrary;
    } catch (error) {
      throw new PublishedLibraryUnavailableError(`候选动作库读取失败: ${error instanceof Error ? error.message : '读取失败'}`);
    }

    const validated = validateLibrary(candidate, migrationReport);
    const report = validated.report;
    const reportId = isNonEmptyString(report.candidate_id) ? report.candidate_id : 'unknown';
    const reportPath = path.join(path.dirname(this.publishedPath), 'exercise-library-reports', `${reportId}.validation.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const migrationBlocked = Boolean(migrationReport?.blocking) || report.blocking_migration_entries.length > 0;
    if (report.publication_gate !== 'passed' || migrationBlocked) {
      return { published: false, report };
    }

    const publishedDirectory = path.dirname(this.publishedPath);
    fs.mkdirSync(publishedDirectory, { recursive: true });
    const temporaryPath = path.join(
      publishedDirectory,
      `.${path.basename(this.publishedPath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
    );

    try {
      fs.writeFileSync(temporaryPath, `${JSON.stringify(validated.library, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      // renameSync replaces the destination as one filesystem operation, so
      // consumers observe either the old complete file or the new complete file.
      fs.renameSync(temporaryPath, this.publishedPath);
    } catch (error) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch {
        // The temporary file may already have been renamed before an error was
        // surfaced. The original publication state remains the cache of record.
      }
      throw error;
    }

    this.cached = freezeDeep(validated.library);
    this.cachedReport = freezeDeep(report);
    return { published: true, report };
  }

  private retainOrThrow(reason: string): Readonly<CanonicalExerciseLibrary> {
    if (this.cached) return this.cached;
    throw new PublishedLibraryUnavailableError(`动作库暂不可用: ${reason}`);
  }
}

export const exerciseLibraryService = new ExerciseLibraryService();
