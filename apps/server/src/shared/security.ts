import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ForbiddenError, UnauthorizedError } from './errors';

export interface AuthContext {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError());
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    if (typeof payload === 'string' || !payload.sub) {
      next(new UnauthorizedError('Invalid token payload'));
      return;
    }
    req.auth = { userId: payload.sub };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

/**
 * Optional authentication: sets `req.auth` when a valid Bearer token is
 * present; leaves it unset when the Authorization header is absent
 * (guest read path). A present-but-invalid token still 401s — a broken
 * token must not silently downgrade to guest data.
 */
export const optionalAuth: RequestHandler = (req, res, next) => {
  if (!req.header('authorization')) {
    next();
    return;
  }
  requireAuth(req, res, next);
};

export function requireUserId(req: Request): string {
  if (!req.auth) {
    throw new UnauthorizedError();
  }
  return req.auth.userId;
}

export function assertOwnership(resourceOwnerId: string, ctx: AuthContext): void {
  if (resourceOwnerId !== ctx.userId) {
    throw new ForbiddenError('You do not own this resource');
  }
}
