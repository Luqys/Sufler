import { describe, expect, it } from 'vitest';
import {
  createSessionScanner,
  projectSlug,
  scanSessionLines,
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

describe('scanSessionLines', () => {
  const rozmowa = [
    wpis({ type: 'mode', mode: 'normal' }),
    wpis({
      type: 'user',
      timestamp: '2026-08-12T10:00:00.000Z',
      gitBranch: 'm67-sesje',
      message: { content: 'Dodaj panel sesji' },
    }),
    wpis({
      type: 'assistant',
      timestamp: '2026-08-12T10:00:30.000Z',
      message: {
        content: [
          { type: 'text', text: 'Robi się' },
          { type: 'tool_use', name: 'Edit', input: {} },
          { type: 'tool_use', name: 'Bash', input: {} },
        ],
      },
    }),
    wpis({
      type: 'user',
      timestamp: '2026-08-12T10:05:00.000Z',
      message: { content: 'Dorzuć testy' },
    }),
  ];

  it('liczy wiadomości, narzędzia, zakres czasu i gałąź', () => {
    const scan = scanSessionLines(rozmowa);
    expect(scan.title).toBe('Dodaj panel sesji');
    expect(scan.userMessages).toBe(2);
    expect(scan.assistantMessages).toBe(1);
    expect(scan.toolCalls).toBe(2);
    expect(scan.branch).toBe('m67-sesje');
    expect(scan.startedMs).toBe(Date.parse('2026-08-12T10:00:00.000Z'));
    expect(scan.endedMs).toBe(Date.parse('2026-08-12T10:05:00.000Z'));
  });

  it('bez limitu podglądu nie zbiera wiadomości', () => {
    const scan = scanSessionLines(rozmowa);
    expect(scan.messages).toEqual([]);
    expect(scan.truncated).toBe(false);
  });

  it('podgląd trzyma ostatnie wymiany i sygnalizuje ucięcie', () => {
    const scan = scanSessionLines(rozmowa, 2);
    expect(scan.messages.map((message) => message.role)).toEqual(['assistant', 'user']);
    expect(scan.messages.map((message) => message.text)).toEqual(['Robi się', 'Dorzuć testy']);
    expect(scan.messages[1]?.timestampMs).toBe(Date.parse('2026-08-12T10:05:00.000Z'));
    // Pierwsze pytanie wypadło poza okno podglądu.
    expect(scan.truncated).toBe(true);
  });

  it('pomija ruch subagentów i wpisy meta w licznikach', () => {
    const scan = scanSessionLines([
      wpis({ type: 'user', isSidechain: true, message: { content: 'zadanie dla subagenta' } }),
      wpis({ type: 'assistant', isSidechain: true, message: { content: 'odpowiedź subagenta' } }),
      wpis({ type: 'user', isMeta: true, message: { content: 'meta' } }),
      wpis({ type: 'user', message: { content: 'prawdziwe pytanie' } }),
    ]);
    expect(scan.userMessages).toBe(1);
    expect(scan.assistantMessages).toBe(0);
    expect(scan.title).toBe('prawdziwe pytanie');
  });

  it('ucina długie wiadomości podglądu', () => {
    const scan = scanSessionLines(
      [wpis({ type: 'user', message: { content: 'a'.repeat(1000) } })],
      1,
    );
    expect(scan.messages[0]?.text.length).toBe(320);
    expect(scan.messages[0]?.text.endsWith('…')).toBe(true);
  });

  it('znosi linie ucięte w pół i śmieci', () => {
    const scan = scanSessionLines([
      'nie-json',
      '{"type":"user","message":{"content":"ucięt',
      wpis({ type: 'user', message: { content: 'całe zdanie' } }),
    ]);
    expect(scan.userMessages).toBe(1);
    expect(scan.title).toBe('całe zdanie');
  });
});

describe('createSessionScanner', () => {
  it('daje ten sam wynik karmiony linia po linii, co scanSessionLines', () => {
    const lines = [
      wpis({ type: 'user', timestamp: '2026-08-12T09:00:00.000Z', message: { content: 'raz' } }),
      wpis({ type: 'assistant', message: { content: 'dwa' } }),
    ];
    const scanner = createSessionScanner(5);
    for (const line of lines) {
      scanner.push(line);
    }
    expect(scanner.result()).toEqual(scanSessionLines(lines, 5));
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

  it('zachowuje bogatszy kształt wpisu (panel sesji)', () => {
    const entries = [
      { id: 'a', title: 'a', mtimeMs: 1, startedMs: 0, branch: 'main', sizeBytes: 12 },
    ];
    expect(sortSessions(entries)[0]?.branch).toBe('main');
  });
});
