import 'dotenv/config';
import { createApp } from './app.js';
import { ensureWalMode } from './lib/prisma.js';

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

await ensureWalMode();

app.listen(port, () => {
  console.log(`HomeLearnAI API listening on http://localhost:${port}`);
});
