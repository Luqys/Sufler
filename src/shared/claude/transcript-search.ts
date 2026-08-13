/**
 * Szukanie w treści rozmów (M83). Panel „Sesje" filtrował dotąd tytuły
 * i gałęzie — czyli pierwsze polecenie i nic więcej. Pytanie „gdzie ja o tym
 * rozmawiałem" wymagało otwierania sesji po kolei.
 *
 * Czysta logika: skaner karmiony linia po linii (transkrypty sięgają
 * dziesiątek megabajtów) plus wycinanie fragmentu wokół trafienia.
 */

export interface TranscriptHit {
  role: 'user' | 'assistant';
  /** Fragment wokół trafienia, z wielokropkami na obciętych brzegach. */
  snippet: string;
  /** Pozycja trafienia W SNIPPECIE — do podświetlenia w rendererze. */
  offset: number;
  length: number;
  timestampMs: number;
}

export interface SessionHits {
  /** UUID sesji = nazwa pliku transkryptu bez rozszerzenia. */
  id: string;
  hits: TranscriptHit[];
  /** Ile trafień pominięto po przekroczeniu limitu na sesję. */
  more: number;
}

/** Ile znaków kontekstu po każdej stronie trafienia. */
const CONTEXT = 60;

/** Bez ogonków i wielkości liter — „gałąź" ma się znaleźć po wpisaniu „galaz". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();
}

/**
 * Fragment wokół trafienia. Tniemy po znormalizowanej treści, ale wycinamy
 * z ORYGINAŁU — inaczej podgląd gubiłby ogonki i wielkie litery.
 */
export function snippetAround(
  text: string,
  index: number,
  length: number,
  context = CONTEXT,
): { snippet: string; offset: number } {
  const from = Math.max(0, index - context);
  const to = Math.min(text.length, index + length + context);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < text.length ? '…' : '';
  return {
    snippet: `${prefix}${text.slice(from, to)}${suffix}`,
    offset: index - from + prefix.length,
  };
}

interface TranscriptEntry {
  type?: unknown;
  isMeta?: unknown;
  isSidechain?: unknown;
  timestamp?: unknown;
  message?: { content?: unknown };
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block === 'object' && block !== null) {
      const typed = block as { type?: unknown; text?: unknown };
      if (typed.type === 'text' && typeof typed.text === 'string') {
        parts.push(typed.text);
      }
    }
  }
  return parts.join(' ');
}

export interface HitScanner {
  push(line: string): void;
  result(): { hits: TranscriptHit[]; more: number };
}

/**
 * Skaner trafień w jednym transkrypcie. Pomija wpisy meta i opakowania komend
 * lokalnych (`<command-name>…`) — tak samo jak lista sesji, żeby wyszukiwanie
 * nie znajdowało rzeczy, których w rozmowie nie widać.
 */
export function createHitScanner(query: string, limit = 3): HitScanner {
  const needle = normalizeForSearch(query.trim());
  const hits: TranscriptHit[] = [];
  let more = 0;

  const push = (line: string): void => {
    if (needle === '' || line === '') {
      return;
    }
    let entry: TranscriptEntry;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }
      entry = parsed as TranscriptEntry;
    } catch {
      return; // ucięta linia na końcu pliku
    }
    const isUser = entry.type === 'user';
    const isAssistant = entry.type === 'assistant';
    if ((!isUser && !isAssistant) || entry.isMeta === true || entry.isSidechain === true) {
      return;
    }
    const text = textFromContent(entry.message?.content).replace(/\s+/g, ' ').trim();
    if (text === '' || text.startsWith('<')) {
      return;
    }
    const index = normalizeForSearch(text).indexOf(needle);
    if (index === -1) {
      return;
    }
    if (hits.length >= limit) {
      more += 1;
      return;
    }
    const stamp = typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : Number.NaN;
    const { snippet, offset } = snippetAround(text, index, needle.length);
    hits.push({
      role: isUser ? 'user' : 'assistant',
      snippet,
      offset,
      length: needle.length,
      timestampMs: Number.isNaN(stamp) ? 0 : stamp,
    });
  };

  return { push, result: () => ({ hits, more }) };
}

/** Wygodne opakowanie do testów i małych wejść. */
export function scanTranscriptLines(
  lines: string[],
  query: string,
  limit = 3,
): { hits: TranscriptHit[]; more: number } {
  const scanner = createHitScanner(query, limit);
  for (const line of lines) {
    scanner.push(line);
  }
  return scanner.result();
}

/** Fraza krótsza niż to nie ma sensu — zwróciłaby pół historii. */
export const MIN_QUERY = 3;

export function isSearchableQuery(query: string): boolean {
  return query.trim().length >= MIN_QUERY;
}
