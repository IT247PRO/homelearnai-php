import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { expandIcsEvents, validateIcsContent, eventToTimeBlockData } from '../services/icsImport.js';

const timeBlockInputSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().min(1).max(255),
  commitmentType: z.enum(['fixed', 'preferred', 'flexible']).optional(),
});

/** Mounted at /children/:childId/time-blocks */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const timeBlocks = await prisma.timeBlock.findMany({
      where: { childId: Number(req.params.childId) },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json({ data: timeBlocks });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const body = timeBlockInputSchema.parse(req.body);
    const timeBlock = await prisma.timeBlock.create({
      data: { childId: Number(req.params.childId), ...body, commitmentType: body.commitmentType ?? 'preferred' },
    });
    res.status(201).json({ data: timeBlock });
  } catch (err) {
    next(err);
  }
});

const icsPreviewSchema = z.object({ icsContent: z.string().min(1) });

nestedRouter.post('/import/preview', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const { icsContent } = icsPreviewSchema.parse(req.body);
    validateIcsContent(icsContent);
    const events = expandIcsEvents(icsContent).slice(0, 50);
    res.json({
      data: events.map((e) => ({
        uid: e.uid,
        summary: e.summary,
        location: e.location,
        start: e.start,
        end: e.end,
        durationMinutes: Math.round((e.end.getTime() - e.start.getTime()) / 60_000),
      })),
    });
  } catch (err) {
    if (err instanceof Error && !(err instanceof HttpError)) return next(new HttpError(400, err.message));
    next(err);
  }
});

nestedRouter.post('/import', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const { icsContent } = icsPreviewSchema.parse(req.body);
    validateIcsContent(icsContent);
    const childId = Number(req.params.childId);
    const events = expandIcsEvents(icsContent);

    let imported = 0;
    let skippedDuplicates = 0;
    for (const event of events) {
      const data = eventToTimeBlockData(event, childId);
      const existing = await prisma.timeBlock.findFirst({ where: { childId, sourceUid: data.sourceUid } });
      if (existing) {
        skippedDuplicates++;
        continue;
      }
      await prisma.timeBlock.create({ data });
      imported++;
    }

    res.status(201).json({ data: { imported, skippedDuplicates, total: events.length } });
  } catch (err) {
    if (err instanceof Error && !(err instanceof HttpError)) return next(new HttpError(400, err.message));
    next(err);
  }
});

const icsUrlSchema = z.object({ url: z.string().url() });

nestedRouter.post('/import/url', requireOwnership('child', 'childId'), async (req, res, next) => {
  try {
    const { url } = icsUrlSchema.parse(req.body);
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new HttpError(400, 'invalid_url_protocol');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let icsContent: string;
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      if (!response.ok) throw new HttpError(400, `failed_to_fetch_ics: ${response.status}`);
      icsContent = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    validateIcsContent(icsContent);
    const childId = Number(req.params.childId);
    const events = expandIcsEvents(icsContent);

    let imported = 0;
    let skippedDuplicates = 0;
    for (const event of events) {
      const data = eventToTimeBlockData(event, childId);
      const existing = await prisma.timeBlock.findFirst({ where: { childId, sourceUid: data.sourceUid } });
      if (existing) {
        skippedDuplicates++;
        continue;
      }
      await prisma.timeBlock.create({ data });
      imported++;
    }

    res.status(201).json({ data: { imported, skippedDuplicates, total: events.length } });
  } catch (err) {
    if (err instanceof Error && !(err instanceof HttpError)) return next(new HttpError(400, err.message));
    next(err);
  }
});

/** Mounted at /time-blocks */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.patch('/:timeBlockId', requireOwnership('timeBlock', 'timeBlockId'), async (req, res, next) => {
  try {
    const body = timeBlockInputSchema.partial().parse(req.body);
    const timeBlock = await prisma.timeBlock.update({ where: { id: Number(req.params.timeBlockId) }, data: body });
    res.json({ data: timeBlock });
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:timeBlockId', requireOwnership('timeBlock', 'timeBlockId'), async (req, res, next) => {
  try {
    await prisma.timeBlock.delete({ where: { id: Number(req.params.timeBlockId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
