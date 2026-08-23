import crypto from 'node:crypto';
import { prisma } from './prisma.js';

export type AuthTokenPurpose = 'password_reset' | 'email_verification';

// Unlike the Kids Mode PIN (low-entropy, user-chosen — needs bcrypt's deliberate slowness),
// these are high-entropy random tokens, so a fast SHA-256 hash of the raw value is enough
// to avoid storing the usable token itself in the database.
function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

const EXPIRY_MINUTES: Record<AuthTokenPurpose, number> = {
  password_reset: 60,
  email_verification: 24 * 60,
};

export async function issueAuthToken(userId: number, purpose: AuthTokenPurpose): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  await prisma.authToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + EXPIRY_MINUTES[purpose] * 60_000),
    },
  });
  return rawToken;
}

export async function consumeAuthToken(rawToken: string, purpose: AuthTokenPurpose) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.authToken.findFirst({
    where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!record) return null;

  await prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record;
}
