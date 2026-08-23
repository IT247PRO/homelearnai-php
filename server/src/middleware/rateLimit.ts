import rateLimit from 'express-rate-limit';

/** Slows brute-force credential guessing / password-reset enumeration without blocking
 * normal use — 20 attempts per 15 minutes per IP. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many attempts. Please try again later.' },
});

/** AI generation is the one place a runaway loop could rack up real provider cost — capped
 * per user (falls back to IP if unauthenticated) rather than per IP alone. */
export const aiGenerationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.userId ? `user:${req.userId}` : req.ip ?? 'unknown'),
  message: { error: 'too_many_requests', message: 'AI generation limit reached for this hour. Please try again later.' },
});
