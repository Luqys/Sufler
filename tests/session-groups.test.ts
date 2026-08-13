import { describe, expect, it } from 'vitest';
import { sessionLabel } from '../src/shared/claude-sessions';
import {
  filterSessions,
  groupSessionsByDay,
  isRecentSession,
  sessionDurationMs,
} from '../src/shared/session-groups';

/** Chwila w lokalnej strefie — testy nie mogą zależeć od strefy maszyny. */
function at(day: number, hour: number, minute = 0): number {
  return new Date(2026, 7, day, hour, minute, 0, 0).getTime();
}

const NOW = at(13, 15, 0);

const SESSIONS = [
  { id: 'a', title: 'zrób push do maina', branch: 'main', mtimeMs: at(13, 14, 30), startedMs: at(13, 14, 5) },
  { id: 'b', title: 'popraw ikonkę', branch: 'm80-sesje', mtimeMs: at(13, 9, 0), startedMs: at(13, 8, 0) },
  { id: 'c', title: 'gałąź wydania', branch: 'wydanie', mtimeMs: at(12, 22, 15), startedMs: 0 },
  { id: 'd', title: "'/var/folders/g4/tmp/Zrzut ekranu.png' popraw layout", branch: 'main', mtimeMs: at(9, 11, 0), startedMs: at(9, 10, 0) },
];

describe('groupSessionsByDay', () => {
  it('dzieli na dni kalendarzowe, od najnowszego', () => {
    const groups = groupSessionsByDay(SESSIONS, NOW);
    expect(groups.map((group) => group.kind)).toEqual(['today', 'yesterday', 'day']);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(groups[1]?.items.map((item) => item.id)).toEqual(['c']);
    expect(groups[2]?.items.map((item) => item.id)).toEqual(['d']);
  });

  it('„dziś" liczy się po dacie, nie po dobie wstecz', () => {
    // 00:30 dziś i 23:30 wczoraj dzieli godzina, ale to różne dni.
    const groups = groupSessionsByDay(
      [
        { id: 'nocna', mtimeMs: at(13, 0, 30) },
        { id: 'wieczorna', mtimeMs: at(12, 23, 30) },
      ],
      at(13, 8, 0),
    );
    expect(groups.map((group) => group.kind)).toEqual(['today', 'yesterday']);
  });

  it('pusta lista daje pustą listę grup', () => {
    expect(groupSessionsByDay([], NOW)).toEqual([]);
  });
});

describe('filterSessions', () => {
  it('pusta fraza przepuszcza wszystko', () => {
    expect(filterSessions(SESSIONS, '  ', sessionLabel)).toHaveLength(SESSIONS.length);
  });

  it('szuka po widocznej etykiecie', () => {
    const found = filterSessions(SESSIONS, 'layout', sessionLabel);
    expect(found.map((item) => item.id)).toEqual(['d']);
  });

  it('szuka po gałęzi', () => {
    expect(filterSessions(SESSIONS, 'wydanie', sessionLabel).map((item) => item.id)).toEqual(['c']);
  });

  it('surowy tytuł nadal jest do znalezienia, choć nie widać go na liście', () => {
    expect(filterSessions(SESSIONS, 'zrzut ekranu', sessionLabel).map((item) => item.id)).toEqual([
      'd',
    ]);
  });

  it('ignoruje wielkość liter i ogonki', () => {
    expect(filterSessions(SESSIONS, 'GALAZ', sessionLabel).map((item) => item.id)).toEqual(['c']);
  });

  it('brak trafień to pusta lista, nie cała lista', () => {
    expect(filterSessions(SESSIONS, 'czegoś takiego nie ma', sessionLabel)).toEqual([]);
  });
});

describe('sessionDurationMs', () => {
  it('liczy od pierwszego wpisu do ostatniej aktywności', () => {
    expect(sessionDurationMs({ startedMs: at(13, 14, 5), mtimeMs: at(13, 14, 30) })).toBe(25 * 60_000);
  });

  it('bez znanego początku albo przy niespójnych danych daje zero', () => {
    expect(sessionDurationMs({ startedMs: 0, mtimeMs: NOW })).toBe(0);
    expect(sessionDurationMs({ startedMs: NOW, mtimeMs: NOW - 1000 })).toBe(0);
  });
});

describe('isRecentSession', () => {
  it('dziesięć minut to granica świeżości', () => {
    expect(isRecentSession({ mtimeMs: NOW - 60_000 }, NOW)).toBe(true);
    expect(isRecentSession({ mtimeMs: NOW - 20 * 60_000 }, NOW)).toBe(false);
  });
});
