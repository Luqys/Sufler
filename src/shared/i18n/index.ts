import type { Language } from '../project/appearance';
import type { StringKey } from './klucze';
import { EN } from './en';
import { PL } from './pl';

/**
 * Słownik tekstów UI. Teksty siedzą w `pl.ts` i `en.ts`, tutaj zostaje wybór
 * języka i formatowanie (liczba mnoga, placeholdery {nazwa}).
 */

export { EN, PL };
export type { StringKey } from './klucze';

export function stringsFor(lang: Language): Record<StringKey, string> {
  return lang === 'en' ? EN : PL;
}

/**
 * Forma liczby mnogiej z form rozdzielonych `|`.
 * PL: jeden|2-4 (poza 12-14)|reszta; EN: jeden|reszta.
 */
export function pluralForm(lang: Language, n: number, forms: string): string {
  const parts = forms.split('|');
  if (lang === 'en') {
    return (n === 1 ? parts[0] : parts[1] ?? parts[0]) ?? '';
  }
  if (n === 1) {
    return parts[0] ?? '';
  }
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return parts[1] ?? parts[0] ?? '';
  }
  return parts[2] ?? parts[1] ?? parts[0] ?? '';
}

/** Locale do formatowania dat/liczb zgodnie z językiem UI. */
export function localeFor(lang: Language): string {
  return lang === 'en' ? 'en-US' : 'pl-PL';
}

/** Podstawia {nazwa} w tekście; nieznane placeholdery zostawia bez zmian. */
export function fillPlaceholders(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
