import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from './app.js';
import { ensureWalMode } from './lib/prisma.js';

if (!process.env.DATABASE_URL) {
  const rootDbPath = path.resolve(process.cwd(), 'database/prisma/dev.db');
  const relDbPath = path.resolve(process.cwd(), '../database/prisma/dev.db');
  const dbPath = fs.existsSync(rootDbPath) ? rootDbPath : (fs.existsSync(relDbPath) ? relDbPath : rootDbPath);
  process.env.DATABASE_URL = `file:${dbPath}`;
}

const port = Number(process.env.SERVER_PORT ?? 3001);
const app = createApp();

try {
  await ensureWalMode();
} catch (err) {
  console.warn('Could not set WAL mode on startup:', err);
}

app.listen(port, () => {
  console.log(`HomeLearnAI API listening on http://localhost:${port}`);
});
