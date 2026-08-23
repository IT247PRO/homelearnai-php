import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

/**
 * WAL mode is a property of the SQLite file itself (stored in its header), not a
 * per-connection setting, so this only needs to run once per database file — but it's
 * cheap and idempotent, so we just confirm it on every server boot rather than relying on
 * migration bookkeeping. `foreign_keys` is already ON by default on every Prisma SQLite
 * connection, so it isn't set here.
 */
export async function ensureWalMode(): Promise<void> {
  // PRAGMA journal_mode returns the resulting mode as a row, so this must go through
  // $queryRawUnsafe — $executeRawUnsafe rejects any statement that returns rows.
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
}
