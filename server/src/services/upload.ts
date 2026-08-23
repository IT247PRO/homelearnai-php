import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

// Local disk under src-v2/server/uploads/ — matches the single-file-SQLite, self-hosted
// nature of this app (per the plan's scope decision — no S3/cloud storage).
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MARKDOWN_MIME_TYPES = ['text/markdown', 'text/plain', 'text/x-markdown'];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25MB — the "large file" case; no
// resumable chunk-reassembly protocol (deliberate scope reduction — see the plan), multer
// streams the upload to disk so this isn't held in memory either way.

function fileKindForMime(mimeType: string): 'image' | 'document' | null {
  if (IMAGE_MIME_TYPES.includes(mimeType)) return 'image';
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) return 'document';
  return null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const uploadContentImage = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error('unsupported_image_type'));
      return;
    }
    cb(null, true);
  },
}).single('file');

export const uploadDocument = multer({
  storage,
  limits: { fileSize: MAX_DOCUMENT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (fileKindForMime(file.mimetype) === null) {
      cb(new Error('unsupported_file_type'));
      return;
    }
    cb(null, true);
  },
}).single('file');

export const uploadMarkdown = multer({
  storage: multer.memoryStorage(), // parsed into Topic.learningContent, not kept as its own file
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const looksLikeMarkdown = MARKDOWN_MIME_TYPES.includes(file.mimetype) || file.originalname.endsWith('.md');
    if (!looksLikeMarkdown) {
      cb(new Error('unsupported_file_type'));
      return;
    }
    cb(null, true);
  },
}).single('file');

export function fileAssetKind(mimeType: string): 'image' | 'document' {
  return fileKindForMime(mimeType) ?? 'document';
}

export function deleteStoredFile(storedFilename: string | null): void {
  if (!storedFilename) return;
  const fullPath = path.join(UPLOAD_DIR, storedFilename);
  fs.rm(fullPath, { force: true }, () => {
    // best-effort cleanup — a missing file on disk shouldn't block deleting the DB row
  });
}
