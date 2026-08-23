import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { router as apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireCsrfHeader } from './middleware/csrf.js';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN : true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', requireCsrfHeader);

  app.use('/api', apiRouter);

  app.use(errorHandler);

  return app;
}
