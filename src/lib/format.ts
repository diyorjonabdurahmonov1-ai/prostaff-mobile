import type { Language } from '@/i18n';
import type { Category } from '@/lib/types';

/** Format integer so'm with thin-space grouping, e.g. 10000 -> "10 000". */
export function formatSom(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Localized category name with graceful fallback. */
export function categoryName(category: Category | undefined, lang: Language): string {
  if (!category) return '';
  if (lang === 'ru') return category.name_ru || category.name_uz;
  if (lang === 'en') return category.name_en || category.name_uz;
  return category.name_uz;
}

/** Normalize a phone into a `tel:` target. */
export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
