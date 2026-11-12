/**
 * A picture for every category — including the ones nobody has added yet.
 *
 * The office adds a category by typing its name; there is no picture to
 * upload, and asking for one would be a field they had to fill before they
 * could add the thing they came to add. So the picture is worked out from the
 * name: the words in it (Uzbek, Russian or English) are matched against the
 * kinds of work below, and each kind has its own glyph and colour.
 *
 * "Konditsioner o'rnatish" added next year gets a snowflake on ice blue
 * without anybody touching the app. A name that matches nothing still gets a
 * picture — the briefcase, on a colour that is stable for that category — so a
 * new category never shows as a blank tile.
 *
 * To teach it a new kind of work, add a row to THEMES. Put the more specific
 * rows first: the first match wins.
 */

import type { IconName } from '@/components/ui/icon';
import type { Category } from '@/lib/types';

export interface CategoryArt {
  icon: IconName;
  /** Top-left → bottom-right gradient. */
  colors: readonly [string, string];
}

interface Theme extends CategoryArt {
  /** Lower-case word stems, apostrophes removed; matched anywhere in the name. */
  words: string[];
}

const THEMES: Theme[] = [
  { words: ['konditsioner', 'кондицион', 'air cond', 'muzlatgich', 'холодильник', 'sovutgich'], icon: 'snowflake', colors: ['#7DD3FC', '#0EA5E9'] },
  { words: ['benzin', 'бензин', 'fuel', 'yoqilgi', 'топлив', 'zapravka', 'заправ'], icon: 'gas-pump', colors: ['#F87171', '#B91C1C'] },
  { words: ['santex', 'сантех', 'plumb', 'quvur', 'kran', 'водопровод', 'kanaliz'], icon: 'drop', colors: ['#38BDF8', '#0369A1'] },
  { words: ['elektr', 'электр', 'electric', 'rozetka', 'розетк', 'chiroq'], icon: 'lightning', colors: ['#FBBF24', '#D97706'] },
  { words: ['payvand', 'свар', 'weld'], icon: 'fire', colors: ['#FB7185', '#BE123C'] },
  { words: ['boyoq', 'boyash', 'покрас', 'маляр', 'paint', 'oboy', 'обои', 'gulqogoz'], icon: 'paint-roller', colors: ['#F472B6', '#BE185D'] },
  { words: ['mebel', 'мебел', 'furnitur', 'divan', 'shkaf'], icon: 'couch', colors: ['#D4A373', '#92400E'] },
  { words: ['tozala', 'clean', 'уборк', 'убира', 'supur', 'yigishtir', 'клининг'], icon: 'broom', colors: ['#2DD4BF', '#0F766E'] },
  { words: ['avto', 'авто', 'mashina', 'машин', 'shina', 'шин', 'evakuator', 'эвакуатор'], icon: 'car', colors: ['#94A3B8', '#334155'] },
  { words: ['yuvish', 'мойк', 'мытье', 'wash', 'deraza', 'окон'], icon: 'spray-bottle', colors: ['#67E8F9', '#0E7490'] },
  { words: ['bogdorchilik', 'bog ', 'bogbon', 'сад', 'garden', 'daraxt', 'gazon', 'газон', 'lawn', 'kokalamzor'], icon: 'tree', colors: ['#4ADE80', '#15803D'] },
  { words: ['toy', 'banket', 'банкет', 'свадь', 'banquet', 'wedding', 'bayram', 'праздник', 'ofitsiant', 'официант', 'waiter'], icon: 'confetti', colors: ['#FB7185', '#C026D3'] },
  { words: ['oshpaz', 'повар', 'cook', 'ovqat', 'taom', 'oshxona yordam'], icon: 'cooking-pot', colors: ['#FDBA74', '#EA580C'] },
  { words: ['kochirish', 'kochish', 'переезд', 'moving', 'tashish', 'yetkaz', 'достав', 'deliver', 'kuryer', 'курьер', 'courier', 'komir', 'уголь', 'coal', 'gruzovik'], icon: 'truck', colors: ['#818CF8', '#4338CA'] },
  { words: ['yuk', 'груз', 'load', 'hammol', 'tushirish', 'ortish'], icon: 'package', colors: ['#A78BFA', '#6D28D9'] },
  { words: ['qurilish', 'строит', 'construct', 'beton', 'бетон', 'gisht', 'кирпич', 'suvoq', 'штукатур', 'tom yop', 'кровл'], icon: 'hard-hat', colors: ['#FCD34D', '#B45309'] },
  { words: ['tamir', 'ремонт', 'repair', 'usta', 'мастер', 'master', 'handyman', 'sozlash'], icon: 'wrench', colors: ['#FB923C', '#C2410C'] },
  { words: ['sartarosh', 'парикмах', 'barber', 'soch', 'gozallik', 'красот', 'beauty', 'manikyur', 'маникюр'], icon: 'scissors', colors: ['#E879F9', '#A21CAF'] },
  { words: ['tikuv', 'швея', 'шить', 'sewing', 'tailor', 'kiyim'], icon: 'tshirt', colors: ['#F0ABFC', '#9333EA'] },
  { words: ['enaga', 'няня', 'nanny', 'bola qarash', 'babysit'], icon: 'baby', colors: ['#FDBA74', '#F97316'] },
  { words: ['hamshira', 'медсестр', 'nurse', 'parvarish', 'сиделк', 'bemor'], icon: 'first-aid', colors: ['#34D399', '#047857'] },
  { words: ['repetitor', 'репетит', 'tutor', 'oqituvchi', 'учител', 'teacher', 'dars', 'урок', 'lesson', 'tarjim', 'перевод', 'translat'], icon: 'graduation-cap', colors: ['#60A5FA', '#1D4ED8'] },
  { words: ['kompyuter', 'компьют', 'computer', 'dastur', 'программ', 'laptop', 'noutbuk', 'ноутбук', 'internet'], icon: 'laptop', colors: ['#22D3EE', '#0E7490'] },
  { words: ['foto', 'фото', 'photo', 'video', 'видео', 'tasvir'], icon: 'camera', colors: ['#C4B5FD', '#6D28D9'] },
  { words: ['qorovul', 'охран', 'security', 'guard', 'qoriqlash'], icon: 'shield-checkmark', colors: ['#64748B', '#1E293B'] },
  { words: ['hayvon', 'животн', 'veterinar', 'ветеринар', 'pet care'], icon: 'dog', colors: ['#FCA5A5', '#B45309'] },
  { words: ['yordamchi', 'помощник', 'helper', 'ishchi', 'рабоч', 'worker'], icon: 'hammer', colors: ['#60A5FA', '#1D4ED8'] },
];

