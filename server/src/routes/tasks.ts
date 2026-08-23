import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';

export const router = Router();
router.use(requireAuth);

const taskInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

async function requireOwnedTask(userId: number, taskId: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.userId !== userId) throw new HttpError(404, 'not_found');
  return task;
}

router.get('/', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId!, status: status || undefined },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ data: tasks });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = taskInputSchema.parse(req.body);
    const task = await prisma.task.create({
      data: {
        userId: req.userId!,
        title: body.title,
        description: body.description ?? undefined,
        priority: body.priority ?? 'medium',
        status: body.status ?? 'pending',
        dueDate: body.dueDate ?? undefined,
      },
    });
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
});

router.get('/:taskId', async (req, res, next) => {
  try {
    const task = await requireOwnedTask(req.userId!, Number(req.params.taskId));
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

router.patch('/:taskId', async (req, res, next) => {
  try {
    const taskId = Number(req.params.taskId);
    await requireOwnedTask(req.userId!, taskId);
    const body = taskInputSchema.partial().parse(req.body);
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: body.title,
        description: body.description === null ? null : body.description,
        priority: body.priority,
        status: body.status,
        dueDate: body.dueDate === null ? null : body.dueDate,
        completedAt: body.status === 'completed' ? new Date() : body.status ? null : undefined,
      },
    });
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

router.delete('/:taskId', async (req, res, next) => {
  try {
    const taskId = Number(req.params.taskId);
    await requireOwnedTask(req.userId!, taskId);
    await prisma.task.delete({ where: { id: taskId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
