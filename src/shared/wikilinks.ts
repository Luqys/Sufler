/**
 * Wikilinki w Monaco (M36, warstwa 3 integracji z Obsidianem): czysta logika
 * znajdowania [[nazwa]] w treści — dekoracje-linki podpina renderer.
 */

export interface WikilinkOccurrence {
  /** Nazwa docelowej notatki (bez aliasu `|…` i kotwicy `#…`). */
  name: string;
  /** Pozycje 1-bazowe w konwencji Monaco; zakres obejmuje samą nazwę. */
  line: number;
  startColumn: number;
  endColumn: number;
}

const WIKILINK = /\[\[([^\]|#\n]+)(?:[#|][^\]]*)?\]\]/g;

export function findWikilinks(text: string): WikilinkOccurrence[] {
  const found: WikilinkOccurrence[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    for (const match of line.matchAll(WIKILINK)) {
      const raw = match[1] ?? '';
      const name = raw.trim();
      if (name === '') {
        continue;
      }
      const start = (match.index ?? 0) + 2;
      found.push({
        name,
        line: index + 1,
        startColumn: start + 1,
        endColumn: start + raw.length + 1,
      });
    }
  }
  return found;
}

/** Klucz indeksu nazwa→ścieżka — Obsidian rozwiązuje bez uwzględniania wielkości liter. */
export function noteIndexKey(name: string): string {
  return name.trim().toLowerCase().replace(/\.md$/, '');
}
