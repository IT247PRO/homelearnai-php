import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';

const CARD_TYPES = ['basic', 'multiple_choice', 'true_false', 'cloze', 'typed_answer', 'image_occlusion'] as const;
const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;

const flashcardBaseSchema = z.object({
  cardType: z.enum(CARD_TYPES).default('basic'),
  difficultyLevel: z.enum(DIFFICULTY_LEVELS).default('medium'),
  question: z.string().min(1),
  answer: z.string().min(1),
  hint: z.string().nullable().optional(),
  choices: z.array(z.string()).optional(),
  correctChoices: z.array(z.string()).optional(),
  clozeText: z.string().nullable().optional(),
  clozeAnswers: z.array(z.string()).optional(),
  // Not `.url()` — uploaded images are stored as relative paths (e.g.
  // `/api/file-assets/5/content`), matching FileAsset's own convention, so an absolute-URL
  // check would reject every image the client's own uploader produces.
  questionImageUrl: z.string().min(1).nullable().optional(),
  answerImageUrl: z.string().min(1).nullable().optional(),
  occlusionData: z.unknown().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// Cross-field validation applied on create; partial updates (PATCH) skip it since a
// partial update may legitimately touch just one field.
const flashcardInputSchema = flashcardBaseSchema.superRefine((card, ctx) => {
    // Mirrors the original Flashcard::validateCardData() port-for-port.
    if (card.cardType === 'multiple_choice') {
      if (!card.choices || card.choices.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Multiple choice cards must have at least 2 choices', path: ['choices'] });
      }
      if (!card.correctChoices || card.correctChoices.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Multiple choice cards must have correct choices specified', path: ['correctChoices'] });
      }
    }
    if (card.cardType === 'true_false' && (!card.choices || card.choices.length !== 2)) {
      ctx.addIssue({ code: 'custom', message: 'True/false cards must have exactly 2 choices', path: ['choices'] });
    }
    if (card.cardType === 'cloze') {
      if (!card.clozeText) ctx.addIssue({ code: 'custom', message: 'Cloze deletion cards must have cloze text', path: ['clozeText'] });
      if (!card.clozeAnswers || card.clozeAnswers.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Cloze deletion cards must have cloze answers', path: ['clozeAnswers'] });
      }
    }
    if (card.cardType === 'image_occlusion') {
      if (!card.questionImageUrl) ctx.addIssue({ code: 'custom', message: 'Image occlusion cards must have a question image', path: ['questionImageUrl'] });
      if (!card.occlusionData) ctx.addIssue({ code: 'custom', message: 'Image occlusion cards must have occlusion data', path: ['occlusionData'] });
    }
  });

/** Mounted at /topics/:topicId/flashcards */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    let flashcards = await prisma.flashcard.findMany({
      where: {
        topicId: Number(req.params.topicId),
        isActive: true,
        deletedAt: null,
        ...(q ? { OR: [{ question: { contains: q } }, { answer: { contains: q } }] } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    // Preview/dry-run browsing (no Review rows touched, same list this endpoint always
    // returned) — shuffle is just a display convenience for that mode.
    if (req.query.shuffle === 'true') {
      flashcards = shuffle(flashcards);
    }

    res.json({ data: flashcards });
  } catch (err) {
    next(err);
  }
});

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

nestedRouter.post('/', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const body = flashcardInputSchema.parse(req.body);
    const topicId = Number(req.params.topicId);
    const flashcard = await prisma.flashcard.create({
      data: {
        topicId,
        cardType: body.cardType,
        difficultyLevel: body.difficultyLevel,
        question: body.question,
        answer: body.answer,
        hint: body.hint ?? undefined,
        choices: body.choices ?? undefined,
        correctChoices: body.correctChoices ?? undefined,
        clozeText: body.clozeText ?? undefined,
        clozeAnswers: body.clozeAnswers ?? undefined,
        questionImageUrl: body.questionImageUrl ?? undefined,
        answerImageUrl: body.answerImageUrl ?? undefined,
        occlusionData: (body.occlusionData as never) ?? undefined,
        tags: body.tags ?? undefined,
        isActive: body.isActive ?? true,
      },
    });

    // Mirrors the original Review::createFromFlashcard(): every active flashcard gets a
    // spaced-repetition entry per child so the review queue has something to serve.
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { unit: { include: { subject: true } } },
    });
    if (topic?.unit.subject.childId) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await prisma.review.create({
        data: {
          childId: topic.unit.subject.childId,
          topicId,
          flashcardId: flashcard.id,
          status: 'new',
          dueDate: tomorrow,
        },
      });
    }

    res.status(201).json({ data: flashcard });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /flashcards */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.get('/:flashcardId', requireOwnership('flashcard', 'flashcardId'), async (req, res, next) => {
  try {
    const flashcard = await prisma.flashcard.findUnique({ where: { id: Number(req.params.flashcardId) } });
    if (!flashcard) throw new HttpError(404, 'not_found');
    res.json({ data: flashcard });
  } catch (err) {
    next(err);
  }
});

itemRouter.patch('/:flashcardId', requireOwnership('flashcard', 'flashcardId'), async (req, res, next) => {
  try {
    const body = flashcardBaseSchema.partial().parse(req.body);
    const flashcard = await prisma.flashcard.update({
      where: { id: Number(req.params.flashcardId) },
      data: {
        cardType: body.cardType,
        difficultyLevel: body.difficultyLevel,
        question: body.question,
        answer: body.answer,
        hint: body.hint === null ? null : body.hint,
        choices: body.choices ?? undefined,
        correctChoices: body.correctChoices ?? undefined,
        clozeText: body.clozeText === null ? null : body.clozeText,
        clozeAnswers: body.clozeAnswers ?? undefined,
        questionImageUrl: body.questionImageUrl === null ? null : body.questionImageUrl,
        answerImageUrl: body.answerImageUrl === null ? null : body.answerImageUrl,
        occlusionData: (body.occlusionData as never) ?? undefined,
        tags: body.tags ?? undefined,
        isActive: body.isActive,
      },
    });
    res.json({ data: flashcard });
  } catch (err) {
    next(err);
  }
});

// Soft delete, matching the original SoftDeletes behavior.
itemRouter.delete('/:flashcardId', requireOwnership('flashcard', 'flashcardId'), async (req, res, next) => {
  try {
    await prisma.flashcard.update({
      where: { id: Number(req.params.flashcardId) },
      data: { deletedAt: new Date(), isActive: false },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
