import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

const DATA_DIR = path.join(__dirname, '../../../src/data');

function loadProjects() {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'projects.json'), 'utf-8'));
}

function loadExercises() {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'exercises.json'), 'utf-8'));
}

// 获取所有项目
router.get('/', (_req: Request, res: Response) => {
  return res.json(loadProjects());
});

// 获取单个项目
router.get('/:id', (req: Request, res: Response) => {
  const project = loadProjects().find((p: any) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  return res.json(project);
});

// 获取项目的动作库
router.get('/:id/exercises', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const all = loadExercises() as Record<string, unknown>;
  const exercises = all[id];
  if (!exercises) return res.status(404).json({ error: '动作库不存在' });
  return res.json(exercises);
});

export default router;