/** Colours for a name that matched no kind of work — stable per category. */
const FALLBACKS: readonly (readonly [string, string])[] = [
  ['#60A5FA', '#1D4ED8'],
  ['#34D399', '#047857'],
  ['#FBBF24', '#B45309'],
  ['#A78BFA', '#6D28D9'],
  ['#2DD4BF', '#0F766E'],
  ['#FB7185', '#BE123C'],
  ['#818CF8', '#4338CA'],
  ['#FB923C', '#C2410C'],
];

/**
 * A name as the matcher reads it: lower case, every apostrophe Uzbek is typed
 * with removed (so "ta'mirlash", "taʼmirlash" and "tamirlash" are one word),
 * punctuation and the key's underscores turned into spaces, and padded so a
 * stem with a trailing space can mean "a whole word".
 */
function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[ʻʼ’‘'`´]/g, '')
    .replace(/[^a-zа-яёўқғҳ0-9]+/gi, ' ')
    .trim()} `;
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function categoryArt(category: Category | undefined): CategoryArt {
  if (!category) return { icon: 'briefcase', colors: FALLBACKS[0] };
  const text = normalise(
    [category.key, category.name_uz, category.name_ru, category.name_en].filter(Boolean).join(' '),
  );
  const theme = THEMES.find((th) => th.words.some((w) => text.includes(w)));
  if (theme) return { icon: theme.icon, colors: theme.colors };
  return { icon: 'briefcase', colors: FALLBACKS[hash(category.id || category.key) % FALLBACKS.length] };
}
