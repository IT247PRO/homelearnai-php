import { useRef, useState } from 'react';
import { api } from '../lib/api';

export interface OcclusionBox {
  id: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

interface Props {
  topicId: number;
  imageUrl: string | null;
  boxes: OcclusionBox[];
  onImageChange: (url: string) => void;
  onBoxesChange: (boxes: OcclusionBox[]) => void;
}

/** Upload a base image, then click-drag over it to draw occlusion rectangles. Coordinates
 * are stored as percentages of the image's natural size so they stay correct at any
 * rendered width. */
export function OcclusionEditor({ topicId, imageUrl, boxes, onImageChange, onBoxesChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<{ startX: number; startY: number; x: number; y: number; w: number; h: number } | null>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post<{ data: { url: string } }>(`/topics/${topicId}/materials/upload?type=image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onImageChange(data.data.url);
    } finally {
      setUploading(false);
    }
  }

  function pointerToPct(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!imageUrl) return;
    const { x, y } = pointerToPct(e.clientX, e.clientY);
    setDraft({ startX: x, startY: y, x, y, w: 0, h: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draft) return;
    const { x, y } = pointerToPct(e.clientX, e.clientY);
    setDraft({
      ...draft,
      x: Math.min(x, draft.startX),
      y: Math.min(y, draft.startY),
      w: Math.abs(x - draft.startX),
      h: Math.abs(y - draft.startY),
    });
  }

  function handlePointerUp() {
    if (draft && draft.w > 2 && draft.h > 2) {
      onBoxesChange([...boxes, { id: crypto.randomUUID(), xPct: draft.x, yPct: draft.y, wPct: draft.w, hPct: draft.h }]);
    }
    setDraft(null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-700">
        {imageUrl ? 'Replace image' : 'Upload an image'}
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = '';
          }}
          className="mt-1 block text-sm"
        />
      </label>

      {imageUrl && (
        <>
          <p className="text-xs text-slate-500">Click and drag over the image to draw a box to hide. Click a box's × to remove it.</p>
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative inline-block max-w-full touch-none select-none"
          >
            <img src={imageUrl} alt="Flashcard occlusion source" className="block max-w-full rounded border border-slate-300" draggable={false} />
            {boxes.map((box) => (
              <div
                key={box.id}
                style={{ left: `${box.xPct}%`, top: `${box.yPct}%`, width: `${box.wPct}%`, height: `${box.hPct}%` }}
                className="absolute flex items-start justify-end bg-slate-900/80"
              >
                <button
                  type="button"
                  onClick={() => onBoxesChange(boxes.filter((b) => b.id !== box.id))}
                  aria-label="Remove this occlusion box"
                  className="m-0.5 rounded bg-white/90 px-1 text-xs leading-tight text-slate-900"
                >
                  ×
                </button>
              </div>
            ))}
            {draft && (
              <div
                style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.w}%`, height: `${draft.h}%` }}
                className="absolute border-2 border-dashed border-brand-500 bg-brand-500/20"
              />
            )}
          </div>
          <p className="text-xs text-slate-500">{boxes.length} box(es) drawn.</p>
        </>
      )}
    </div>
  );
}
