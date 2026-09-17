import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

/** 列出当前用户所有项目实例 */
router.get('/', (req: AuthRequest, res: Response) => {
  const rows = db.prepare(
    `SELECT * FROM project_instances WHERE user_id = ? ORDER BY created_at DESC`
  ).all(req.userId) as any[];

  return res.json(rows.map(r => ({
    id: String(r.id),
    projectId: r.project_id,
    status: r.status,
    startDate: r.start_date,
    targetWeeks: r.target_weeks,
    currentWeek: r.current_week,
    createdAt: r.created_at,
  })));
});

/** 创建新项目实例 */
router.post('/', (req: AuthRequest, res: Response) => {
  const { projectId, targetWeeks, startDate } = req.body;

  if (!projectId) return res.status(400).json({ error: '缺少 projectId' });
  if (![4, 6, 8].includes(targetWeeks)) return res.status(400).json({ error: 'targetWeeks 必须是 4、6 或 8' });

  const start = startDate || new Date().toISOString().split('T')[0];

  // 同一项目只能有一个 active 实例
  const existing = db.prepare(
    `SELECT id FROM project_instances WHERE user_id = ? AND project_id = ? AND status = 'active'`
  ).get(req.userId, projectId) as any;

  if (existing) {
    return res.status(409).json({ error: '该项目已有进行中的训练，请先完成或暂停后再添加' });
  }

  const result = db.prepare(
    `INSERT INTO project_instances (user_id, project_id, status, start_date, target_weeks, current_week)
     VALUES (?, ?, 'active', ?, ?, 1)`
  ).run(req.userId, projectId, start, targetWeeks);

  const newRow = db.prepare('SELECT * FROM project_instances WHERE id = ?').get(result.lastInsertRowid) as any;

  return res.status(201).json({
    id: String(newRow.id),
    projectId: newRow.project_id,
    status: newRow.status,
    startDate: newRow.start_date,
    targetWeeks: newRow.target_weeks,
    currentWeek: newRow.current_week,
    createdAt: newRow.created_at,
  });
});

/** 更新项目实例（状态变更 / 当前周推进） */
router.put('/:id', (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.id as string);
  const { status, currentWeek } = req.body;

  const row = db.prepare(
    `SELECT * FROM project_instances WHERE id = ? AND user_id = ?`
  ).get(instanceId, req.userId) as any;

  if (!row) return res.status(404).json({ error: '项目实例不存在' });

  const allowedStatuses = ['active', 'paused', 'completed'];
  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'status 无效' });
  }

  db.prepare(
    `UPDATE project_instances SET
       status = COALESCE(?, status),
       current_week = COALESCE(?, current_week)
     WHERE id = ? AND user_id = ?`
  ).run(status ?? null, currentWeek ?? null, instanceId, req.userId);

  const updated = db.prepare('SELECT * FROM project_instances WHERE id = ?').get(instanceId) as any;

  return res.json({
    id: String(updated.id),
    projectId: updated.project_id,
    status: updated.status,
    startDate: updated.start_date,
    targetWeeks: updated.target_weeks,
    currentWeek: updated.current_week,
    createdAt: updated.created_at,
  });
});

/** 删除项目实例 */
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const instanceId = parseInt(req.params.id as string);

  const row = db.prepare(
    `SELECT id FROM project_instances WHERE id = ? AND user_id = ?`
  ).get(instanceId, req.userId) as any;

  if (!row) return res.status(404).json({ error: '项目实例不存在' });

  db.prepare(`DELETE FROM project_instances WHERE id = ?`).run(instanceId);

  return res.json({ ok: true });
});

export default router;
