import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Outline-editing CRUD (plan2.md §5: approve, edit, delete, rename, reorder, add unit, add
 * topic). "Merge topics" / "split topics" aren't separate operations — a parent achieves
 * both by deleting and re-adding topics through these same endpoints. Reordering is a plain
 * sortOrder PATCH on two sibling rows (no drag-and-drop endpoint) — the client swaps values.
 *
 * Consolidated into one file: these are small, identically-shaped handlers over five
 * sibling models, so five near-empty files would just be noise (matches the existing
 * per-resource nested+item-router pattern from topics.ts, just grouped).
 */

const CONFIDENCE_VALUES = ['explicit', 'inferred'] as const;

const unitInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  confidence: z.enum(CONFIDENCE_VALUES).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const topicInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  confidence: z.enum(CONFIDENCE_VALUES).optional(),
  sourceExcerpt: z.string().max(500).nullable().optional(),
  estimatedLessonCount: z.number().int().min(1).max(20).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const skillInputSchema = z.object({
  title: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional(),
});

const objectiveInputSchema = z.object({
  description: z.string().min(1).max(500),
  curriculumSkillId: z.number().int().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const prerequisiteInputSchema = z.object({
  requiresTopicId: z.number().int(),
});

// --- Units -------------------------------------------------------------------------------

/** Mounted at /curricula/:curriculumId/units */
export const unitNestedRouter = Router({ mergeParams: true });
unitNestedRouter.use(requireAuth);

unitNestedRouter.post('/', requireOwnership('curriculum', 'curriculumId'), async (req, res, next) => {
  try {
    const body = unitInputSchema.parse(req.body);
    const unit = await prisma.curriculumUnit.create({
      data: {
        curriculumId: Number(req.params.curriculumId),
        title: body.title,
        description: body.description ?? undefined,
        confidence: 'explicit', // manually added by the parent, not inferred by AI
        sortOrder: body.sortOrder ?? 0,
      },
    });
    res.status(201).json({ data: unit });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /curriculum-units */
export const unitItemRouter = Router();
unitItemRouter.use(requireAuth);

unitItemRouter.patch('/:unitId', requireOwnership('curriculumUnit', 'unitId'), async (req, res, next) => {
  try {
    const body = unitInputSchema.partial().parse(req.body);
    const unit = await prisma.curriculumUnit.update({
      where: { id: Number(req.params.unitId) },
      data: {
        title: body.title,
        description: body.description === null ? null : body.description,
        sortOrder: body.sortOrder,
      },
    });
    res.json({ data: unit });
  } catch (err) {
    next(err);
  }
});

unitItemRouter.delete('/:unitId', requireOwnership('curriculumUnit', 'unitId'), async (req, res, next) => {
  try {
    await prisma.curriculumUnit.delete({ where: { id: Number(req.params.unitId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Topics --------------------------------------------------------------------------------

/** Mounted at /curriculum-units/:unitId/topics */
export const topicNestedRouter = Router({ mergeParams: true });
topicNestedRouter.use(requireAuth);

topicNestedRouter.post('/', requireOwnership('curriculumUnit', 'unitId'), async (req, res, next) => {
  try {
    const body = topicInputSchema.parse(req.body);
    const topic = await prisma.curriculumTopic.create({
      data: {
        curriculumUnitId: Number(req.params.unitId),
        title: body.title,
        description: body.description ?? undefined,
        confidence: 'explicit',
        sourceExcerpt: body.sourceExcerpt ?? undefined,
        estimatedLessonCount: body.estimatedLessonCount ?? undefined,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    res.status(201).json({ data: topic });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /curriculum-topics */
export const topicItemRouter = Router();
topicItemRouter.use(requireAuth);

topicItemRouter.get('/:topicId', requireOwnership('curriculumTopic', 'topicId'), async (req, res, next) => {
  try {
    const topic = await prisma.curriculumTopic.findUnique({
      where: { id: Number(req.params.topicId) },
      include: {
        skills: { include: { objectives: true }, orderBy: { sortOrder: 'asc' } },
        objectives: { where: { curriculumSkillId: null }, orderBy: { sortOrder: 'asc' } },
        prerequisites: { include: { requiresTopic: true } },
        requiredBy: { include: { topic: true } },
        lessons: { include: { sections: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sequenceNumber: 'asc' } },
        assessment: { include: { questions: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!topic) throw new HttpError(404, 'not_found');
    res.json({ data: topic });
  } catch (err) {
    next(err);
  }
});

topicItemRouter.patch('/:topicId', requireOwnership('curriculumTopic', 'topicId'), async (req, res, next) => {
  try {
    const body = topicInputSchema.partial().parse(req.body);
    const topic = await prisma.curriculumTopic.update({
      where: { id: Number(req.params.topicId) },
      data: {
        title: body.title,
        description: body.description === null ? null : body.description,
        sourceExcerpt: body.sourceExcerpt === null ? null : body.sourceExcerpt,
        estimatedLessonCount: body.estimatedLessonCount === null ? null : body.estimatedLessonCount,
        sortOrder: body.sortOrder,
      },
    });
    res.json({ data: topic });
  } catch (err) {
    next(err);
  }
});

topicItemRouter.delete('/:topicId', requireOwnership('curriculumTopic', 'topicId'), async (req, res, next) => {
  try {
    await prisma.curriculumTopic.delete({ where: { id: Number(req.params.topicId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Skills (nested under a topic; edited/deleted by id directly) --------------------------

topicItemRouter.post('/:topicId/skills', requireOwnership('curriculumTopic', 'topicId'), async (req, res, next) => {
  try {
    const body = skillInputSchema.parse(req.body);
    const skill = await prisma.curriculumSkill.create({
      data: { curriculumTopicId: Number(req.params.topicId), title: body.title, sortOrder: body.sortOrder ?? 0 },
    });
    res.status(201).json({ data: skill });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /curriculum-skills */
export const skillItemRouter = Router();
skillItemRouter.use(requireAuth);

skillItemRouter.patch('/:skillId', requireOwnership('curriculumSkill', 'skillId'), async (req, res, next) => {
  try {
    const body = skillInputSchema.partial().parse(req.body);
    const skill = await prisma.curriculumSkill.update({
      where: { id: Number(req.params.skillId) },
      data: { title: body.title, sortOrder: body.sortOrder },
    });
    res.json({ data: skill });
  } catch (err) {
    next(err);
  }
});

skillItemRouter.delete('/:skillId', requireOwnership('curriculumSkill', 'skillId'), async (req, res, next) => {
  try {
    await prisma.curriculumSkill.delete({ where: { id: Number(req.params.skillId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Objectives (nested under a topic; edited/deleted by id directly) ----------------------

topicItemRouter.post('/:topicId/objectives', requireOwnership('curriculumTopic', 'topicId'), async (req, res, next) => {
  try {
    const body = objectiveInputSchema.parse(req.body);
    const objective = await prisma.curriculumObjective.create({
      data: {
        curriculumTopicId: Number(req.params.topicId),
        description: body.description,
        curriculumSkillId: body.curriculumSkillId ?? undefined,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    res.status(201).json({ data: objective });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /curriculum-objectives */
export const objectiveItemRouter = Router();
objectiveItemRouter.use(requireAuth);

objectiveItemRouter.patch('/:objectiveId', requireOwnership('curriculumObjective', 'objectiveId'), async (req, res, next) => {
  try {
    const body = objectiveInputSchema.partial().parse(req.body);
    const objective = await prisma.curriculumObjective.update({
      where: { id: Number(req.params.objectiveId) },
      data: { description: body.description, curriculumSkillId: body.curriculumSkillId, sortOrder: body.sortOrder },
    });
    res.json({ data: objective });
  } catch (err) {
    next(err);
  }
});

objectiveItemRouter.delete('/:objectiveId', requireOwnership('curriculumObjective', 'objectiveId'), async (req, res, next) => {
  try {
    await prisma.curriculumObjective.delete({ where: { id: Number(req.params.objectiveId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Prerequisites (nested under a topic; deleted by id directly) --------------------------

topicItemRouter.post('/:topicId/prerequisites', requireOwnership('curriculumTopic', 'topicId'), async (req, res, next) => {
  try {
    const body = prerequisiteInputSchema.parse(req.body);
    const topicId = Number(req.params.topicId);
    if (body.requiresTopicId === topicId) throw new HttpError(400, 'topic_cannot_require_itself');

    const requiresTopic = await prisma.curriculumTopic.findUnique({
      where: { id: body.requiresTopicId },
      include: { unit: true },
    });
    const topic = await prisma.curriculumTopic.findUniqueOrThrow({ where: { id: topicId }, include: { unit: true } });
    if (!requiresTopic || requiresTopic.unit.curriculumId !== topic.unit.curriculumId) {
      throw new HttpError(404, 'prerequisite_topic_not_found');
    }

    const prerequisite = await prisma.curriculumPrerequisite.create({
      data: { topicId, requiresTopicId: body.requiresTopicId },
    });
    res.status(201).json({ data: prerequisite });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /curriculum-prerequisites */
export const prerequisiteItemRouter = Router();
prerequisiteItemRouter.use(requireAuth);

prerequisiteItemRouter.delete('/:prerequisiteId', requireOwnership('curriculumPrerequisite', 'prerequisiteId'), async (req, res, next) => {
  try {
    await prisma.curriculumPrerequisite.delete({ where: { id: Number(req.params.prerequisiteId) } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
