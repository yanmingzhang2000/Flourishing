import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { canonicalToClientExercise } from '../exercise-library/compatibility';
import { ExerciseLibraryService, PublishedLibraryUnavailableError } from '../exercise-library/service';

const router = Router();
const projectDataPath = path.join(__dirname, '../../../src/data/projects.json');
const libraryService = new ExerciseLibraryService();

function loadProjects() { return JSON.parse(fs.readFileSync(projectDataPath, 'utf8')) as unknown[]; }
function currentContent(projectId: string) {
  const library = libraryService.load();
  const records = libraryService.getProjectExercises(projectId);
  return {
    warmup: records.filter(exercise => exercise.category === 'warmup').map(exercise => canonicalToClientExercise(exercise, library.library_version, { sets: 1, reps: 10 })),
    exercises: records.filter(exercise => exercise.category === 'strength' || exercise.category === 'cardio').map(exercise => canonicalToClientExercise(exercise, library.library_version)),
    cooldown: records.filter(exercise => exercise.category === 'stretch').map(exercise => canonicalToClientExercise(exercise, library.library_version, { sets: 1, reps: 10 })),
  };
}

router.get('/', (_req: Request, res: Response) => res.json(loadProjects()));
router.get('/:id', (req: Request, res: Response) => {
  const project = loadProjects().find((item: any) => item.id === req.params.id);
  if (!project) return res.status(404).json({ error: '项目不存在' });
  return res.json(project);
});
router.get('/:id/exercises', (req: Request, res: Response) => {
  try {
    const content = currentContent(String(req.params.id));
    if (!content.warmup.length && !content.exercises.length && !content.cooldown.length) return res.status(404).json({ error: '动作库不存在' });
    return res.json(content);
  } catch (error) {
    if (error instanceof PublishedLibraryUnavailableError) return res.status(503).json({ error: '动作库暂不可用', code: error.code });
    throw error;
  }
});

export default router;
