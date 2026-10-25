import { useTranslation, type TranslationParameters } from '@/i18n';
import zh from '@/locales/pit-stops.zh-CN.json';
import en from '@/locales/pit-stops.en.json';

// Keep feature copy out of the shared first-paint language bundle.
export function usePitTranslation() {
  const { t: translate, i18n } = useTranslation();
  const labels: Record<string, string> = i18n.language === 'en' ? en : zh;
  return { t: (key: string, parameters: TranslationParameters = {}) => Object.prototype.hasOwnProperty.call(labels, key)
    ? labels[key].replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => Object.prototype.hasOwnProperty.call(parameters, name) ? String(parameters[name]) : match)
    : translate(key, parameters) };
}
