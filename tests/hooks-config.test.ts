import { describe, expect, it } from 'vitest';
import {
  HOOK_EVENTS,
  hookProblem,
  isHookEvent,
  readHookEntries,
  supportsMatcher,
  withHookAdded,
  withHookRemoved,
} from '../src/shared/hooks-config';

const SETTINGS = {
  permissions: { deny: [] },
  hooks: {
    PreToolUse: [
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo bash' }] },
      { hooks: [{ type: 'command', command: 'echo wszystko' }] },
    ],
    Stop: [{ hooks: [{ type: 'command', command: 'say koniec' }] }],
  },
};

describe('kontrakt zdarzeń', () => {
  it('zna dziewięć zdarzeń z CLI', () => {
    expect(HOOK_EVENTS).toHaveLength(9);
    expect(isHookEvent('PreCompact')).toBe(true);
    expect(isHookEvent('Wymyślone')).toBe(false);
  });

  it('wzorzec narzędzia ma sens tylko przy zdarzeniach narzędziowych', () => {
    expect(supportsMatcher('PreToolUse')).toBe(true);
    expect(supportsMatcher('PostToolUse')).toBe(true);
    expect(supportsMatcher('Stop')).toBe(false);
  });
});

describe('readHookEntries', () => {
  it('spłaszcza grupy do pojedynczych wpisów z wzorcem', () => {
    expect(readHookEntries(SETTINGS)).toEqual([
      { event: 'PreToolUse', matcher: 'Bash', command: 'echo bash' },
      { event: 'PreToolUse', matcher: '', command: 'echo wszystko' },
      { event: 'Stop', matcher: '', command: 'say koniec' },
    ]);
  });

  it('znosi śmieci: brak hooków, nieznane zdarzenia, obce kształty', () => {
    expect(readHookEntries(null)).toEqual([]);
    expect(readHookEntries({ hooks: 'nie-obiekt' })).toEqual([]);
    expect(readHookEntries({ hooks: { Wymyślone: [{ hooks: [] }] } })).toEqual([]);
    expect(readHookEntries({ hooks: { Stop: [{ hooks: [{ type: 'command' }] }] } })).toEqual([]);
  });
});

describe('hookProblem', () => {
  it('wymaga znanego zdarzenia i niepustej komendy', () => {
    expect(hookProblem('Stop', 'say hej')).toBeNull();
    expect(hookProblem('Stop', '   ')).toBe('empty-command');
    expect(hookProblem('Wymyślone', 'say hej')).toBe('unknown-event');
  });
});

describe('withHookAdded', () => {
  it('dokłada do istniejącej grupy o tym samym wzorcu', () => {
    const next = withHookAdded(SETTINGS, {
      event: 'PreToolUse',
      matcher: 'Bash',
      command: 'echo drugi',
    });
    const groups = (next['hooks'] as Record<string, unknown>)['PreToolUse'] as unknown[];
    expect(groups).toHaveLength(2);
    expect(readHookEntries(next).filter((entry) => entry.matcher === 'Bash')).toHaveLength(2);
  });

  it('tworzy nową grupę dla nowego wzorca i nie rusza cudzych kluczy', () => {
    const next = withHookAdded(SETTINGS, {
      event: 'PreToolUse',
      matcher: 'Edit',
      command: 'echo edit',
    });
    expect((next['hooks'] as Record<string, unknown>)['PreToolUse']).toHaveLength(3);
    expect(next['permissions']).toEqual(SETTINGS.permissions);
  });

  it('działa na settings bez sekcji hooks', () => {
    const next = withHookAdded({}, { event: 'SessionEnd', matcher: '', command: 'echo koniec' });
    expect(readHookEntries(next)).toEqual([
      { event: 'SessionEnd', matcher: '', command: 'echo koniec' },
    ]);
  });

  it('grupa bez wzorca nie dostaje pustego pola matcher', () => {
    const next = withHookAdded({}, { event: 'Stop', matcher: '', command: 'x' });
    const group = ((next['hooks'] as Record<string, unknown>)['Stop'] as Record<string, unknown>[])[0];
    expect(group && 'matcher' in group).toBe(false);
  });
});

describe('withHookRemoved', () => {
  it('usuwa jedną komendę, zostawiając resztę grupy', () => {
    const withTwo = withHookAdded(SETTINGS, {
      event: 'PreToolUse',
      matcher: 'Bash',
      command: 'echo drugi',
    });
    const next = withHookRemoved(withTwo, {
      event: 'PreToolUse',
      matcher: 'Bash',
      command: 'echo drugi',
    });
    expect(readHookEntries(next)).toEqual(readHookEntries(SETTINGS));
  });

  it('sprząta puste grupy, puste zdarzenia i pustą mapę hooków', () => {
    const only = withHookAdded({}, { event: 'Stop', matcher: '', command: 'say koniec' });
    const next = withHookRemoved(only, { event: 'Stop', matcher: '', command: 'say koniec' });
    expect('hooks' in next).toBe(false);
  });

  it('nie rusza wpisu o innym wzorcu ani innej komendzie', () => {
    const next = withHookRemoved(SETTINGS, {
      event: 'PreToolUse',
      matcher: 'Edit',
      command: 'echo bash',
    });
    expect(readHookEntries(next)).toEqual(readHookEntries(SETTINGS));
  });
});
