import { Router } from 'express';
import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateSalt, hashPin, verifyPin, lockoutMinutesForAttempt } from '../lib/pin.js';
import { KIDS_COOKIE, signKidsToken } from '../middleware/kidsMode.js';

/** Mounted at /kids-mode (parent-authenticated: settings + entering/exiting the mode) */
export const router = Router();

function kidsCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
  };
}

router.get('/settings', requireAuth, async (req, res, next) => {
  try {
    const settings = await prisma.kidsModeSettings.findUniqueOrThrow({ where: { userId: req.userId! } });
    res.json({
      data: {
        hasPinSetup: Boolean(settings.pinHash),
        isLocked: Boolean(settings.lockedUntil && settings.lockedUntil > new Date()),
        lockedUntil: settings.lockedUntil,
      },
    });
  } catch (err) {
    next(err);
  }
});

const setPinSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits') });

router.post('/pin', requireAuth, async (req, res, next) => {
  try {
    const { pin } = setPinSchema.parse(req.body);
    const salt = generateSalt();
    const pinHash = await hashPin(pin, salt);
    await prisma.kidsModeSettings.update({
      where: { userId: req.userId! },
      data: { pinHash, pinSalt: salt, failedAttempts: 0, lockedUntil: null },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/reset-pin', requireAuth, async (req, res, next) => {
  try {
    await prisma.kidsModeSettings.update({
      where: { userId: req.userId! },
      data: { pinHash: null, pinSalt: null, failedAttempts: 0, lockedUntil: null },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const enterSchema = z.object({ pin: z.string().min(1) });

router.post('/:childId/enter', requireAuth, requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const { pin } = enterSchema.parse(req.body);
    const childId = Number(req.params.childId);
    const settings = await prisma.kidsModeSettings.findUniqueOrThrow({ where: { userId: req.userId! } });

    if (!settings.pinHash || !settings.pinSalt) throw new HttpError(400, 'pin_not_configured');
    if (settings.lockedUntil && settings.lockedUntil > new Date()) {
      throw new HttpError(423, 'pin_locked');
    }

    const valid = await verifyPin(pin, settings.pinSalt, settings.pinHash);
    if (!valid) {
      const failedAttempts = settings.failedAttempts + 1;
      const lockoutMinutes = lockoutMinutesForAttempt(failedAttempts);
      await prisma.kidsModeSettings.update({
        where: { userId: req.userId! },
        data: {
          failedAttempts,
          lockedUntil: lockoutMinutes ? new Date(Date.now() + lockoutMinutes * 60_000) : null,
        },
      });
      await prisma.kidsModeAuditLog.create({
        data: { userId: req.userId!, childId, action: 'pin_failed', ipAddress: req.ip },
      });
      throw new HttpError(401, 'invalid_pin');
    }

    await prisma.kidsModeSettings.update({
      where: { userId: req.userId! },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    await prisma.kidsModeAuditLog.create({
      data: { userId: req.userId!, childId, action: 'enter', ipAddress: req.ip },
    });

    res.cookie(KIDS_COOKIE, signKidsToken({ parentUserId: req.userId!, childId }), kidsCookieOptions());
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/exit', requireAuth, async (req, res, next) => {
  try {
    const { pin } = enterSchema.parse(req.body);
    const kidsToken = req.cookies?.[KIDS_COOKIE];
    const settings = await prisma.kidsModeSettings.findUniqueOrThrow({ where: { userId: req.userId! } });

    // This is the PIN check that actually matters for lockout: a child trying to escape
    // Kids Mode is the realistic brute-force target, not the parent-initiated /enter call.
    if (!settings.pinHash || !settings.pinSalt) throw new HttpError(400, 'pin_not_configured');
    if (settings.lockedUntil && settings.lockedUntil > new Date()) {
      throw new HttpError(423, 'pin_locked');
    }

    const valid = await verifyPin(pin, settings.pinSalt, settings.pinHash);
    if (!valid) {
      const failedAttempts = settings.failedAttempts + 1;
      const lockoutMinutes = lockoutMinutesForAttempt(failedAttempts);
      await prisma.kidsModeSettings.update({
        where: { userId: req.userId! },
        data: { failedAttempts, lockedUntil: lockoutMinutes ? new Date(Date.now() + lockoutMinutes * 60_000) : null },
      });
      throw new HttpError(401, 'invalid_pin');
    }

    await prisma.kidsModeSettings.update({
      where: { userId: req.userId! },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    let childId: number | null = null;
    if (kidsToken) {
      try {
        const payload = jwt.verify(kidsToken, process.env.JWT_SECRET!) as { childId: number };
        childId = payload.childId;
      } catch {
        childId = null;
      }
    }

    await prisma.kidsModeAuditLog.create({
      data: { userId: req.userId!, childId, action: 'exit', ipAddress: req.ip },
    });

    res.clearCookie(KIDS_COOKIE);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/status', requireAuth, (req, res) => {
  const kidsToken = req.cookies?.[KIDS_COOKIE];
  res.json({ data: { active: Boolean(kidsToken) } });
});
