import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from './errorHandler.js';

export const KIDS_COOKIE = 'hlai_kids_session';

export interface KidsSessionPayload {
  parentUserId: number;
  childId: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      kidsSession?: KidsSessionPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

// Short-lived on purpose: this is a "device is handed to the child" session layered on top
// of (not replacing) the parent's own auth cookie, so the parent context can safely resume
// once the child exits Kids Mode.
export function signKidsToken(payload: KidsSessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '12h' });
}

export function requireKidsModeContext(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[KIDS_COOKIE];
  if (!token) return next(new HttpError(401, 'kids_mode_not_active'));

  try {
    req.kidsSession = jwt.verify(token, getJwtSecret()) as KidsSessionPayload;
    next();
  } catch {
    next(new HttpError(401, 'kids_mode_not_active'));
  }
}

/** Confirms the :childId route param matches the child locked into this kids session. */
export function requireKidsModeChildMatch(paramName = 'childId') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const routeChildId = Number(req.params[paramName]);
    if (!req.kidsSession || routeChildId !== req.kidsSession.childId) {
      return next(new HttpError(404, 'not_found'));
    }
    next();
  };
}
