import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 获取用户档案
router.get('/profile', (req: AuthRequest, res: Response) => {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId) as Record<string, unknown> | undefined;
  if (!profile) return res.json(null);

  // training_days は JSON 配列 or null
  let trainingDays: number[] | null = null;
  try {
    const raw = profile.training_days;
    if (typeof raw === 'string' && raw) trainingDays = JSON.parse(raw) as number[];
  } catch { /* 旧行 null → 保持 null */ }

  return res.json({
    ...profile,
    injuries: JSON.parse((profile.injuries as string) || '[]'),
    equipment: JSON.parse((profile.equipment as string) || '[]'),
    selected_projects: JSON.parse((profile.selected_projects as string) || '[]'),
    training_days: trainingDays,
  });
});

// 更新用户档案
router.put('/profile', (req: AuthRequest, res: Response) => {
  const {
    display_name, age,
    height, weight,
    experience, injuries, equipment, selected_projects,
    max_days_per_week, session_max_min,
    training_days,
  } = req.body as Record<string, unknown>;

  const bmi = height && weight
    ? Number((Number(weight) / ((Number(height) / 100) ** 2)).toFixed(1))
    : null;

  // Validate training_days: must be an array of 0-6 integers if provided.
  let trainingDaysJson: string | null = null;
  if (training_days !== undefined && training_days !== null) {
    if (
      Array.isArray(training_days) &&
      training_days.every((v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6)
    ) {
      trainingDaysJson = JSON.stringify(training_days);
    } else {
      return res.status(400).json({ error: 'training_days 格式无效，需为 0-6 的整数数组' });
    }
  }

  const existing = db.prepare('SELECT id FROM user_profiles WHERE user_id = ?').get(req.userId);

  if (existing) {
    db.prepare(`
      UPDATE user_profiles SET
        display_name = COALESCE(?, display_name),
        age = COALESCE(?, age),
        height = COALESCE(?, height),
        weight = COALESCE(?, weight),
        bmi = COALESCE(?, bmi),
        experience = COALESCE(?, experience),
        injuries = COALESCE(?, injuries),
        equipment = COALESCE(?, equipment),
        selected_projects = COALESCE(?, selected_projects),
        max_days_per_week = COALESCE(?, max_days_per_week),
        session_max_min = COALESCE(?, session_max_min),
        training_days = COALESCE(?, training_days),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      display_name ?? null,
      age ?? null,
      height ?? null,
      weight ?? null,
      bmi ?? null,
      experience ?? null,
      injuries !== undefined ? JSON.stringify(injuries) : null,
      equipment !== undefined ? JSON.stringify(equipment) : null,
      selected_projects !== undefined ? JSON.stringify(selected_projects) : null,
      max_days_per_week ?? null,
      session_max_min ?? null,
      trainingDaysJson,
      req.userId,
    );
  } else {
    db.prepare(`
      INSERT INTO user_profiles
        (user_id, display_name, age, height, weight, bmi, experience, injuries, equipment,
         selected_projects, max_days_per_week, session_max_min, training_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      display_name ?? null,
      age ?? null,
      height ?? null,
      weight ?? null,
      bmi ?? null,
      experience ?? null,
      JSON.stringify(injuries || []),
      JSON.stringify(equipment || []),
      JSON.stringify(selected_projects || []),
      max_days_per_week ?? 3,
      session_max_min ?? 30,
      trainingDaysJson,
    );
  }

  return res.json({ ok: true });
});

export default router;
