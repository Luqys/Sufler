/**
 * Historia zużycia (M73). Wskaźnik na pasku pokazuje stan chwilowy, a M57
 * prognozę wyczerpania limitu — brakowało przeszłości. Transkrypty sesji
 * (`~/.claude/projects/<slug>/*.jsonl`) mają zużycie każdej odpowiedzi
 * modelu, więc sumę da się policzyć bez pytania kogokolwiek o dane.
 *
 * Czysta logika, karmiona linia po linii: transkrypty sięgają dziesiątek
 * megabajtów i nie wolno ich wczytywać w całości.
 */

export interface UsageTotals {
  input: number;
  output: number;
  /** Zapis pamięci podręcznej promptu (`cache_creation_input_tokens`). */
  cacheWrite: number;
  /** Odczyt z pamięci podręcznej (`cache_read_input_tokens`) — tani, ale liczy się. */
  cacheRead: number;
  /** Ile odpowiedzi modelu złożyło się na tę sumę. */
  replies: number;
}

export interface UsageDay {
  /** Data lokalna w formacie YYYY-MM-DD. */
  date: string;
  totals: UsageTotals;
}

export interface UsageScan {
  totals: UsageTotals;
  byDay: UsageDay[];
  byModel: Array<{ model: string; totals: UsageTotals }>;
}

export function emptyTotals(): UsageTotals {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, replies: 0 };
}

/** Suma tokenów wszystkich rodzajów — jedna liczba do nagłówka. */
export function totalTokens(totals: UsageTotals): number {
  return totals.input + totals.output + totals.cacheWrite + totals.cacheRead;
}

export function addTotals(target: UsageTotals, source: UsageTotals): void {
  target.input += source.input;
  target.output += source.output;
  target.cacheWrite += source.cacheWrite;
  target.cacheRead += source.cacheRead;
  target.replies += source.replies;
}

function numberAt(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Data lokalna z ISO — bez przesunięcia strefowego, które psuje podział na dni. */
export function localDay(iso: string): string | null {
  const stamp = Date.parse(iso);
  if (Number.isNaN(stamp)) {
    return null;
  }
  const date = new Date(stamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface UsageScanner {
  push(line: string): void;
  result(): UsageScan;
}

/**
 * Skaner zużycia. Liczy wyłącznie wpisy typu `assistant` z polem
 * `message.usage` — wpisy użytkownika i meta nie zużywają tokenów, a wpisy
 * subagentów tak (idą na ten sam limit), więc ich nie odsiewamy.
 */
export function createUsageScanner(): UsageScanner {
  const totals = emptyTotals();
  const days = new Map<string, UsageTotals>();
  const models = new Map<string, UsageTotals>();

  const push = (line: string): void => {
    if (line === '' || !line.includes('"usage"')) {
      return;
    }
    let entry: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }
      entry = parsed as Record<string, unknown>;
    } catch {
      return; // ucięta linia na końcu pliku — pomijamy, nie przerywamy
    }
    if (entry['type'] !== 'assistant') {
      return;
    }
    const message = entry['message'];
    if (typeof message !== 'object' || message === null) {
      return;
    }
    const usage = (message as Record<string, unknown>)['usage'];
    if (typeof usage !== 'object' || usage === null) {
      return;
    }
    const record = usage as Record<string, unknown>;
    const one: UsageTotals = {
      input: numberAt(record, 'input_tokens'),
      output: numberAt(record, 'output_tokens'),
      cacheWrite: numberAt(record, 'cache_creation_input_tokens'),
      cacheRead: numberAt(record, 'cache_read_input_tokens'),
      replies: 1,
    };
    addTotals(totals, one);

    const timestamp = entry['timestamp'];
    const day = typeof timestamp === 'string' ? localDay(timestamp) : null;
    if (day !== null) {
      const bucket = days.get(day) ?? emptyTotals();
      addTotals(bucket, one);
      days.set(day, bucket);
    }

    const model = (message as Record<string, unknown>)['model'];
    if (typeof model === 'string' && model !== '') {
      const bucket = models.get(model) ?? emptyTotals();
      addTotals(bucket, one);
      models.set(model, bucket);
    }
  };

  const result = (): UsageScan => ({
    totals,
    byDay: [...days.entries()]
      .map(([date, dayTotals]) => ({ date, totals: dayTotals }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    byModel: [...models.entries()]
      .map(([model, modelTotals]) => ({ model, totals: modelTotals }))
      .sort((a, b) => totalTokens(b.totals) - totalTokens(a.totals)),
  });

  return { push, result };
}

/** Wygodne opakowanie do testów i małych wejść. */
export function scanUsageLines(lines: string[]): UsageScan {
  const scanner = createUsageScanner();
  for (const line of lines) {
    scanner.push(line);
  }
  return scanner.result();
}

/**
 * Ostatnie `count` dni kalendarzowych licząc wstecz od `todayIso`, w kolejności
 * od najstarszego. Dni bez ruchu dostają zera — wykres ma pokazywać przerwy
 * w pracy, a nie ściskać słupki obok siebie.
 */
export function lastDays(scan: UsageScan, todayIso: string, count: number): UsageDay[] {
  const byDate = new Map(scan.byDay.map((entry) => [entry.date, entry.totals]));
  const base = Date.parse(todayIso);
  const out: UsageDay[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(base);
    date.setDate(date.getDate() - offset);
    const iso = localDay(date.toISOString());
    if (iso === null) {
      continue;
    }
    out.push({ date: iso, totals: byDate.get(iso) ?? emptyTotals() });
  }
  return out;
}
