/**
 * Zużycie Claude Code liczone lokalnie z transkryptów ~/.claude/projects/**.jsonl
 * (wpisy type=assistant niosą message.usage). Czysta logika — testowana.
 */

export interface UsageEntry {
  timestamp: number;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
}

export interface UsagePeriod {
  label: string;
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
}

/**
 * Szacunek okna 5h (jak okna limitów Claude): tokeny wejścia+wyjścia (bez cache)
 * bieżącego okna względem największego okna z ostatnich 30 dni.
 */
export interface UsageBlockInfo {
  currentTokens: number;
  maxTokens: number;
  /** null, gdy brak historii do kalibracji. */
  percent: number | null;
  /** Granice bieżącego okna 5h (ms epoch) — do paska czasu i godziny resetu. */
  windowStart: number;
  windowEnd: number;
}

export interface UsageSummary {
  periods: UsagePeriod[];
  topModels: Array<{ model: string; requests: number; output: number }>;
  scannedFiles: number;
  block: UsageBlockInfo;
}

/** Parsuje jedną linię JSONL; null gdy to nie jest wpis assistant z usage. */
export function parseUsageLine(line: string): UsageEntry | null {
  if (!line.includes('"assistant"') || !line.includes('"usage"')) {
    return null;
  }
  try {
    const parsed = JSON.parse(line) as {
      type?: string;
      timestamp?: string;
      message?: {
        model?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        };
      };
    };
    if (parsed.type !== 'assistant' || !parsed.message?.usage || !parsed.timestamp) {
      return null;
    }
    const usage = parsed.message.usage;
    const timestamp = Date.parse(parsed.timestamp);
    if (Number.isNaN(timestamp)) {
      return null;
    }
    return {
      timestamp,
      model: parsed.message.model ?? 'nieznany',
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      cacheCreate: usage.cache_creation_input_tokens ?? 0,
    };
  } catch {
    return null;
  }
}

function emptyPeriod(label: string): UsagePeriod {
  return { label, requests: 0, input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
}

function addTo(period: UsagePeriod, entry: UsageEntry): void {
  period.requests += 1;
  period.input += entry.input;
  period.output += entry.output;
  period.cacheRead += entry.cacheRead;
  period.cacheCreate += entry.cacheCreate;
}

export function summarizeUsage(
  entries: UsageEntry[],
  now: number,
  scannedFiles: number,
): UsageSummary {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const today = emptyPeriod('Dziś');
  const week = emptyPeriod('7 dni');
  const month = emptyPeriod('30 dni');
  const dayMs = 24 * 60 * 60 * 1000;
  const blockMs = 5 * 60 * 60 * 1000;
  const models = new Map<string, { requests: number; output: number }>();
  const blocks = new Map<number, number>();

  for (const entry of entries) {
    if (entry.timestamp > now || entry.timestamp < now - 30 * dayMs) {
      continue;
    }
    addTo(month, entry);
    if (entry.timestamp >= now - 7 * dayMs) {
      addTo(week, entry);
    }
    if (entry.timestamp >= startOfToday.getTime()) {
      addTo(today, entry);
    }
    const model = models.get(entry.model) ?? { requests: 0, output: 0 };
    model.requests += 1;
    model.output += entry.output;
    models.set(entry.model, model);

    const blockIndex = Math.floor(entry.timestamp / blockMs);
    blocks.set(blockIndex, (blocks.get(blockIndex) ?? 0) + entry.input + entry.output);
  }

  const topModels = [...models.entries()]
    .map(([model, stats]) => ({ model, ...stats }))
    .sort((a, b) => b.output - a.output)
    .slice(0, 4);

  const currentIndex = Math.floor(now / blockMs);
  const currentTokens = blocks.get(currentIndex) ?? 0;
  const maxTokens = blocks.size > 0 ? Math.max(...blocks.values()) : 0;
  const block: UsageBlockInfo = {
    currentTokens,
    maxTokens,
    percent: maxTokens > 0 ? Math.min(100, Math.round((currentTokens / maxTokens) * 100)) : null,
    windowStart: currentIndex * blockMs,
    windowEnd: (currentIndex + 1) * blockMs,
  };

  return { periods: [today, week, month], topModels, scannedFiles, block };
}

/** 1234 → „1,2 tys.", 5 600 000 → „5,6 mln"; poniżej tysiąca — pełna liczba. */
export function formatTokens(value: number): string {
  if (value < 1000) {
    return String(value);
  }
  if (value < 1_000_000) {
    return `${(value / 1000).toFixed(1).replace('.', ',')} tys.`;
  }
  return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mln`;
}
