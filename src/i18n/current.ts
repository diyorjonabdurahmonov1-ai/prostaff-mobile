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
