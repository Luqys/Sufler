import { describe, expect, it } from 'vitest';
import {
  createHitScanner,
  isSearchableQuery,
  MIN_QUERY,
  normalizeForSearch,
  scanTranscriptLines,
  snippetAround,
} from '../../src/shared/claude/transcript-search';

const wpis = (obj: object): string => JSON.stringify(obj);

const LINES = [
  wpis({ type: 'mode', mode: 'normal' }),
  wpis({
    type: 'user',
    isMeta: true,
    timestamp: '2026-08-13T09:00:00.000Z',
    message: { content: '<command-name>/clear</command-name> gałąź' },
  }),
  wpis({
    type: 'user',
    timestamp: '2026-08-13T09:01:00.000Z',
    message: { content: 'Napraw limity planu przy błędzie 429 na gałęzi wydania' },
  }),
  wpis({
    type: 'assistant',
    timestamp: '2026-08-13T09:02:00.000Z',
    message: {
      content: [
        { type: 'text', text: 'Dodaję cooldown i Retry-After, limity wracają po chwili.' },
        { type: 'tool_use', name: 'Edit', input: {} },
      ],
    },
  }),
  wpis({
    type: 'assistant',
    isSidechain: true,
    timestamp: '2026-08-13T09:03:00.000Z',
    message: { content: 'Subagent też mówi o limitach' },
  }),
  '{"type":"user","message":{"content":', // ucięta linia na końcu pliku
];

describe('normalizeForSearch', () => {
  it('zdejmuje ogonki i wielkość liter', () => {
    expect(normalizeForSearch('GAŁĄŹ Żółć')).toBe('galaz zolc');
  });
});

describe('snippetAround', () => {
  it('wycina kontekst i podaje pozycję trafienia w wycinku', () => {
    const text = 'a'.repeat(100) + 'IGŁA' + 'b'.repeat(100);
    const { snippet, offset } = snippetAround(text, 100, 4, 10);
    expect(snippet).toBe(`…${'a'.repeat(10)}IGŁA${'b'.repeat(10)}…`);
    expect(snippet.slice(offset, offset + 4)).toBe('IGŁA');
  });

  it('bez obcinania nie dokleja wielokropków', () => {
    const { snippet, offset } = snippetAround('krótki tekst', 7, 5, 60);
    expect(snippet).toBe('krótki tekst');
    expect(snippet.slice(offset, offset + 5)).toBe('tekst');
  });
});

describe('createHitScanner', () => {
  it('znajduje frazę w poleceniu i w odpowiedzi', () => {
    const { hits } = scanTranscriptLines(LINES, 'limity');
    expect(hits).toHaveLength(2);
    expect(hits[0]?.role).toBe('user');
    expect(hits[1]?.role).toBe('assistant');
    expect(hits[0]?.snippet).toContain('limity planu');
  });

  it('pomija wpisy meta, opakowania komend i ruch subagentów', () => {
    // „gałąź" jest tylko we wpisie meta i w sidechainie — nie liczy się.
    expect(scanTranscriptLines(LINES, 'gałąź').hits).toEqual([]);
    expect(scanTranscriptLines(LINES, 'Subagent').hits).toEqual([]);
  });

  it('szuka bez ogonków i wielkości liter', () => {
    expect(scanTranscriptLines(LINES, 'GAŁĘZI').hits).toHaveLength(1);
    expect(scanTranscriptLines(LINES, 'galezi').hits).toHaveLength(1);
  });

  it('podświetlenie wskazuje faktyczne miejsce frazy w wycinku', () => {
    const hit = scanTranscriptLines(LINES, 'cooldown').hits[0];
    expect(hit?.snippet.slice(hit.offset, hit.offset + hit.length).toLowerCase()).toBe('cooldown');
  });

  it('limit trafień na sesję liczy resztę zamiast ją gubić', () => {
    const many = Array.from({ length: 5 }, (_, index) =>
      wpis({
        type: 'user',
        timestamp: '2026-08-13T10:00:00.000Z',
        message: { content: `powtórka numer ${index}` },
      }),
    );
    const { hits, more } = scanTranscriptLines(many, 'powtórka', 2);
    expect(hits).toHaveLength(2);
    expect(more).toBe(3);
  });

  it('ucięta linia i śmieci nie przerywają skanu', () => {
    expect(scanTranscriptLines([...LINES, 'nie-json', ''], 'limity').hits).toHaveLength(2);
  });

  it('skaner strumieniowy daje ten sam wynik co wsad', () => {
    const scanner = createHitScanner('limity');
    for (const line of LINES) {
      scanner.push(line);
    }
    expect(scanner.result().hits).toEqual(scanTranscriptLines(LINES, 'limity').hits);
  });
});

describe('isSearchableQuery', () => {
  it('fraza krótsza niż próg nie uruchamia szukania', () => {
    expect(MIN_QUERY).toBe(3);
    expect(isSearchableQuery('li')).toBe(false);
    expect(isSearchableQuery('  li  ')).toBe(false);
    expect(isSearchableQuery('lim')).toBe(true);
  });
});
