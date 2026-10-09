import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { config } from './config';
import { authRouter } from './modules/auth';
import { copilotRouter } from './modules/copilot';
import { exercisesRouter } from './modules/exercises';
import { plansRouter } from './modules/plans';
import { recordsRouter } from './modules/records';
import { usersRouter } from './modules/users';
import { workoutsRouter } from './modules/workouts';
import { errorHandler, notFoundHandler } from './shared/errorHandler';

function healthHandler(_req: Request, res: Response): void {
  res.json({
    success: true,
    data: {
      status: 'ok',
      version: process.env['APP_VERSION'] ?? '0.1.0',
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
}

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/exercises', exercisesRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/copilot', copilotRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
