import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Lightweight CSRF defense for a cookie-based JWT session: a cross-site `<form>` POST or
 * simple cross-origin fetch can carry the browser's cookies automatically, but it cannot
 * set a custom header on a "simple" request without triggering a CORS preflight this API's
 * `cors()` config would reject anyway — so requiring this header on every mutating request
 * rules out the classic form-based CSRF vector without a double-submit-token scheme.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return next(new HttpError(403, 'missing_csrf_header'));
  }
  next();
}
