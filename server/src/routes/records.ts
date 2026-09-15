import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 提交训练记录
router.post('/', (req: AuthRequest, res: Response) => {
  const { date, dayIndex, weekPlanId, completed, feedback, hasJointPain, completedExercises } = req.body;

  const result = db.prepare(`
    INSERT INTO training_records
      (user_id, date, day_index, week_plan_id, completed, feedback, has_joint_pain, completed_exercises)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.userId,
    date,
    dayIndex,
    weekPlanId,
    completed ? 1 : 0,
    feedback || null,
    hasJointPain ? 1 : 0,
    JSON.stringify(completedExercises || [])
  );

  return res.json({ id: result.lastInsertRowid });
});

// 获取训练记录
router.get('/', (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 30;
  const records = db.prepare(`
    SELECT * FROM training_records
    WHERE user_id = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(req.userId, limit) as any[];

  return res.json(records.map(r => ({
    ...r,
    completed: !!r.completed,
    has_joint_pain: !!r.has_joint_pain,
    completed_exercises: JSON.parse(r.completed_exercises || '[]')
  })));
});

// 获取统计数据
router.get('/stats', (req: AuthRequest, res: Response) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM training_records WHERE user_id = ? AND completed = 1').get(req.userId) as any;
  const recent = db.prepare(`
    SELECT date FROM training_records
    WHERE user_id = ? AND completed = 1
    ORDER BY date DESC
    LIMIT 30
  `).all(req.userId) as any[];

  const completedDays = recent.map(r => r.date);

  // 计算连续天数
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const dates = [...new Set(completedDays)].sort().reverse();
  
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (dates[i] === expected.toISOString().split('T')[0]) {
      streak++;
    } else {
      break;
    }
  }

  return res.json({
    totalWorkouts: total.count,
    currentStreak: streak,
    completedDays
  });
});

export default router;
