import path from 'node:path';

const isProduction = process.env['NODE_ENV'] === 'production';

function resolveDatabasePath(): string {
  const override = process.env['DATABASE_PATH'];
  if (override) return path.resolve(override);
  return path.resolve(process.cwd(), 'data', 'flourish.db');
}

export const config = {
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  isProduction,
  port: Number(process.env['PORT'] ?? 3001),
  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-only-insecure-secret',
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  databasePath: resolveDatabasePath(),
};

export const DEV_JWT_SECRET = 'dev-only-insecure-secret';
