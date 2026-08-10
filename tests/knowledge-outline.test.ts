import { describe, expect, it } from 'vitest';
import { buildOutline, extractHeadings } from '../src/shared/knowledge-outline';

describe('extractHeadings', () => {
  it('zbiera nagłówki #–### i pomija bloki kodu', () => {
    const content = [
      '# Tytuł',
      '## Sekcja',
      '#### za głęboko',
      '```',
      '# to jest kod, nie nagłówek',
      '```',
      '### Podsekcja',
    ].join('\n');
    expect(extractHeadings(content)).toEqual([
      { level: 1, text: 'Tytuł' },
      { level: 2, text: 'Sekcja' },
      { level: 3, text: 'Podsekcja' },
    ]);
  });
});

describe('buildOutline', () => {
  it('buduje deterministyczną mapę notatek z nagłówkami i powiązaniami', () => {
    const outline = buildOutline('projekt', [
      { path: 'PLAN.md', content: '# Plan\n\n## Etap 1\n\nZobacz [[architektura]].\n' },
      { path: 'docs/architektura.md', content: '# Architektura\n' },
    ]);
    expect(outline).toContain('# Konspekt wiedzy — projekt');
    expect(outline).toContain('## 📄 PLAN.md');
    expect(outline).toContain('- Plan');
    expect(outline).toContain('  - Etap 1');
    expect(outline).toContain('- Powiązania: architektura');
    expect(outline).toContain('## 📄 docs/architektura.md');
    // Deterministycznie: dwa przebiegi → identyczna treść (bez znaczników czasu).
    expect(
      buildOutline('projekt', [{ path: 'a.md', content: '# A\n' }]),
    ).toBe(buildOutline('projekt', [{ path: 'a.md', content: '# A\n' }]));
  });
});
