import fs from 'fs';
import path from 'path';
import { CanonicalExerciseLibrary, MigrationReport } from './types';
import { validateLibrary } from './validator';

interface CliOptions {
  rootDir: string;
  libraryPath: string;
  migrationReportPath?: string;
  reportPath?: string;
}

function resolveFromRoot(rootDir: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseOptions(args: string[]): CliOptions {
  const rootDir = path.resolve(__dirname, '../../..');
  const libraryPath = resolveFromRoot(
    rootDir,
    valueAfter(args, '--library') || 'data/canonical-exercise-library.json',
  );
  const migrationReport = valueAfter(args, '--migration-report');
  const report = valueAfter(args, '--report');
  return {
    rootDir,
    libraryPath,
    migrationReportPath: migrationReport ? resolveFromRoot(rootDir, migrationReport) : undefined,
    reportPath: report ? resolveFromRoot(rootDir, report) : undefined,
  };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeReport(filePath: string, report: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function checkPublishedLibrary(options: CliOptions): ReturnType<typeof validateLibrary>['report'] {
  const library = readJson<CanonicalExerciseLibrary>(options.libraryPath);
  const migrationReport = options.migrationReportPath
    ? readJson<MigrationReport>(options.migrationReportPath)
    : undefined;
  const result = validateLibrary(library, migrationReport);

  if (options.reportPath) writeReport(options.reportPath, result.report);
  return result.report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = parseOptions(args);

  try {
    const report = checkPublishedLibrary(options);
    const failedRules = report.results.filter(result => result.outcome === 'failed').length;
    const blockingMigrationEntries = report.blocking_migration_entries.length;
    process.stdout.write(`${JSON.stringify({
      libraryPath: options.libraryPath,
      reportPath: options.reportPath || null,
      candidateId: report.candidate_id,
      exerciseCount: readJson<CanonicalExerciseLibrary>(options.libraryPath).exercises.length,
      failedRules,
      blockingMigrationEntries,
      publicationGate: report.publication_gate,
    })}\n`);
    process.exitCode = report.publication_gate === 'passed' ? 0 : 1;
  } catch (error) {
    process.stderr.write(`动作库校验失败: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
