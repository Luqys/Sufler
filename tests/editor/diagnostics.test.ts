import { describe, expect, it } from 'vitest';
import {
  diagnosticsForFile,
  parseEslintJson,
  parseTscOutput,
  sortDiagnostics,
  summarize,
} from '../../src/shared/editor/diagnostics';

/** Zamrożone wyjście `tsc --noEmit --pretty false` (wersja 5.x). */
const TSC_OUTPUT = [
  "src/main/index.ts(294,65): error TS2304: Cannot find name 'HookLayer'.",
  'src/shared/i18n.ts(522,3): error TS1117: An object literal cannot have multiple properties',
  '    with the same name.',
  "src/renderer/src/app.tsx(12,7): warning TS6133: 'unused' is declared but its value is never read.",
  '',
].join('\n');

const ESLINT_OUTPUT = JSON.stringify([
  {
    filePath: '/projekt/src/main/git-commit.ts',
    messages: [
      {
        ruleId: 'no-useless-assignment',
        severity: 2,
        message: "The value assigned to 'shortHash' is not used in subsequent statements",
        line: 100,
        column: 7,
      },
      { ruleId: null, severity: 1, message: 'Bez reguły', line: 4, column: 1 },
    ],
  },
  { filePath: '/projekt/src/czysty.ts', messages: [] },
]);

describe('parseTscOutput', () => {
  it('czyta plik, pozycję, poziom i kod błędu', () => {
    const items = parseTscOutput(TSC_OUTPUT);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      file: 'src/main/index.ts',
      line: 294,
      column: 65,
      severity: 'error',
      message: "Cannot find name 'HookLayer'.",
      source: 'tsc',
      code: 'TS2304',
    });
  });

  it('doklej linie kontynuacji do poprzedniego błędu zamiast je gubić', () => {
    const items = parseTscOutput(TSC_OUTPUT);
    expect(items[1]?.message).toBe(
      'An object literal cannot have multiple properties with the same name.',
    );
  });

  it('rozpoznaje ostrzeżenia', () => {
    expect(parseTscOutput(TSC_OUTPUT)[2]?.severity).toBe('warning');
  });

  it('ścieżki absolutne skraca do względnych wobec korzenia', () => {
    const items = parseTscOutput("/projekt/src/a.ts(1,2): error TS1: Ups.", '/projekt');
    expect(items[0]?.file).toBe('src/a.ts');
  });

  it('śmieci i puste wyjście nie produkują wpisów', () => {
    expect(parseTscOutput('')).toEqual([]);
    expect(parseTscOutput('Kompilacja zakończona\nbez błędów')).toEqual([]);
  });
});

describe('parseEslintJson', () => {
  it('spłaszcza pliki do wpisów i tłumaczy poziomy', () => {
    const items = parseEslintJson(ESLINT_OUTPUT, '/projekt');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      file: 'src/main/git-commit.ts',
      line: 100,
      column: 7,
      severity: 'error',
      source: 'eslint',
      code: 'no-useless-assignment',
    });
    expect(items[1]?.severity).toBe('warning');
  });

  it('brak reguły daje pusty kod, nie „null"', () => {
    expect(parseEslintJson(ESLINT_OUTPUT, '/projekt')[1]?.code).toBe('');
  });

  it('niepoprawny JSON zwraca pustą listę zamiast wybuchać', () => {
    expect(parseEslintJson('to nie JSON')).toEqual([]);
    expect(parseEslintJson('{"nie":"tablica"}')).toEqual([]);
  });
});

describe('sortDiagnostics', () => {
  it('błędy przed ostrzeżeniami, dalej po pliku i pozycji', () => {
    const sorted = sortDiagnostics([
      ...parseTscOutput(TSC_OUTPUT),
      ...parseEslintJson(ESLINT_OUTPUT, '/projekt'),
    ]);
    expect(sorted.map((item) => item.severity)).toEqual([
      'error',
      'error',
      'error',
      'warning',
      'warning',
    ]);
    expect(sorted[0]?.file <= (sorted[1]?.file ?? '')).toBe(true);
  });
});

describe('summarize', () => {
  it('liczy błędy i ostrzeżenia oraz przenosi awarie narzędzi', () => {
    const result = summarize(parseTscOutput(TSC_OUTPUT), [
      { source: 'eslint', message: 'brak-narzedzia' },
    ]);
    expect(result.errors).toBe(2);
    expect(result.warnings).toBe(1);
    expect(result.failed[0]?.source).toBe('eslint');
  });

  it('czysty projekt to zera, nie brak wyniku', () => {
    expect(summarize([])).toEqual({ items: [], errors: 0, warnings: 0, failed: [] });
  });
});

describe('diagnosticsForFile', () => {
  it('wybiera wpisy jednego pliku — do podkreśleń w buforze', () => {
    const items = parseTscOutput(TSC_OUTPUT);
    expect(diagnosticsForFile(items, 'src/main/index.ts')).toHaveLength(1);
    expect(diagnosticsForFile(items, 'src/nieznany.ts')).toEqual([]);
  });
});
