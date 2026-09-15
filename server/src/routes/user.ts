import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 获取用户档案
router.get('/profile', (req: AuthRequest, res: Response) => {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId) as any;
  if (!profile) return res.json(null);

  return res.json({
    ...profile,
    injuries: JSON.parse(profile.injuries || '[]'),
    equipment: JSON.parse(profile.equipment || '[]'),
    selected_projects: JSON.parse(profile.selected_projects || '[]'),
  });
});

// 更新用户档案
router.put('/profile', (req: AuthRequest, res: Response) => {
  const { height, weight, experience, injuries, equipment, selected_projects, max_days_per_week, session_max_min } = req.body;

  const bmi = height && weight ? Number((weight / ((height / 100) ** 2)).toFixed(1)) : null;

  const existing = db.prepare('SELECT id FROM user_profiles WHERE user_id = ?').get(req.userId);

  if (existing) {
    db.prepare(`
      UPDATE user_profiles SET
        height = ?, weight = ?, bmi = ?, experience = ?,
        injuries = ?, equipment = ?, selected_projects = ?,
        max_days_per_week = ?, session_max_min = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      height, weight, bmi, experience,
      JSON.stringify(injuries || []),
      JSON.stringify(equipment || []),
      JSON.stringify(selected_projects || []),
      max_days_per_week, session_max_min,
      req.userId
    );
  } else {
    db.prepare(`
      INSERT INTO user_profiles
        (user_id, height, weight, bmi, experience, injuries, equipment, selected_projects, max_days_per_week, session_max_min)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId, height, weight, bmi, experience,
      JSON.stringify(injuries || []),
      JSON.stringify(equipment || []),
      JSON.stringify(selected_projects || []),
      max_days_per_week, session_max_min
    );
  }

  return res.json({ ok: true });
});

export default router;
