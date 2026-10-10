import fs from 'node:fs';
import path from 'node:path';

const isProduction = process.env['NODE_ENV'] === 'production';

function findRepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Cannot locate repo root (pnpm-workspace.yaml not found)');
}

function resolveDatabasePath(): string {
  const override = process.env['DATABASE_PATH'];
  if (override) return path.resolve(override);
  return path.resolve(process.cwd(), 'data', 'flourish.db');
}

const repoRoot = findRepoRoot();

export const config = {
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  isProduction,
  port: Number(process.env['PORT'] ?? 3001),
  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-only-insecure-secret',
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  databasePath: resolveDatabasePath(),
  exerciseLibraryPath: path.join(
    repoRoot,
    'data',
    'exercise-library',
    'canonical-exercise-library.json',
  ),
  repoRoot,
};

export const DEV_JWT_SECRET = 'dev-only-insecure-secret';
