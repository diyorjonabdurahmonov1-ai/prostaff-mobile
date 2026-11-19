/**
 * The language the app is set to, readable outside React.
 *
 * `useI18n` is for screens. Code that has no component around it — the request
 * client telling the server which language to write notifications in, a banner
 * posted from a polling loop — reads it here. The provider keeps it current.
 */

import { dictionaries, type Language, type TranslationKey } from './dictionaries';

let current: Language = 'uz';

export function setCurrentLang(lang: Language) {
  current = lang;
}

export function getCurrentLang(): Language {
  return current;
}

/** A plain translation for non-React code. */
export function tNow(key: TranslationKey): string {
  return dictionaries[current][key] ?? dictionaries.uz[key] ?? key;
}

/**
 * The message for a server error code, in the app's language.
 *
 * The server writes its refusals in Uzbek. Rather than show a Russian-speaking
 * customer an Uzbek sentence, the app owns the wording of the codes it knows and
 * falls back to the server's own text for any it does not.
 */
export function errorText(
  code: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  const own = dictionaries[current] as Record<string, string>;
  const uz = dictionaries.uz as Record<string, string>;
  const template = own[`err.${code}`] ?? uz[`err.${code}`];
  if (!template) return fallback;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    params && name in params ? String(params[name]) : m,
  );
}
