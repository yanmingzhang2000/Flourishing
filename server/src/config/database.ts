import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'flourish.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// 开启 WAL 模式，提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDB() {
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      is_guest INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 用户档案
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT,
      age INTEGER,
      height REAL,
      weight REAL,
      bmi REAL,
      experience TEXT,
      injuries TEXT DEFAULT '[]',
      equipment TEXT DEFAULT '[]',
      selected_projects TEXT DEFAULT '[]',
      max_days_per_week INTEGER DEFAULT 3,
      session_max_min INTEGER DEFAULT 30,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 周训练计划
    CREATE TABLE IF NOT EXISTS weekly_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      week_number INTEGER DEFAULT 1,
      start_date TEXT,
      days TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 训练记录
    CREATE TABLE IF NOT EXISTS training_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date TEXT,
      day_index INTEGER,
      week_plan_id INTEGER REFERENCES weekly_plans(id),
      completed INTEGER DEFAULT 0,
      feedback TEXT,
      has_joint_pain INTEGER DEFAULT 0,
      completed_exercises TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Database initialized');
}

export default db;
