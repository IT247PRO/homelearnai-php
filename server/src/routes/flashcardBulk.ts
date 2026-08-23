import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { parseDelimitedCards, cardsToCsv } from '../services/flashcardImport.js';

/** Mounted at /topics/:topicId/flashcards (bulk import + bulk status alongside plain CRUD) */
export const topicBulkRouter = Router({ mergeParams: true });
topicBulkRouter.use(requireAuth);

const importSchema = z.object({
  format: z.enum(['csv', 'tsv']),
  content: z.string().min(1),
  importType: z.string().max(50).optional(),
});

topicBulkRouter.post('/import', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const body = importSchema.parse(req.body);
    const topicId = Number(req.params.topicId);
    const parsedCards = parseDelimitedCards(body.content, body.format === 'csv' ? ',' : '\t');

    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });

    const flashcardImport = await prisma.flashcardImport.create({
      data: {
        unitId: topic.unitId,
        userId: req.userId!,
        importType: body.importType ?? body.format,
        filename: `pasted-${body.format}`,
        status: 'processing',
        totalCards: parsedCards.length,
        startedAt: new Date(),
      },
    });

    const existingCards = await prisma.flashcard.findMany({
      where: { topicId, isActive: true },
      select: { question: true, answer: true },
    });
    const existingKeys = new Set(existingCards.map((c) => normalizeKey(c.question, c.answer)));

    let imported = 0;
    let duplicates = 0;
    const childId = topic.unit.subject.childId;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const card of parsedCards) {
      const key = normalizeKey(card.question, card.answer);
      if (existingKeys.has(key)) {
        duplicates++;
        continue;
      }
      existingKeys.add(key);

      const created = await prisma.flashcard.create({
        data: {
          topicId,
          question: card.question,
          answer: card.answer,
          hint: card.hint,
          importSource: body.importType ?? body.format,
        },
      });
      if (childId) {
        await prisma.review.create({
          data: { childId, topicId, flashcardId: created.id, status: 'new', dueDate: tomorrow },
        });
      }
      imported++;
    }

    const updatedImport = await prisma.flashcardImport.update({
      where: { id: flashcardImport.id },
      data: {
        status: 'completed',
        importedCards: imported,
        duplicateCards: duplicates,
        failedCards: parsedCards.length - imported - duplicates,
        completedAt: new Date(),
      },
    });

    res.status(201).json({ data: updatedImport });
  } catch (err) {
    next(err);
  }
});

const bulkStatusSchema = z.object({
  flashcardIds: z.array(z.number().int()).min(1),
  isActive: z.boolean(),
});

topicBulkRouter.patch('/bulk-status', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const body = bulkStatusSchema.parse(req.body);
    const topicId = Number(req.params.topicId);
    const result = await prisma.flashcard.updateMany({
      where: { id: { in: body.flashcardIds }, topicId },
      data: { isActive: body.isActive },
    });
    res.json({ data: { updated: result.count } });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /units/:unitId/flashcards (export spans every topic in the unit) */
export const unitExportRouter = Router({ mergeParams: true });
unitExportRouter.use(requireAuth);

unitExportRouter.get('/export', requireOwnership('unit', 'unitId'), async (req, res, next) => {
  try {
    const unitId = Number(req.params.unitId);
    const cards = await prisma.flashcard.findMany({
      where: { topic: { unitId }, isActive: true, deletedAt: null },
      select: { question: true, answer: true, hint: true, cardType: true, difficultyLevel: true },
      orderBy: { createdAt: 'asc' },
    });

    const format = req.query.format === 'json' ? 'json' : 'csv';
    if (format === 'json') {
      res.json({ data: cards });
      return;
    }

    res.type('text/csv').send(cardsToCsv(cards));
  } catch (err) {
    next(err);
  }
});

unitExportRouter.get('/search', requireOwnership('unit', 'unitId'), async (req, res, next) => {
  try {
    const unitId = Number(req.params.unitId);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.json({ data: [] });
      return;
    }
    const cards = await prisma.flashcard.findMany({
      where: {
        topic: { unitId },
        isActive: true,
        deletedAt: null,
        OR: [{ question: { contains: q } }, { answer: { contains: q } }],
      },
      include: { topic: { select: { title: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data: cards });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /flashcards (cross-topic move) */
export const moveRouter = Router();
moveRouter.use(requireAuth);

const moveSchema = z.object({ topicId: z.number().int() });

moveRouter.post('/:flashcardId/move', requireOwnership('flashcard', 'flashcardId'), async (req, res, next) => {
  try {
    const { topicId } = moveSchema.parse(req.body);
    const targetTopic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });
    if (!targetTopic || targetTopic.unit.subject.userId !== req.userId) {
      throw new HttpError(404, 'target_topic_not_found');
    }

    const flashcard = await prisma.flashcard.update({
      where: { id: Number(req.params.flashcardId) },
      data: { topicId },
    });
    res.json({ data: flashcard });
  } catch (err) {
    next(err);
  }
});

function normalizeKey(question: string, answer: string): string {
  return `${question.trim().toLowerCase()}::${answer.trim().toLowerCase()}`;
}
