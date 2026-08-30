import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { generateWorksheet } from '../services/worksheetGeneration.js';
import { worksheetGenerationRequestSchema } from '../ai/schemas.js';

const router = Router();

const generateRequestBodySchema = worksheetGenerationRequestSchema.extend({
  childId: z.number().int().optional(),
  lessonId: z.number().int().optional(),
  topicId: z.number().int().optional(),
});

// Generate worksheet for a specific topic
router.post('/topics/:topicId/worksheets/generate', requireAuth, async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    if (!topicId || Number.isNaN(topicId)) {
      return res.status(400).json({ error: 'Invalid topicId' });
    }

    const parseResult = generateRequestBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.format() });
    }

    const payload = parseResult.data;
    const worksheet = await generateWorksheet({
      ...payload,
      topicId,
      lessonId: payload.lessonId,
      childId: payload.childId,
      userId: req.userId!,
    });

    return res.json({ data: worksheet });
  } catch (err) {
    return next(err);
  }
});

// Generate worksheet for a specific lesson
router.post('/lessons/:lessonId/worksheets/generate', requireAuth, async (req, res, next) => {
  try {
    const lessonId = Number(req.params.lessonId);
    if (!lessonId || Number.isNaN(lessonId)) {
      return res.status(400).json({ error: 'Invalid lessonId' });
    }

    const parseResult = generateRequestBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.format() });
    }

    const payload = parseResult.data;
    const worksheet = await generateWorksheet({
      ...payload,
      lessonId,
      topicId: payload.topicId,
      childId: payload.childId,
      userId: req.userId!,
    });

    return res.json({ data: worksheet });
  } catch (err) {
    return next(err);
  }
});

// General custom worksheet generation endpoint
router.post('/worksheets/generate', requireAuth, async (req, res, next) => {
  try {
    const parseResult = generateRequestBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.format() });
    }

    const payload = parseResult.data;
    const worksheet = await generateWorksheet({
      ...payload,
      topicId: payload.topicId,
      lessonId: payload.lessonId,
      childId: payload.childId,
      userId: req.userId!,
    });

    return res.json({ data: worksheet });
  } catch (err) {
    return next(err);
  }
});

export default router;
