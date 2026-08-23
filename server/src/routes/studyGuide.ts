import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { aiGenerationRateLimiter } from '../middleware/rateLimit.js';
import { AiNotConfiguredError } from '../ai/provider.js';
import { generateStudyGuide } from '../services/studyGuideGeneration.js';

/** Mounted at /topics/:topicId/study-guide — parent-authenticated generation, review, and
 * publish workflow (plan4.md §17-19). Kids Mode reads the published version through its own
 * endpoint in routes/kids.ts, never through here. */
export const router = Router({ mergeParams: true });
router.use(requireAuth);

const generateRequestSchema = z.object({ reason: z.string().max(2000).optional() });

async function handleGenerate(req: Request, res: Response, next: NextFunction) {
  try {
    const topicId = Number(req.params.topicId);
    const body = generateRequestSchema.parse(req.body);
    const result = await generateStudyGuide({ topicId, userId: req.userId!, reason: body.reason });
    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: 'ai_not_configured', message: 'AI features are not set up yet.' });
    }
    next(err);
  }
}

router.post('/generate', requireOwnership('topic', 'topicId'), aiGenerationRateLimiter, handleGenerate);
router.post('/regenerate', requireOwnership('topic', 'topicId'), aiGenerationRateLimiter, handleGenerate);

router.get('/', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const studyGuide = await prisma.studyGuide.findUnique({
      where: { topicId },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    res.json({ data: studyGuide });
  } catch (err) {
    next(err);
  }
});

router.post('/versions/:versionId/publish', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const topicId = Number(req.params.topicId);
    const versionId = Number(req.params.versionId);
    const version = await prisma.studyGuideVersion.findFirst({ where: { id: versionId, studyGuide: { topicId } } });
    if (!version) throw new HttpError(404, 'not_found');

    await prisma.$transaction([
      prisma.studyGuideVersion.updateMany({
        where: { studyGuideId: version.studyGuideId, status: 'published' },
        data: { status: 'archived' },
      }),
      prisma.studyGuideVersion.update({ where: { id: versionId }, data: { status: 'published' } }),
    ]);

    const updated = await prisma.studyGuideVersion.findUniqueOrThrow({ where: { id: versionId } });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});
