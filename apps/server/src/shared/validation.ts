import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from './errors';

function toDetails(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

export function validateBody(schema: ZodType): RequestHandler {
  return (req: Request, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError('Request validation failed', toDetails(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (req: Request, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ValidationError('Parameter validation failed', toDetails(result.error)));
      return;
    }
    req.params = result.data as Record<string, string>;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req: Request, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError('Query validation failed', toDetails(result.error)));
      return;
    }
    next();
  };
}
