/**
 * „Wyślij do notatki dziennej" (M36): budowa żądania PATCH pluginu
 * Local REST API — dopisanie treści pod wskazany nagłówek bez przepisywania
 * pliku. Czysta logika; fetch wykonuje src/main/obsidian.ts.
 */

export interface ObsidianRestConfig {
  /** Adres serwera Local REST API (HTTP na loopbacku). */
  url?: string;
  apiKey?: string;
  /** Ścieżka notatki względem vaulta; {date} → dzisiejsza data YYYY-MM-DD. */
  dailyFile?: string;
  /** Nagłówek, pod który dopisujemy. */
  dailyHeading?: string;
}

export const OBSIDIAN_DEFAULT_URL = 'http://127.0.0.1:27123';

export function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function resolveDailyPath(template: string, date: Date): string {
  return template.replaceAll('{date}', formatLocalDate(date));
}

export interface ObsidianAppendRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Null, gdy konfiguracja jest niekompletna (brak klucza/pliku/nagłówka). */
export function buildAppendRequest(
  config: ObsidianRestConfig,
  content: string,
  date: Date,
): ObsidianAppendRequest | null {
  const apiKey = config.apiKey?.trim() ?? '';
  const dailyFile = config.dailyFile?.trim() ?? '';
  const dailyHeading = config.dailyHeading?.trim() ?? '';
  if (apiKey === '' || dailyFile === '' || dailyHeading === '') {
    return null;
  }
  const base = (config.url?.trim() || OBSIDIAN_DEFAULT_URL).replace(/\/+$/, '');
  const notePath = resolveDailyPath(dailyFile, date)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return {
    url: `${base}/vault/${notePath}`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'text/markdown',
      Operation: 'append',
      'Target-Type': 'heading',
      Target: dailyHeading,
    },
    body: content.endsWith('\n') ? content : `${content}\n`,
  };
}
