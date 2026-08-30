import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';

export type ReaderFontScale = 'normal' | 'large' | 'huge';

const SCALE_VALUES: Record<ReaderFontScale, number> = {
  normal: 1,
  large: 1.15,
  huge: 1.35,
};

const STORAGE_KEY = 'kids-reader-font-scale';

interface TextSizeContextValue {
  scale: ReaderFontScale;
  setScale: (scale: ReaderFontScale) => void;
}

const TextSizeContext = createContext<TextSizeContextValue | null>(null);

function readStoredScale(): ReaderFontScale {
  if (typeof window === 'undefined') return 'normal';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'normal' || stored === 'large' || stored === 'huge') return stored;
  } catch {
    // localStorage can throw under blocked-storage/private-browsing settings — fall back silently.
  }
  return 'normal';
}

/**
 * Hosts the `--reader-font-scale` CSS custom property that RichContent's `scalable` prop reads.
 * The wrapper div uses `display: contents` so it never affects the surrounding layout (no extra
 * flex/grid item, no `space-y-*` sibling-margin disruption) — CSS custom properties still
 * inherit through `display: contents` normally, so the variable reaches descendants unaffected.
 */
export function TextSizeProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<ReaderFontScale>(readStoredScale);

  const setScale = (next: ReaderFontScale) => {
    setScaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence only.
    }
  };

  const style = { display: 'contents', '--reader-font-scale': SCALE_VALUES[scale] } as CSSProperties;

  return (
    <TextSizeContext.Provider value={{ scale, setScale }}>
      <div style={style}>{children}</div>
    </TextSizeContext.Provider>
  );
}

export function useTextSize(): TextSizeContextValue {
  const ctx = useContext(TextSizeContext);
  if (!ctx) throw new Error('useTextSize must be used within a TextSizeProvider');
  return ctx;
}
