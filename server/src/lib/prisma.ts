import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  const rootDbPath = path.resolve(process.cwd(), 'database/prisma/dev.db');
  const relDbPath = path.resolve(process.cwd(), '../database/prisma/dev.db');
  const dbPath = fs.existsSync(rootDbPath) ? rootDbPath : (fs.existsSync(relDbPath) ? relDbPath : rootDbPath);
  process.env.DATABASE_URL = `file:${dbPath}`;
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

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
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  } catch (err) {
    console.warn('Could not set WAL mode:', err);
  }
}

