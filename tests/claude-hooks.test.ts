import { describe, expect, it } from 'vitest';
import { buildHookSettings, parseHookRequest } from '../src/shared/claude-hooks';

describe('buildHookSettings', () => {
  it('buduje hooki Notification i Stop z komendą curl na właściwy port', () => {
    const settings = buildHookSettings(41234, 'sekret') as {
      hooks: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>;
    };
    for (const name of ['Notification', 'Stop']) {
      const command = settings.hooks[name]?.[0]?.hooks[0];
      expect(command?.type).toBe('command');
      expect(command?.command).toContain('http://127.0.0.1:41234/hook');
      expect(command?.command).toContain('x-sufler-hook: sekret');
      expect(command?.command).toContain('$VISUALN3O_TAB_ID');
      // Hook nie może wywrócić sesji, gdy aplikacja akurat nie działa.
      expect(command?.command).toContain('|| true');
    }
    expect(settings.hooks['Notification']?.[0]?.hooks[0]?.command).toContain(
      'x-sufler-event: notification',
    );
    expect(settings.hooks['Stop']?.[0]?.hooks[0]?.command).toContain('x-sufler-event: stop');
  });
});

describe('parseHookRequest', () => {
  const poprawne = {
    'x-sufler-hook': 'sekret',
    'x-sufler-tab': '3',
    'x-sufler-event': 'stop',
  };

  it('akceptuje poprawne żądanie', () => {
    expect(parseHookRequest(poprawne, 'sekret')).toEqual({ ptyId: 3, kind: 'stop' });
    expect(
      parseHookRequest({ ...poprawne, 'x-sufler-event': 'notification' }, 'sekret'),
    ).toEqual({ ptyId: 3, kind: 'notification' });
  });

  it('odrzuca zły token, brak tab-id i nieznane zdarzenia', () => {
    expect(parseHookRequest({ ...poprawne, 'x-sufler-hook': 'inny' }, 'sekret')).toBeNull();
    expect(parseHookRequest({ ...poprawne, 'x-sufler-tab': 'abc' }, 'sekret')).toBeNull();
    expect(parseHookRequest({ ...poprawne, 'x-sufler-tab': '0' }, 'sekret')).toBeNull();
    expect(parseHookRequest({ ...poprawne, 'x-sufler-event': 'inne' }, 'sekret')).toBeNull();
    expect(parseHookRequest(poprawne, '')).toBeNull();
    // Nagłówek jako tablica (podwójny) też odpada.
    expect(
      parseHookRequest({ ...poprawne, 'x-sufler-hook': ['sekret', 'sekret'] }, 'sekret'),
    ).toBeNull();
  });
});
