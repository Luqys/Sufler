import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Reporter zbierający PRZYCZYNY padów (M91). Po M82 migotanie jest rzadkie —
 * 1–2 na 130 uruchomień — i nierównomierne między przebiegami: dwa wyłączne
 * przebiegi na sąsiednich commitach dały 2 flaki i 0 flak. Pojedynczy przebieg
 * niczego więc nie rozstrzyga, a bez rozbicia na przyczyny kolejne hipotezy
 * będą tak samo nieweryfikowalne jak dwie poprzednie (zombie procesy,
 * dławienie tła) — obie wycofane po sprawdzeniu.
 *
 * Zapis idzie do e2e-artifacts/ (poza repo, katalog ignorowany), po jednym
 * wierszu na PRÓBĘ zakończoną niepowodzeniem — także tę, którą retry naprawił.
 * Format TSV, żeby serię przebiegów dało się policzyć bez parsera.
 */

/** Klasy przyczyn — rozłączne i prowadzące w różne miejsca kodu. */
export type KlasaPadu =
  /** Asercja na treści (toContainText/toHaveText) — bajty albo render. */
  | 'tresc'
  /** Element niewidoczny/bez klasy — układ albo fokus. */
  | 'widocznosc'
  /** Aplikacja nie wystawiła okna — start procesu. */
  | 'start-okna'
  /** Liczba elementów (toHaveCount) — stan aplikacji, nie render. */
  | 'liczba'
  | 'inne';

export function klasaPadu(komunikat: string): KlasaPadu {
  if (/firstWindow|waiting for event "window"/.test(komunikat)) {
    return 'start-okna';
  }
  if (/toContainText|toHaveText|toHaveValue/.test(komunikat)) {
    return 'tresc';
  }
  if (/toBeVisible|toHaveClass|toBeAttached|toBeEnabled/.test(komunikat)) {
    return 'widocznosc';
  }
  if (/toHaveCount/.test(komunikat)) {
    return 'liczba';
  }
  return 'inne';
}

const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

const PLIK = process.env['VISUALN3O_FLAKI'] ?? 'e2e-artifacts/flaki.tsv';

export default class ReporterFlak implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'passed' || result.status === 'skipped') {
      return;
    }
    // Playwright koloruje komunikaty; bez zdjęcia sekwencji ANSI plik jest
    // nieprzeszukiwalny grepem, a to jedyny sposób liczenia serii przebiegów.
    const bezAnsi = (result.error?.message ?? '').replace(ANSI, '');
    const komunikat = bezAnsi.replace(/\s+/g, ' ').slice(0, 300);
    const wiersz = [
      new Date().toISOString(),
      klasaPadu(komunikat),
      String(result.retry),
      result.status,
      `${test.location.file.split('/e2e/')[1] ?? test.location.file}:${test.location.line}`,
      komunikat,
    ].join('\t');
    mkdirSync(dirname(PLIK), { recursive: true });
    appendFileSync(PLIK, `${wiersz}\n`);
  }
}
