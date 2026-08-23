import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  // Required by the server's CSRF defense (see server/src/middleware/csrf.ts) on every
  // mutating request — a cross-site form/simple-request CSRF attempt can't set this.
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

export interface ApiErrorBody {
  error: string;
  message?: string;
  details?: unknown;
  generationId?: number;
}

export function apiErrorBody(err: unknown): ApiErrorBody | null {
  if (axios.isAxiosError(err) && err.response?.data) {
    return err.response.data as ApiErrorBody;
  }
  return null;
}
