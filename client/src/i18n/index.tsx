import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import en from './en.json';
import es from './es.json';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, es };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const STORAGE_KEY = 'hlai_locale';

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value ?? '');
}

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLocale(stored) ? stored : 'en';
  } catch {
    return 'en'; // localStorage can throw in private-browsing contexts
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  function setLocale(next: Locale) {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — per-viewer convenience only
    }
  }

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = DICTIONARIES[locale];
    return { locale, setLocale, t: (key: string) => dictionary[key] ?? key };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
