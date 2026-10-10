import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from '../config';

export function runMigrations(): void {
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  const sqlite = new Database(config.databasePath);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'migrations_applied',
      databasePath: config.databasePath,
    }),
  );
  sqlite.close();
}

if (require.main === module) {
  runMigrations();
}
