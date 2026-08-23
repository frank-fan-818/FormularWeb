import { useCallback, useSyncExternalStore } from 'react';
import zhCN from './locales/zh-CN.json';

export type AppLanguage = 'zh-CN' | 'en';
export type TranslationParameters = Record<string, string | number>;

const STORAGE_KEY = 'i18nextLng';
const resources: Partial<Record<AppLanguage, Record<string, string>>> = {
  'zh-CN': zhCN,
};
const listeners = new Set<() => void>();
let englishResourcePromise: Promise<void> | null = null;

export const ensureLanguageResources = async (language: AppLanguage): Promise<void> => {
  if (language !== 'en' || resources.en) return;
  englishResourcePromise ??= import('./locales/en.json').then(({ default: english }) => {
    resources.en = english;
  });
  await englishResourcePromise;
};

export const normalizeLanguage = (language: string | null | undefined): AppLanguage =>
  language?.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';

export const interpolateTranslation = (
  template: string,
  parameters: TranslationParameters = {},
): string => template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) =>
  Object.prototype.hasOwnProperty.call(parameters, key) ? String(parameters[key]) : match);

export const translate = (
  language: AppLanguage,
  key: string,
  parameters?: TranslationParameters,
): string => interpolateTranslation(resources[language]?.[key] ?? resources['zh-CN']?.[key] ?? key, parameters);

const readStoredLanguage = (): AppLanguage => {
  try {
    return normalizeLanguage(globalThis.localStorage?.getItem(STORAGE_KEY));
  } catch {
    return 'zh-CN';
  }
};

let currentLanguage = readStoredLanguage();

const persistLanguage = (language: AppLanguage) => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
};

const syncDocumentLanguage = (language: AppLanguage) => {
  if (globalThis.document) {
    globalThis.document.documentElement.lang = language;
  }
};

syncDocumentLanguage(currentLanguage);

const i18n = {
  get language(): AppLanguage {
    return currentLanguage;
  },
  get resolvedLanguage(): AppLanguage {
    return currentLanguage;
  },
  async changeLanguage(language: string): Promise<void> {
    const nextLanguage = normalizeLanguage(language);
    await ensureLanguageResources(nextLanguage);
    persistLanguage(nextLanguage);
    syncDocumentLanguage(nextLanguage);
    if (nextLanguage === currentLanguage) return;

    currentLanguage = nextLanguage;
    listeners.forEach((listener) => listener());
  },
};

export const initializeI18n = async (): Promise<void> => {
  await ensureLanguageResources(currentLanguage);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getLanguageSnapshot = () => currentLanguage;

export const useTranslation = () => {
  const language = useSyncExternalStore(subscribe, getLanguageSnapshot, getLanguageSnapshot);
  const t = useCallback(
    (key: string, parameters?: TranslationParameters) => translate(language, key, parameters),
    [language],
  );

  return { t, i18n };
};

export default i18n;
