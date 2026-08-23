import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/src/app.js';
import { ensureWalMode } from './server/src/lib/prisma.js';

if (!process.env.DATABASE_URL) {
  const rootDbPath = path.resolve(process.cwd(), 'database/prisma/dev.db');
  const relDbPath = path.resolve(process.cwd(), '../database/prisma/dev.db');
  const dbPath = fs.existsSync(rootDbPath) ? rootDbPath : (fs.existsSync(relDbPath) ? relDbPath : rootDbPath);
  process.env.DATABASE_URL = `file:${dbPath}`;
}

async function startServer() {
  try {
    await ensureWalMode();
  } catch (err) {
    console.warn('Could not set WAL mode on startup:', err);
  }

  const app = createApp();
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      root: path.resolve(process.cwd(), 'client'),
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.resolve(process.cwd(), 'dist'))
      ? path.resolve(process.cwd(), 'dist')
      : path.resolve(process.cwd(), 'client/dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HomeLearnAI running on http://localhost:${PORT}`);
  });
}

startServer();
