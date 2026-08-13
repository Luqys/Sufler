import { useMemo, useSyncExternalStore } from 'react';
import type { Language } from '../../shared/project/appearance';
import { fillPlaceholders, localeFor, pluralForm, stringsFor, type StringKey } from '../../shared/i18n';

/**
 * Bieżący język UI poza Reactem (jak terminals.ts) — moduły nie-reactowe
 * czytają t() w momencie zdarzenia, komponenty subskrybują przez useT().
 */

let language: Language = 'pl';
const listeners = new Set<() => void>();

export function setLanguage(next: Language): void {
  if (next !== language) {
    language = next;
    for (const listener of listeners) {
      listener();
    }
  }
}

export function getLanguage(): Language {
  return language;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tłumaczenie klucza w bieżącym języku. */
export function t(key: StringKey): string {
  return stringsFor(language)[key];
}

/** Tłumaczenie z podstawieniem placeholderów {nazwa}. */
export function tf(key: StringKey, vars: Record<string, string | number>): string {
  return fillPlaceholders(t(key), vars);
}

/** „{n} {forma}" — liczba z poprawną formą liczby mnogiej (klucz z formami po |). */
export function tp(key: StringKey, n: number): string {
  return `${n} ${pluralForm(language, n, t(key))}`;
}

/** Locale bieżącego języka (formatowanie dat/liczb). */
export function getLocale(): string {
  return localeFor(language);
}

/** Hook: przerysowuje komponent po zmianie języka; zwraca funkcję t. */
export function useT(): typeof t {
  const lang = useSyncExternalStore(subscribe, getLanguage);
  return useMemo(() => {
    const strings = stringsFor(lang);
    return (key: StringKey) => strings[key];
  }, [lang]);
}
