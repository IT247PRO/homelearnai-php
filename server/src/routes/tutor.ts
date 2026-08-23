import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { aiGenerationRateLimiter } from '../middleware/rateLimit.js';
import { AiNotConfiguredError } from '../ai/provider.js';
import { postTutorMessage } from '../services/tutor.js';

/** Mounted at /topics/:topicId/tutor — parent-authenticated preview/use of the tutor for a
 * given topic. childId is derived from the topic's own subject, not passed by the client. */
export const router = Router({ mergeParams: true });
router.use(requireAuth);

const messageSchema = z.object({
  conversationId: z.number().int().optional(),
  message: z.string().min(1).max(2000),
  lessonId: z.number().int().optional(),
  sectionId: z.number().int().optional(),
});

router.post('/messages', requireOwnership('topic', 'topicId'), aiGenerationRateLimiter, async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const body = messageSchema.parse(req.body);
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic.unit.subject.childId) throw new HttpError(400, 'topic_not_child_scoped');

    const result = await postTutorMessage({
      userId: req.userId!,
      childId: topic.unit.subject.childId,
      topicId,
      lessonId: body.lessonId,
      sectionId: body.sectionId,
      conversationId: body.conversationId,
      message: body.message,
    });
    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: 'ai_not_configured', message: 'AI features are not set up yet.' });
    }
    next(err);
  }
});

router.get('/conversations/:conversationId', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: Number(req.params.conversationId), topicId: Number(req.params.topicId) },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new HttpError(404, 'not_found');
    res.json({ data: conversation });
  } catch (err) {
    next(err);
  }
});
