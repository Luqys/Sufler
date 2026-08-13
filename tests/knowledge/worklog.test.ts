import { describe, expect, it } from 'vitest';
import {
  countOperations,
  firstPromptOf,
  groupByDay,
  mergeWorklog,
  type WorklogEntry,
} from '../../src/shared/knowledge/worklog';

const commit = (date: string, title: string): WorklogEntry => ({
  kind: 'commit',
  date,
  title,
  reference: 'abc1234',
  detail: 'Szymon',
});
const session = (date: string, title: string): WorklogEntry => ({
  kind: 'session',
  date,
  title,
  reference: 'dziennik-sesji/x.md',
  detail: '4',
});

describe('mergeWorklog', () => {
  it('sortuje malejąco po czasie, mieszając commity z sesjami', () => {
    const merged = mergeWorklog([
      commit('2026-08-11T09:00:00Z', 'stary commit'),
      session('2026-08-11T12:00:00Z', 'nowa sesja'),
      commit('2026-08-11T11:00:00Z', 'nowszy commit'),
    ]);
    expect(merged.map((entry) => entry.title)).toEqual([
      'nowa sesja',
      'nowszy commit',
      'stary commit',
    ]);
  });

  it('wpisy z niepoprawną datą lądują na końcu, nie wywracają sortowania', () => {
    const merged = mergeWorklog([
      commit('nie-data', 'bez daty'),
      session('2026-08-11T10:00:00Z', 'z datą'),
    ]);
    expect(merged[0]?.title).toBe('z datą');
    expect(merged[1]?.title).toBe('bez daty');
  });
});

describe('groupByDay', () => {
  it('grupuje po dniach zachowując kolejność od najnowszego', () => {
    const groups = groupByDay([
      commit('2026-08-10T09:00:00Z', 'wczoraj'),
      session('2026-08-11T12:00:00Z', 'dziś późno'),
      commit('2026-08-11T08:00:00Z', 'dziś rano'),
    ]);
    expect(groups.map(([day]) => day)).toEqual(['2026-08-11', '2026-08-10']);
    expect(groups[0]?.[1]).toHaveLength(2);
    expect(groups[0]?.[1][0]?.title).toBe('dziś późno');
  });
});

describe('firstPromptOf / countOperations', () => {
  const log = `---
kategoria: Dziennik sesji
---

# Dziennik

## 10:00 — polecenie

Napraw limity planu

- \`10:01\` edycja: \`src/a.ts\`
- \`10:02\` powłoka: \`npm test\`

## 10:30 — polecenie

Druga prośba
`;

  it('bierze pierwsze polecenie jako tytuł', () => {
    expect(firstPromptOf(log)).toBe('Napraw limity planu');
    expect(firstPromptOf('# Pusty dziennik\n')).toBeNull();
  });

  it('liczy odnotowane operacje', () => {
    expect(countOperations(log)).toBe(2);
    expect(countOperations('brak operacji')).toBe(0);
  });
});
