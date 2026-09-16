import { Router, Request, Response } from 'express';
import { canonicalToClientExercise } from '../exercise-library/compatibility';
import { ExerciseLibraryService, PublishedLibraryUnavailableError } from '../exercise-library/service';

const router = Router();
const libraryService = new ExerciseLibraryService();

router.get('/:exerciseId', (req: Request, res: Response) => {
  try {
    const library = libraryService.load();
    const exercise = libraryService.getCurrentExercise(String(req.params.exerciseId));
    if (!exercise) return res.status(404).json({ error: '动作不存在' });
    return res.json(canonicalToClientExercise(exercise, library.library_version));
  } catch (error) {
    if (error instanceof PublishedLibraryUnavailableError) return res.status(503).json({ error: '动作库暂不可用', code: error.code });
    throw error;
  }
});

export default router;
