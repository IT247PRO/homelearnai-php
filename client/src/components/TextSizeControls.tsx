import { useTextSize, type ReaderFontScale } from '../contexts/TextSizeContext';

const OPTIONS: { scale: ReaderFontScale; label: string; textClass: string }[] = [
  { scale: 'normal', label: 'A', textClass: 'text-xs' },
  { scale: 'large', label: 'A+', textClass: 'text-sm' },
  { scale: 'huge', label: 'A++', textClass: 'text-base' },
];

/** A/A+/A++ buttons for the shared TextSizeContext. Must be rendered inside a TextSizeProvider. */
export function TextSizeControls({ className }: { className?: string }) {
  const { scale, setScale } = useTextSize();

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <span className="text-[10px] font-bold uppercase text-slate-400">Text Size:</span>
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-0.5">
        {OPTIONS.map((option) => (
          <button
            key={option.scale}
            type="button"
            onClick={() => setScale(option.scale)}
            aria-pressed={scale === option.scale}
            aria-label={`Text size ${option.label}`}
            className={`rounded-lg px-2.5 py-1 font-bold ${option.textClass} ${
              scale === option.scale ? 'bg-white text-purple-700 shadow-soft-xs' : 'text-slate-500'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
