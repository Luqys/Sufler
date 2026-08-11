import { describe, expect, it } from 'vitest';
import {
  buildSessionLogEntry,
  buildSessionLogHeader,
  condense,
  parseSessionLogPayload,
  sessionLogFile,
} from '../src/shared/session-log';

const SESSION = 'a1b2c3d4-5e6f-7788-99aa-bbccddeeff00';

describe('parseSessionLogPayload', () => {
  it('prompt użytkownika wchodzi do dziennika', () => {
    const raw = JSON.stringify({ session_id: SESSION, prompt: '  Dodaj panel ustawień  ' });
    expect(parseSessionLogPayload('prompt', raw)).toEqual({
      kind: 'prompt',
      sessionId: SESSION,
      prompt: 'Dodaj panel ustawień',
    });
  });

  it('pusty prompt i zepsuty JSON są pomijane', () => {
    expect(parseSessionLogPayload('prompt', JSON.stringify({ session_id: SESSION, prompt: ' ' }))).toBeNull();
    expect(parseSessionLogPayload('prompt', '{ zepsute')).toBeNull();
    expect(parseSessionLogPayload('prompt', JSON.stringify({ prompt: 'bez sesji' }))).toBeNull();
  });

  it('narzędzia zmieniające projekt są zapisywane wraz ze ścieżką', () => {
    const raw = JSON.stringify({
      session_id: SESSION,
      tool_name: 'Edit',
      tool_input: { file_path: 'src/app.ts', old_string: 'a', new_string: 'b' },
    });
    expect(parseSessionLogPayload('tool', raw)).toMatchObject({
      toolName: 'Edit',
      filePath: 'src/app.ts',
    });
  });

  it('Bash niesie komendę, a narzędzia tylko czytające są pomijane', () => {
    const bash = JSON.stringify({
      session_id: SESSION,
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
    });
    expect(parseSessionLogPayload('tool', bash)).toMatchObject({ command: 'npm test' });
    for (const tool of ['Read', 'Grep', 'Glob', 'TodoWrite']) {
      const raw = JSON.stringify({ session_id: SESSION, tool_name: tool, tool_input: {} });
      expect(parseSessionLogPayload('tool', raw)).toBeNull();
    }
  });

  it('stop nie wymaga dodatkowych pól', () => {
    expect(parseSessionLogPayload('stop', JSON.stringify({ session_id: SESSION }))).toEqual({
      kind: 'stop',
      sessionId: SESSION,
    });
  });
});

describe('sessionLogFile', () => {
  it('nazwa to data i skrócony identyfikator sesji', () => {
    expect(sessionLogFile(SESSION, '2026-08-11T01:23:45.000Z')).toBe(
      'dziennik-sesji/2026-08-11-a1b2c3d4.md',
    );
  });

  it('identyfikator bez znaków alfanumerycznych ma zapasową nazwę', () => {
    expect(sessionLogFile('///', '2026-08-11T00:00:00.000Z')).toBe(
      'dziennik-sesji/2026-08-11-sesja.md',
    );
  });
});

describe('buildSessionLogEntry', () => {
  it('polecenie zapisuje się jako nagłówek z treścią', () => {
    const entry = buildSessionLogEntry(
      { kind: 'prompt', sessionId: SESSION, prompt: 'Napraw limit' },
      '01:23',
    );
    expect(entry).toContain('## 01:23 — polecenie');
    expect(entry).toContain('Napraw limit');
  });

  it('edycja i zapis mają różne czasowniki, komenda idzie w apostrofach', () => {
    expect(
      buildSessionLogEntry(
        { kind: 'tool', sessionId: SESSION, toolName: 'Edit', filePath: 'a.ts' },
        '10:00',
      ),
    ).toBe('- `10:00` edycja: `a.ts`\n');
    expect(
      buildSessionLogEntry(
        { kind: 'tool', sessionId: SESSION, toolName: 'Write', filePath: 'b.ts' },
        '10:01',
      ),
    ).toBe('- `10:01` zapis: `b.ts`\n');
    expect(
      buildSessionLogEntry(
        { kind: 'tool', sessionId: SESSION, toolName: 'Bash', command: 'ls -la' },
        '10:02',
      ),
    ).toBe('- `10:02` powłoka: `ls -la`\n');
  });

  it('narzędzie bez ścieżki i komendy nic nie wnosi', () => {
    expect(
      buildSessionLogEntry({ kind: 'tool', sessionId: SESSION, toolName: 'Edit' }, '10:03'),
    ).toBeNull();
  });
});

describe('condense', () => {
  it('zbija białe znaki i przycina długie treści', () => {
    expect(condense('  wiele   spacji\n i linii ')).toBe('wiele spacji i linii');
    const long = condense('x'.repeat(500), 20);
    expect(long).toHaveLength(20);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('buildSessionLogHeader', () => {
  it('frontmatter wpina dziennik w graf wiedzy', () => {
    const header = buildSessionLogHeader({
      sessionId: SESSION,
      isoDate: '2026-08-11T01:23:45.000Z',
      project: 'N3O_kontakt',
      branch: 'main',
    });
    expect(header).toContain('kategoria: Dziennik sesji');
    expect(header).toContain('tagi: [dziennik, claude]');
    expect(header).toContain('# Dziennik sesji — N3O_kontakt');
    expect(header).toContain('gałąź `main`');
    expect(header).toContain('/clear');
  });
});
