import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { config } from '../config';

let db: BetterSQLite3Database | undefined;
let sqlite: Database.Database | undefined;

export function getDb(): BetterSQLite3Database {
  if (!db) {
    fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
    sqlite = new Database(config.databasePath);
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
  }
  return db;
}

export function closeDb(): void {
  sqlite?.close();
  sqlite = undefined;
  db = undefined;
}
