import { describe, expect, it, vi } from 'vitest';
import { requireCsrfHeader } from './csrf.js';

function mockReq(method: string, headers: Record<string, string> = {}) {
  return { method, headers } as any;
}

describe('requireCsrfHeader', () => {
  it('allows safe methods through without the header', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const next = vi.fn();
      requireCsrfHeader(mockReq(method), {} as any, next);
      expect(next).toHaveBeenCalledWith();
    }
  });

  it('rejects a mutating request missing the header', () => {
    const next = vi.fn();
    requireCsrfHeader(mockReq('POST'), {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
  });

  it('rejects a mutating request with the wrong header value', () => {
    const next = vi.fn();
    requireCsrfHeader(mockReq('POST', { 'x-requested-with': 'fetch' }), {} as any, next);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(403);
  });

  it('allows a mutating request with the correct header', () => {
    const next = vi.fn();
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) {
      const localNext = vi.fn();
      requireCsrfHeader(mockReq(method, { 'x-requested-with': 'XMLHttpRequest' }), {} as any, localNext);
      expect(localNext).toHaveBeenCalledWith();
    }
    expect(next).not.toHaveBeenCalled();
  });
});
