import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('users_created_at_idx').on(t.createdAt)],
);

export const userProfiles = sqliteTable('user_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  age: integer('age'),
  experienceLevel: text('experience_level'),
  targetMinutesPerSession: integer('target_minutes_per_session'),
  targetSessionsPerWeek: integer('target_sessions_per_week'),
  injuries: text('injuries', { mode: 'json' }).$type<string[]>().notNull(),
  // Nullable: legacy rows predate this column. Readers resolve null →
  // DEFAULT_AVAILABLE_EQUIPMENT (packages/contracts) so old data keeps working.
  availableEquipment: text('available_equipment', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const weeklyPlans = sqliteTable(
  'weekly_plans',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startDate: text('start_date').notNull(),
    status: text('status').notNull(),
    days: text('days', { mode: 'json' }).$type<unknown[]>().notNull(),
    libraryVersion: text('library_version').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('weekly_plans_user_start_date_idx').on(t.userId, t.startDate)],
);

export const trainingRecords = sqliteTable(
  'training_records',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekPlanId: text('week_plan_id')
      .notNull()
      .references(() => weeklyPlans.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull(),
    durationMinutes: integer('duration_minutes'),
    feedback: text('feedback'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('training_records_user_created_idx').on(t.userId, t.createdAt),
    index('training_records_user_completed_created_idx').on(t.userId, t.completed, t.createdAt),
  ],
);

export const projectInstances = sqliteTable(
  'project_instances',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id').notNull(),
    status: text('status').notNull(),
    startedAt: text('started_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('project_instances_user_status_idx').on(t.userId, t.status)],
);

export const copilotSessions = sqliteTable(
  'copilot_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('copilot_sessions_user_created_idx').on(t.userId, t.createdAt)],
);

export const copilotMessages = sqliteTable(
  'copilot_messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => copilotSessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('copilot_messages_session_created_idx').on(t.sessionId, t.createdAt)],
);
