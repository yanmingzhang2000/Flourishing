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

  // 项目实例表（V2 新增）
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      start_date TEXT NOT NULL,
      target_weeks INTEGER NOT NULL DEFAULT 6,
      current_week INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Copilot 系统表 ─────────────────────────────────────────────────────
  db.exec(`
    -- Copilot 会话记录表
    CREATE TABLE IF NOT EXISTS copilot_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      intent TEXT NOT NULL,
      trigger_event TEXT,
      context_snapshot TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    );

    -- Copilot 消息记录表
    CREATE TABLE IF NOT EXISTS copilot_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT REFERENCES copilot_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Copilot 动作执行记录表
    CREATE TABLE IF NOT EXISTS copilot_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT REFERENCES copilot_sessions(id) ON DELETE CASCADE,
      message_id INTEGER REFERENCES copilot_messages(id) ON DELETE CASCADE,
      action_id TEXT NOT NULL,
      action_params TEXT,
      result TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Copilot 模板表
    CREATE TABLE IF NOT EXISTS copilot_templates (
      id TEXT PRIMARY KEY,
      intent TEXT NOT NULL,
      condition_expr TEXT,
      priority INTEGER DEFAULT 0,
      message_template TEXT NOT NULL,
      tone TEXT,
      actions TEXT,
      enabled INTEGER DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Copilot 知识库表（预留）
    CREATE TABLE IF NOT EXISTS copilot_knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      question_pattern TEXT,
      answer TEXT NOT NULL,
      sources TEXT,
      confidence_score REAL,
      embedding BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── 幂等列迁移：为已存在的数据库补加新列 ─────────────────────────────────
  // SQLite 不支持 ADD COLUMN IF NOT EXISTS，用 try/catch 代替。
  const migrations: string[] = [
    `ALTER TABLE user_profiles ADD COLUMN training_days TEXT DEFAULT NULL`,
    `ALTER TABLE user_profiles ADD COLUMN onboarding_completed INTEGER DEFAULT 0`,
    `ALTER TABLE user_profiles ADD COLUMN display_name TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN age INTEGER`,
    `ALTER TABLE user_profiles ADD COLUMN height REAL`,
    `ALTER TABLE user_profiles ADD COLUMN weight REAL`,
    `ALTER TABLE user_profiles ADD COLUMN bmi REAL`,
    `ALTER TABLE user_profiles ADD COLUMN experience TEXT`,
    `ALTER TABLE user_profiles ADD COLUMN injuries TEXT DEFAULT '[]'`,
    `ALTER TABLE user_profiles ADD COLUMN equipment TEXT DEFAULT '[]'`,
    `ALTER TABLE user_profiles ADD COLUMN selected_projects TEXT DEFAULT '[]'`,
    `ALTER TABLE user_profiles ADD COLUMN max_days_per_week INTEGER DEFAULT 3`,
    `ALTER TABLE user_profiles ADD COLUMN session_max_min INTEGER DEFAULT 30`,
    `ALTER TABLE user_profiles ADD COLUMN disabled_exercises TEXT DEFAULT '[]'`,
    `ALTER TABLE user_profiles ADD COLUMN copilot_settings TEXT DEFAULT '{}'`,
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // "duplicate column name" 是预期报错，忽略即可；其他错误重新抛出。
    }
  }

  console.log('Database initialized');
}

// 初始化 Copilot 模板（延迟导入避免循环依赖）
export async function initCopilotData() {
  const { initCopilotTemplates } = await import('../copilot/initTemplates');
  initCopilotTemplates();
}

export default db;
