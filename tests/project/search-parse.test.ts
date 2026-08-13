import { describe, expect, it } from 'vitest';
import { parseRipgrepJson } from '../../src/main/project/search';

function matchLine(path: string, line: number, text: string, start: number): string {
  return JSON.stringify({
    type: 'match',
    data: {
      path: { text: path },
      lines: { text },
      line_number: line,
      absolute_offset: 0,
      submatches: [{ match: { text: 'answer' }, start, end: start + 6 }],
    },
  });
}

describe('parseRipgrepJson', () => {
  it('wyciąga trafienia z NDJSON, ignorując begin/end/summary', () => {
    const stdout = [
      JSON.stringify({ type: 'begin', data: { path: { text: 'src/app.ts' } } }),
      matchLine('src/app.ts', 1, 'export const answer = 42;\n', 13),
      JSON.stringify({ type: 'end', data: {} }),
      JSON.stringify({ type: 'summary', data: {} }),
    ].join('\n');
    const { matches, truncated } = parseRipgrepJson(stdout);
    expect(truncated).toBe(false);
    expect(matches).toEqual([
      { path: 'src/app.ts', line: 1, column: 14, preview: 'export const answer = 42;' },
    ]);
  });

  it('tnie wyniki do limitu i ustawia truncated', () => {
    const stdout = [
      matchLine('a.ts', 1, 'answer\n', 0),
      matchLine('a.ts', 2, 'answer\n', 0),
      matchLine('a.ts', 3, 'answer\n', 0),
    ].join('\n');
    const { matches, truncated } = parseRipgrepJson(stdout, 2);
    expect(matches).toHaveLength(2);
    expect(truncated).toBe(true);
  });

  it('przeżywa śmieciowe linie', () => {
    const { matches } = parseRipgrepJson('nie-json\n{"type":"match"}\n');
    expect(matches).toEqual([]);
  });

  it('normalizuje ścieżki z prefiksem ./', () => {
    const { matches } = parseRipgrepJson(matchLine('./src/app.ts', 3, 'answer\n', 0));
    expect(matches[0]?.path).toBe('src/app.ts');
  });
});
