import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from './errorHandler.js';

export const AUTH_COOKIE = 'hlai_token';

export interface AuthTokenPayload {
  userId: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || 'homelearnai-development-default-jwt-secret-key-32chars!';
  return secret;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE] ?? extractBearerToken(req);
  if (!token) return next(new HttpError(401, 'unauthenticated'));

  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    req.userId = payload.userId;
    next();
  } catch {
    next(new HttpError(401, 'invalid_token'));
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}
