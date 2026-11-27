import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { LANGUAGES, MESSAGES } from './messages';
import type { Language, MessageKey } from './messages';

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export interface I18n {
  language: Language;
  t: Translate;
  formatNumber: (value: number) => string;
  formatCompact: (value: number) => string;
  formatTime: (atMs: number) => string;
}

export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    const match = LANGUAGES.find((language) => language === base);
    if (match) {
      return match;
    }
  }
  return 'en';
}

export function createI18n(language: Language): I18n {
  const messages = MESSAGES[language];
  const numberFormat = new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US');
  const compactFormat = new Intl.NumberFormat(language === 'es' ? 'es-ES' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  });
  const timeFormat = new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    language,
    t: (key, params = {}) =>
      messages[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        name in params ? String(params[name]) : placeholder,
      ),
    formatNumber: (value) => numberFormat.format(value),
    formatCompact: (value) => compactFormat.format(value),
    formatTime: (atMs) => timeFormat.format(new Date(atMs)),
  };
}

export const I18nContext = createContext<I18n>(createI18n('en'));

export function useI18n(): I18n {
  return useContext(I18nContext);
}
