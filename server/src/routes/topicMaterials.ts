import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwnership } from '../middleware/ownership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { uploadContentImage, uploadDocument, uploadMarkdown, fileAssetKind, deleteStoredFile, UPLOAD_DIR } from '../services/upload.js';

/** Mounted at /topics/:topicId/materials */
export const nestedRouter = Router({ mergeParams: true });
nestedRouter.use(requireAuth);

nestedRouter.get('/', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const assets = await prisma.fileAsset.findMany({
      where: { topicId: Number(req.params.topicId) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: assets });
  } catch (err) {
    next(err);
  }
});

const linkSchema = z.object({ url: z.string().url(), label: z.string().max(255).optional() });

nestedRouter.post('/link', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const { url, label } = linkSchema.parse(req.body);
    const asset = await prisma.fileAsset.create({
      data: {
        ownerUserId: req.userId!,
        topicId: Number(req.params.topicId),
        kind: 'video_link',
        originalName: label ?? url,
        url,
        label,
      },
    });
    res.status(201).json({ data: asset });
  } catch (err) {
    next(err);
  }
});

nestedRouter.post('/upload', requireOwnership('topic', 'topicId'), (req, res, next) => {
  const middleware = req.query.type === 'image' ? uploadContentImage : uploadDocument;
  middleware(req, res, async (err: unknown) => {
    if (err) return next(new HttpError(400, err instanceof Error ? err.message : 'upload_failed'));
    try {
      const file = req.file;
      if (!file) throw new HttpError(400, 'no_file_uploaded');

      const asset = await prisma.fileAsset.create({
        data: {
          ownerUserId: req.userId!,
          topicId: Number(req.params.topicId),
          kind: fileAssetKind(file.mimetype),
          originalName: file.originalname,
          storedFilename: file.filename,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });
      // The served URL embeds the asset's own id, so it's only knowable after creation.
      const withUrl = await prisma.fileAsset.update({
        where: { id: asset.id },
        data: { url: `/api/file-assets/${asset.id}/content` },
      });
      res.status(201).json({ data: withUrl });
    } catch (innerErr) {
      next(innerErr);
    }
  });
});

nestedRouter.post('/markdown-upload', requireOwnership('topic', 'topicId'), (req, res, next) => {
  uploadMarkdown(req, res, async (err: unknown) => {
    if (err) return next(new HttpError(400, err instanceof Error ? err.message : 'upload_failed'));
    try {
      const file = req.file;
      if (!file) throw new HttpError(400, 'no_file_uploaded');
      const topicId = Number(req.params.topicId);
      const content = file.buffer.toString('utf-8');

      const [topic, asset] = await prisma.$transaction([
        prisma.topic.update({ where: { id: topicId }, data: { learningContent: content } }),
        prisma.fileAsset.create({
          data: {
            ownerUserId: req.userId!,
            topicId,
            kind: 'markdown',
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        }),
      ]);
      res.status(201).json({ data: { topic, asset } });
    } catch (innerErr) {
      next(innerErr);
    }
  });
});

/** Mounted at /topics/:topicId/content */
export const contentRouter = Router({ mergeParams: true });
contentRouter.use(requireAuth);

// Returns the raw markdown — rendering now happens client-side via RichContent
// (react-markdown never uses dangerouslySetInnerHTML for the markdown text itself, so this
// no longer needs a server-side sanitizing render step).
contentRouter.get('/preview', requireOwnership('topic', 'topicId'), async (req, res, next) => {
  try {
    const topic = await prisma.topic.findUniqueOrThrow({ where: { id: Number(req.params.topicId) } });
    res.json({ data: { markdown: topic.learningContent ?? '' } });
  } catch (err) {
    next(err);
  }
});

/** Mounted at /file-assets */
export const itemRouter = Router();
itemRouter.use(requireAuth);

itemRouter.get('/:assetId/content', requireOwnership('fileAsset', 'assetId'), async (req, res, next) => {
  try {
    const asset = await prisma.fileAsset.findUniqueOrThrow({ where: { id: Number(req.params.assetId) } });
    if (!asset.storedFilename) throw new HttpError(404, 'no_stored_file');

    const fullPath = path.join(UPLOAD_DIR, asset.storedFilename);
    if (!fs.existsSync(fullPath)) throw new HttpError(404, 'file_missing_on_disk');

    if (asset.mimeType) res.type(asset.mimeType);
    res.sendFile(fullPath);
  } catch (err) {
    next(err);
  }
});

itemRouter.delete('/:assetId', requireOwnership('fileAsset', 'assetId'), async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    const asset = await prisma.fileAsset.findUniqueOrThrow({ where: { id: assetId } });
    await prisma.fileAsset.delete({ where: { id: assetId } });
    deleteStoredFile(asset.storedFilename);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
