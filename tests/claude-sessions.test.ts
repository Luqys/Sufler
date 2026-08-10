import { describe, expect, it } from 'vitest';
import {
  projectSlug,
  sessionTitleFromLines,
  sortSessions,
} from '../src/shared/claude-sessions';

describe('projectSlug', () => {
  it('koduje ścieżkę jak Claude Code (wszystko poza alfanumerykami → myślnik)', () => {
    expect(projectSlug('/Users/luqys/Desktop/VisualN3O')).toBe(
      '-Users-luqys-Desktop-VisualN3O',
    );
    expect(projectSlug('/tmp/proj_x.y z')).toBe('-tmp-proj-x-y-z');
  });
});

const wpis = (obj: object): string => JSON.stringify(obj);

describe('sessionTitleFromLines', () => {
  it('pomija wpisy meta, komendy lokalne i linie nie-user', () => {
    const title = sessionTitleFromLines([
      wpis({ type: 'mode', mode: 'normal' }),
      wpis({ type: 'file-history-snapshot', snapshot: {} }),
      wpis({ type: 'user', isMeta: true, message: { content: '<local-command-caveat>x' } }),
      wpis({ type: 'user', message: { content: '<command-name>/clear</command-name>' } }),
      wpis({ type: 'user', message: { content: 'Dodaj przycisk zapisu' } }),
    ]);
    expect(title).toBe('Dodaj przycisk zapisu');
  });

  it('czyta treść z tablicy bloków i skleja białe znaki', () => {
    const title = sessionTitleFromLines([
      wpis({
        type: 'user',
        message: { content: [{ type: 'text', text: '  Napraw\n\nbłąd   w edytorze ' }] },
      }),
    ]);
    expect(title).toBe('Napraw błąd w edytorze');
  });

  it('ucina długie tytuły do 80 znaków z wielokropkiem', () => {
    const długi = 'x'.repeat(200);
    const title = sessionTitleFromLines([wpis({ type: 'user', message: { content: długi } })]);
    expect(title?.length).toBe(80);
    expect(title?.endsWith('…')).toBe(true);
  });

  it('zwraca null dla pustych sesji i uszkodzonych linii', () => {
    expect(sessionTitleFromLines([])).toBeNull();
    expect(sessionTitleFromLines(['nie-json', wpis({ type: 'assistant' })])).toBeNull();
    expect(
      sessionTitleFromLines([wpis({ type: 'user', message: { content: '   ' } })]),
    ).toBeNull();
  });
});

describe('sortSessions', () => {
  it('sortuje od najświeższej i tnie do limitu', () => {
    const entries = [
      { id: 'a', title: 'a', mtimeMs: 100 },
      { id: 'b', title: 'b', mtimeMs: 300 },
      { id: 'c', title: 'c', mtimeMs: 200 },
    ];
    expect(sortSessions(entries, 2).map((entry) => entry.id)).toEqual(['b', 'c']);
    // Wejście bez mutacji.
    expect(entries[0]?.id).toBe('a');
  });
});
