/**
 * Historia pracy (M56): jedna oś czasu, na której commity gita spotykają się
 * z dziennikami sesji Claude. Odpowiada na pytanie „która rozmowa doprowadziła
 * do tego commita". Czysta logika scalania — testowana jednostkowo.
 */

export type WorklogKind = 'commit' | 'session';

export interface WorklogEntry {
  kind: WorklogKind;
  /** ISO czasu zdarzenia — klucz sortowania. */
  date: string;
  title: string;
  /** Commit: skrócony hash. Sesja: ścieżka dziennika. */
  reference: string;
  /** Autor commita albo liczba wpisów w dzienniku. */
  detail: string;
}

/** Nagłówek dnia w formacie ISO (RRRR-MM-DD) — do grupowania osi czasu. */
export function dayOf(entry: WorklogEntry): string {
  return entry.date.slice(0, 10);
}

/** Scala i sortuje malejąco po czasie; wpisy bez daty lądują na końcu. */
export function mergeWorklog(entries: readonly WorklogEntry[]): WorklogEntry[] {
  return [...entries].sort((a, b) => {
    const left = Date.parse(a.date);
    const right = Date.parse(b.date);
    if (Number.isNaN(left) && Number.isNaN(right)) {
      return 0;
    }
    if (Number.isNaN(left)) {
      return 1;
    }
    if (Number.isNaN(right)) {
      return -1;
    }
    return right - left;
  });
}

/** Grupy dzień → wpisy, w kolejności od najnowszego dnia. */
export function groupByDay(entries: readonly WorklogEntry[]): Array<[string, WorklogEntry[]]> {
  const groups = new Map<string, WorklogEntry[]>();
  for (const entry of mergeWorklog(entries)) {
    const day = dayOf(entry);
    const bucket = groups.get(day);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(day, [entry]);
    }
  }
  return [...groups.entries()];
}

/** Pierwsze polecenie z dziennika — tytuł wpisu na osi czasu. */
export function firstPromptOf(markdown: string): string | null {
  const match = /\n## \d{2}:\d{2} — polecenie\n\n([^\n]+)/.exec(markdown);
  return match?.[1]?.trim() ?? null;
}

/** Liczba operacji odnotowanych w dzienniku (wiersze listy). */
export function countOperations(markdown: string): number {
  return markdown.split('\n').filter((line) => /^- `\d{2}:\d{2}`/.test(line)).length;
}
