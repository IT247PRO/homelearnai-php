import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

function getPepper(): string {
  return process.env.PIN_HASH_PEPPER ?? '';
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return bcrypt.hash(`${pin}:${salt}:${getPepper()}`, 10);
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  return bcrypt.compare(`${pin}:${salt}:${getPepper()}`, hash);
}

/** Ported from UserPreferences::incrementPinAttempts() progressive lockout schedule. */
export function lockoutMinutesForAttempt(attempts: number): number | null {
  if (attempts >= 8) return 1440;
  if (attempts >= 7) return 60;
  if (attempts >= 6) return 15;
  if (attempts >= 5) return 5;
  return null;
}
