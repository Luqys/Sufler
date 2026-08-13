/**
 * Paleta komend Cmd+K (M74): jedno miejsce na akcje, których nie da się
 * wyklikać bez szukania po pasku tytułu — panele, doki, motyw, ustawienia.
 * `Cmd+P` (M37) otwiera pliki; tu jest cała reszta.
 *
 * Czysta logika: dopasowanie i kolejność. Same akcje powstają w rendererze,
 * bo domykają funkcje układu — tutaj wchodzą już z gotowymi etykietami.
 */

import { fuzzyMatch } from './fuzzy';

export interface PaletteItem {
  id: string;
  /** Etykieta widoczna na liście — już przetłumaczona. */
  label: string;
  /** Nagłówek grupy na liście — już przetłumaczony. */
  group: string;
  /** Dodatkowy tekst do wyszukania (skrót, synonim); nie podświetlamy go. */
  hint?: string;
}

export interface PaletteMatch {
  item: PaletteItem;
  score: number;
  /** Indeksy trafionych znaków w etykiecie — do pogrubienia. */
  positions: number[];
}

/** Trafienie w podpowiedź jest gorsze od trafienia w etykietę. */
const HINT_PENALTY = 1000;

/**
 * Akcje pasujące do zapytania, najlepsze pierwsze. Pusty tekst zwraca listę
 * w kolejności podanej przez wywołującego — paleta bez wpisanej frazy ma być
 * spisem treści aplikacji, a nie losowym rankingiem.
 */
export function filterActions(
  items: readonly PaletteItem[],
  query: string,
  limit = 40,
): PaletteMatch[] {
  const trimmed = query.trim();
  if (trimmed === '') {
    return items.slice(0, limit).map((item) => ({ item, score: 0, positions: [] }));
  }
  const matches: Array<PaletteMatch & { order: number }> = [];
  items.forEach((item, order) => {
    const byLabel = fuzzyMatch(trimmed, item.label);
    if (byLabel) {
      matches.push({ item, score: byLabel.score, positions: byLabel.positions, order });
      return;
    }
    const byHint = item.hint ? fuzzyMatch(trimmed, item.hint) : null;
    if (byHint) {
      matches.push({ item, score: byHint.score - HINT_PENALTY, positions: [], order });
    }
  });
  matches.sort((a, b) => (b.score === a.score ? a.order - b.order : b.score - a.score));
  return matches.slice(0, limit).map(({ item, score, positions }) => ({ item, score, positions }));
}
