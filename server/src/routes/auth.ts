import { Router } from 'express';
import type { CookieOptions } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AUTH_COOKIE, requireAuth, signAuthToken } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { issueAuthToken, consumeAuthToken } from '../lib/authToken.js';
import { sendEmail } from '../lib/emailStub.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

export const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(255),
});

router.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new HttpError(409, 'email_already_registered');

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        kidsModeSettings: { create: {} },
        familyAiSettings: { create: { aiEnabled: false } },
      },
    });

    res.cookie(AUTH_COOKIE, signAuthToken({ userId: user.id }), cookieOptions());
    res.status(201).json({ data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, 'invalid_credentials');
    }

    res.cookie(AUTH_COOKIE, signAuthToken({ userId: user.id }), cookieOptions());
    res.json({ data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.status(204).send();
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new HttpError(401, 'unauthenticated');
    res.json({ data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

const SUPPORTED_LOCALES = ['en', 'es'] as const;
const updateMeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  timezone: z.string().max(50).optional(),
  regionFormat: z.enum(['us', 'eu']).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  weekStart: z.enum(['sunday', 'monday']).optional(),
  dateFormatType: z.enum(['us', 'eu']).optional(),
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const body = updateMeSchema.parse(req.body);

    if (body.email) {
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing && existing.id !== req.userId) throw new HttpError(409, 'email_already_registered');
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { ...body, emailVerifiedAt: body.email ? null : undefined },
    });
    res.json({ data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(255),
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(401, 'incorrect_current_password');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const deleteMeSchema = z.object({ password: z.string().min(1) });

router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const { password } = deleteMeSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, 'incorrect_password');
    }
    await prisma.user.delete({ where: { id: req.userId } });
    res.clearCookie(AUTH_COOKIE);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const forgotPasswordSchema = z.object({ email: z.string().email() });

// Always responds 204 whether or not the email is registered — otherwise this endpoint
// becomes a way to enumerate which emails have an account.
router.post('/forgot-password', authRateLimiter, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = await issueAuthToken(user.id, 'password_reset');
      const resetLink = `${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: 'Reset your HomeLearnAI password',
        body: `Click the link below to reset your password (expires in 1 hour):\n\n${resetLink}`,
      });
    }

    // Identical response whether or not the email was registered, and regardless of
    // environment — the dev hint must not leak which emails have an account.
    const devNote =
      process.env.NODE_ENV === 'production' ? null : 'No email provider is configured — if this address has an account, check the server console for the reset link.';
    res.status(202).json({ data: { note: devNote } });
  } catch (err) {
    next(err);
  }
});

const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8).max(255) });

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const record = await consumeAuthToken(token, 'password_reset');
    if (!record) throw new HttpError(400, 'invalid_or_expired_token');

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/verify-email/request', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
    if (user.emailVerifiedAt) {
      res.status(204).send();
      return;
    }

    const token = await issueAuthToken(user.id, 'email_verification');
    const verifyLink = `${process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'}/verify-email?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify your HomeLearnAI email',
      body: `Click the link below to verify your email (expires in 24 hours):\n\n${verifyLink}`,
    });
    res.status(202).send();
  } catch (err) {
    next(err);
  }
});

const verifyEmailSchema = z.object({ token: z.string().min(1) });

router.post('/verify-email/confirm', async (req, res, next) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    const record = await consumeAuthToken(token, 'email_verification');
    if (!record) throw new HttpError(400, 'invalid_or_expired_token');

    const user = await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    res.json({ data: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function toPublicUser(user: {
  id: number;
  name: string;
  email: string;
  locale: string;
  timezone: string;
  regionFormat: string;
  timeFormat: string;
  weekStart: string;
  dateFormatType: string;
  emailVerifiedAt: Date | null;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    locale: user.locale,
    timezone: user.timezone,
    regionFormat: user.regionFormat,
    timeFormat: user.timeFormat,
    weekStart: user.weekStart,
    dateFormatType: user.dateFormatType,
    emailVerified: Boolean(user.emailVerifiedAt),
    onboardingCompleted: user.onboardingCompleted,
    onboardingSkipped: user.onboardingSkipped,
  };
}
