import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { useReadAloud } from '../hooks/useReadAloud';

interface ReadAloudControlsProps {
  /** Raw markdown/HTML content to read aloud — stripped internally by useReadAloud. */
  text: string;
  rate?: number;
  className?: string;
}

/** Play/Pause/Resume/Stop controls for reading the given content aloud. Renders nothing
 * (not even a disabled state) when the browser doesn't support Speech Synthesis at all, since a
 * dead control is worse than no control. */
export function ReadAloudControls({ text, rate, className }: ReadAloudControlsProps) {
  const { status, speak, pause, resume, stop } = useReadAloud({ rate });

  if (status === 'unsupported') return null;

  const isSpeaking = status === 'speaking';
  const isPaused = status === 'paused';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {isSpeaking ? (
        <button
          type="button"
          onClick={pause}
          className="flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-soft-xs transition-all animate-pulse"
        >
          <Pause className="h-4 w-4" />
          <span>Pause</span>
        </button>
      ) : isPaused ? (
        <button
          type="button"
          onClick={resume}
          className="flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-soft-xs transition-all"
        >
          <Play className="h-4 w-4" />
          <span>Resume</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => speak(text)}
          disabled={!text}
          className="flex items-center gap-2 rounded-2xl bg-purple-50 px-4 py-2 text-xs font-bold text-purple-700 shadow-soft-xs transition-all hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Volume2 className="h-4 w-4" />
          <span>Read Aloud to Me 🎧</span>
        </button>
      )}

      {(isSpeaking || isPaused) && (
        <button
          type="button"
          onClick={stop}
          className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-soft-xs transition-all hover:bg-slate-50"
          title="Stop"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
