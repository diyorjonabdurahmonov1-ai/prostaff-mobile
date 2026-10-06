/**
 * Lightweight i18n: a context that holds the active language + a `t()` function.
 * Default language is `uz`. The chosen language is persisted via secure-store.
 */

import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { dictionaries, LANGUAGES, type Language, type TranslationKey } from './dictionaries';

const STORAGE_KEY = 'prostaff.lang';

type TParams = Record<string, string | number>;

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: TParams) => string;
  languages: Language[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

async function readStoredLang(): Promise<Language | null> {
  try {
    const value = await SecureStore.getItemAsync(STORAGE_KEY);
    if (value && (LANGUAGES as string[]).includes(value)) return value as Language;
  } catch {
    // secure-store unavailable (e.g. web) — ignore
  }
  return null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('uz');

  useEffect(() => {
    let active = true;
    readStoredLang().then((stored) => {
      if (active && stored) setLangState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TParams) => {
      const dict = dictionaries[lang];
      const template = dict[key] ?? dictionaries.uz[key] ?? key;
      return interpolate(template, params);
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t, languages: LANGUAGES }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Convenience hook returning just the `t` translate function. */
export function useT() {
  return useI18n().t;
}

export type { Language, TranslationKey };
