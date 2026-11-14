import { en } from './en.js';
import { ko } from './ko.js';

export type Lang = 'en' | 'ko';
export type MessageKey = keyof typeof en;

export const messages: Record<Lang, Record<MessageKey, string>> = { en, ko };

export function isLang(value: string): value is Lang {
  return value === 'en' || value === 'ko';
}

function fromLocale(value: string | undefined): Lang | undefined {
  if (value === undefined || value === '') return undefined;
  return value.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

/**
 * Pick the output language: `--lang` flag, then REASONING_DELTA_LANG,
 * then LC_ALL, LC_MESSAGES, LANG (first one that is set), otherwise English.
 */
export function resolveLang(flag: Lang | undefined, env: Record<string, string | undefined>): Lang {
  if (flag !== undefined) return flag;
  return (
    fromLocale(env.REASONING_DELTA_LANG) ??
    fromLocale(env.LC_ALL) ??
    fromLocale(env.LC_MESSAGES) ??
    fromLocale(env.LANG) ??
    'en'
  );
}

/** Look up a message and fill `{name}` placeholders. */
export function t(lang: Lang, key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
