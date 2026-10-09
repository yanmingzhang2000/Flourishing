import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, NotFoundError } from './errors';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route not found'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({
      success: false,
      error: { code: 'invalid_json', message: 'Malformed JSON request body' },
    });
    return;
  }

  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'unhandled_error',
      name: err instanceof Error ? err.name : 'unknown',
      message: err instanceof Error ? err.message : String(err),
    }),
  );

  res.status(500).json({
    success: false,
    error: { code: 'internal_error', message: 'Internal server error' },
  });
};
