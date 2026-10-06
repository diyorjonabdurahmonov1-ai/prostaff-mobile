/**
 * Job category → Phosphor glyph.
 *
 * There is no icon on the form the admin fills in: a category is a name, and
 * asking the office to also pick a picture for it was a field they had to answer
 * before they could add the thing they came to add. So the glyph is derived here
 * instead, from the category's stable key.
 *
 * The seven seeded categories are keyed and mapped below. Anything the office
 * adds gets the briefcase — deliberately generic rather than wrong, and the same
 * glyph an older app version shows for a category a newer one introduced.
 *
 * If the grid ever needs more than one shape again, this is the file: add the
 * key here, or give the admin a picker writing into `Category.icon` and consult
 * it above the map.
 */

import type { IconName } from '@/components/ui/icon';
import type { Category } from '@/lib/types';

const BY_KEY: Record<string, IconName> = {
  banquet_helper: 'confetti',
  gardening: 'tree',
  mover_coal: 'truck',
  loader: 'package',
  post_repair_clean: 'broom',
  master_helper: 'wrench',
  room_clean: 'spray-bottle',
  // The obvious next additions. A key is slugified from the name the admin
  // types, so a category called "Tozalash" lands on `cleaning` by itself.
  construction: 'hard-hat',
  cleaning: 'broom',
  tozalash: 'broom',
  delivery: 'truck',
  yetkazib_berish: 'truck',
  repair: 'wrench',
  // The apostrophe in "Ta'mirlash" slugifies to a separator, so both spellings
  // are here rather than only the one somebody guessed at.
  ta_mirlash: 'wrench',
  tamirlash: 'wrench',
  santexnika: 'wrench',
  elektrika: 'lightning',
  bog_ishlari: 'tree',
};

export function categoryIcon(category: Category | undefined): IconName {
  if (!category) return 'briefcase';
  return BY_KEY[category.key] ?? 'briefcase';
}
