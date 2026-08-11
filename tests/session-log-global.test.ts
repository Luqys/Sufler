import { describe, expect, it } from 'vitest';
import {
  hasGlobalSessionLogHooks,
  SESSION_LOG_SCRIPT,
  withGlobalSessionLogHooks,
} from '../src/shared/session-log-script';

const SCRIPT = '/Users/ktos/.claude/sufler-dziennik.mjs';
const OBCY = { hooks: [{ type: 'command', command: 'echo obcy' }] };

describe('withGlobalSessionLogHooks', () => {
  it('wpina trzy zdarzenia, nie ruszając cudzych hooków ani reszty pliku', () => {
    const settings = {
      model: 'opus',
      skillOverrides: { deploy: 'off' },
      hooks: { UserPromptSubmit: [OBCY], SessionStart: [OBCY] },
    };
    const next = withGlobalSessionLogHooks(settings, SCRIPT, true);
    const hooks = next['hooks'] as Record<string, unknown[]>;
    expect(next['model']).toBe('opus');
    expect(next['skillOverrides']).toEqual({ deploy: 'off' });
    expect(hooks['SessionStart']).toEqual([OBCY]);
    expect(hooks['UserPromptSubmit']?.[0]).toEqual(OBCY);
    expect(JSON.stringify(hooks['UserPromptSubmit']?.[1])).toContain('prompt');
    expect(JSON.stringify(hooks['PostToolUse'])).toContain('tool');
    expect(JSON.stringify(hooks['Stop'])).toContain('stop');
  });

  it('włączenie jest idempotentne — nie mnoży wpisów', () => {
    const once = withGlobalSessionLogHooks({}, SCRIPT, true);
    const twice = withGlobalSessionLogHooks(once, SCRIPT, true);
    const hooks = twice['hooks'] as Record<string, unknown[]>;
    expect(hooks['UserPromptSubmit']).toHaveLength(1);
    expect(once).toEqual(twice);
  });

  it('wyłączenie usuwa tylko nasze wpisy i sprząta puste klucze', () => {
    const withMine = withGlobalSessionLogHooks({ hooks: { PostToolUse: [OBCY] } }, SCRIPT, true);
    const off = withGlobalSessionLogHooks(withMine, SCRIPT, false);
    const hooks = off['hooks'] as Record<string, unknown[]>;
    expect(hooks['PostToolUse']).toEqual([OBCY]);
    expect(hooks['UserPromptSubmit']).toBeUndefined();
    expect(hooks['Stop']).toBeUndefined();
  });

  it('wyłączenie na czystych settings nie zostawia pustego klucza hooks', () => {
    expect(withGlobalSessionLogHooks({ model: 'opus' }, SCRIPT, false)).toEqual({ model: 'opus' });
  });
});

describe('hasGlobalSessionLogHooks', () => {
  it('rozpoznaje własne wpisy i ignoruje cudze', () => {
    expect(hasGlobalSessionLogHooks({}, SCRIPT)).toBe(false);
    expect(hasGlobalSessionLogHooks({ hooks: { UserPromptSubmit: [OBCY] } }, SCRIPT)).toBe(false);
    expect(hasGlobalSessionLogHooks(withGlobalSessionLogHooks({}, SCRIPT, true), SCRIPT)).toBe(true);
  });
});

describe('SESSION_LOG_SCRIPT', () => {
  it('jest samodzielnym modułem ESM bez zależności od aplikacji', () => {
    expect(SESSION_LOG_SCRIPT).toContain("import { appendFileSync");
    expect(SESSION_LOG_SCRIPT).not.toContain('require(');
    expect(SESSION_LOG_SCRIPT).toContain('dziennik-sesji');
    // Cichy błąd: skrypt nigdy nie może wywrócić sesji Claude.
    expect(SESSION_LOG_SCRIPT).toContain('} catch {');
    expect(SESSION_LOG_SCRIPT).toContain('process.exit(0)');
  });
});
