import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  agentAvailability,
  agentDenyRule,
  agentOfDenyRule,
  buildAgentFile,
  denyHasAgent,
  denyRulesOf,
  withAgentDeny,
} from '../src/shared/agents';
import { createAgent, readSkillsSnapshot, setAgentEnabled } from '../src/main/skills';

// Hermetyczny HOME: ~/.claude/settings.json nie czyta prawdziwego konta
// użytkownika (os.homedir() honoruje $HOME).
const fakeHome = mkdtempSync(join(tmpdir(), 'vn3o-agents-home-'));
let realHome: string | undefined;

beforeAll(() => {
  realHome = process.env['HOME'];
  process.env['HOME'] = fakeHome;
});

afterAll(() => {
  process.env['HOME'] = realHome;
});

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), 'vn3o-agents-root-'));
}

function addAgent(root: string, name: string): void {
  const dir = join(root, '.claude', 'agents');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.md`), `---\nname: ${name}\ndescription: Opis ${name}\n---\n`);
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('agentOfDenyRule', () => {
  it('odczytuje nazwę z reguły Agent(…) wraz z białymi znakami', () => {
    expect(agentOfDenyRule(agentDenyRule('recenzent'))).toBe('recenzent');
    expect(agentOfDenyRule('  Agent( recenzent )  ')).toBe('recenzent');
  });

  it('zwraca null dla innych reguł permissions', () => {
    expect(agentOfDenyRule('Skill(deploy)')).toBeNull();
    expect(agentOfDenyRule('Bash(ls:*)')).toBeNull();
    expect(agentOfDenyRule('Agent()')).toBeNull();
    expect(agentOfDenyRule('agent(recenzent)')).toBeNull();
  });
});

describe('denyRulesOf', () => {
  it('toleruje śmieciowe settings', () => {
    expect(denyRulesOf(null)).toEqual([]);
    expect(denyRulesOf('tekst')).toEqual([]);
    expect(denyRulesOf([])).toEqual([]);
    expect(denyRulesOf({})).toEqual([]);
    expect(denyRulesOf({ permissions: 'zepsute' })).toEqual([]);
    expect(denyRulesOf({ permissions: { deny: 'zepsute' } })).toEqual([]);
  });

  it('zwraca tylko reguły tekstowe', () => {
    expect(denyRulesOf({ permissions: { deny: ['Agent(a)', 7, null, 'Bash(rm:*)'] } })).toEqual([
      'Agent(a)',
      'Bash(rm:*)',
    ]);
  });
});

describe('agentAvailability', () => {
  const local = ['Agent(lokalny)'];
  const project = ['Agent(projektowy)'];
  const user = ['Agent(globalny)', 'Bash(rm:*)'];

  it('bez reguł agent jest włączony', () => {
    expect(agentAvailability([[], [], []], 'recenzent')).toEqual({
      enabled: true,
      deniedElsewhere: false,
    });
  });

  it('deny w settings.local wyłącza, ale nie blokuje przełącznika', () => {
    expect(agentAvailability([local, [], []], 'lokalny')).toEqual({
      enabled: false,
      deniedElsewhere: false,
    });
  });

  it('deny w settings projektu lub użytkownika wyłącza i blokuje', () => {
    expect(agentAvailability([[], project, []], 'projektowy')).toEqual({
      enabled: false,
      deniedElsewhere: true,
    });
    expect(agentAvailability([[], [], user], 'globalny')).toEqual({
      enabled: false,
      deniedElsewhere: true,
    });
  });

  it('denyHasAgent dopasowuje po nazwie z reguły, nie po podciągu', () => {
    expect(denyHasAgent(['Agent(recenzent-plus)'], 'recenzent')).toBe(false);
    expect(denyHasAgent(['Agent( recenzent )'], 'recenzent')).toBe(true);
  });
});

describe('withAgentDeny', () => {
  it('wyłączenie dopisuje regułę, nie ruszając reszty pliku', () => {
    const settings = {
      skillOverrides: { deploy: 'off' },
      permissions: { allow: ['Bash(ls:*)'], deny: ['Bash(rm:*)'] },
    };
    const next = withAgentDeny(settings, 'recenzent', false);
    expect(next['skillOverrides']).toEqual({ deploy: 'off' });
    expect(next['permissions']).toEqual({
      allow: ['Bash(ls:*)'],
      deny: ['Bash(rm:*)', 'Agent(recenzent)'],
    });
    // oryginał nietknięty
    expect(settings.permissions.deny).toEqual(['Bash(rm:*)']);
  });

  it('wyłączenie jest idempotentne i normalizuje warianty zapisu', () => {
    const once = withAgentDeny({ permissions: { deny: ['Agent( recenzent )'] } }, 'recenzent', false);
    expect(denyRulesOf(once)).toEqual(['Agent(recenzent)']);
    expect(denyRulesOf(withAgentDeny(once, 'recenzent', false))).toEqual(['Agent(recenzent)']);
  });

  it('włączenie usuwa wszystkie warianty reguły, zachowując cudze wpisy', () => {
    const settings = {
      permissions: { deny: ['Agent(recenzent)', 'Agent( recenzent )', 'Agent(inny)', 42] },
    };
    const next = withAgentDeny(settings, 'recenzent', true);
    expect((next['permissions'] as Record<string, unknown>)['deny']).toEqual(['Agent(inny)', 42]);
  });

  it('włączenie bez aktywnej reguły to no-op — nie dopisuje pustych struktur', () => {
    const settings = { skillOverrides: {} };
    expect(withAgentDeny(settings, 'recenzent', true)).toBe(settings);
    expect(settings).not.toHaveProperty('permissions');
  });

  it('wyłączenie w pustych settings tworzy permissions.deny', () => {
    expect(withAgentDeny({}, 'recenzent', false)).toEqual({
      permissions: { deny: ['Agent(recenzent)'] },
    });
  });
});

describe('setAgentEnabled + readSkillsSnapshot', () => {
  it('wyłączenie zapisuje regułę w settings.local.json i panel to widzi', async () => {
    const root = makeRoot();
    addAgent(root, 'recenzent');
    const localPath = join(root, '.claude', 'settings.local.json');
    writeJson(localPath, { permissions: { allow: ['Bash(ls:*)'] } });

    expect(await setAgentEnabled(root, 'recenzent', false)).toEqual({ ok: true, enabled: false });
    const written = readJson(localPath);
    expect(written['permissions']).toEqual({
      allow: ['Bash(ls:*)'],
      deny: ['Agent(recenzent)'],
    });

    const agent = (await readSkillsSnapshot(root)).agents.find((a) => a.name === 'recenzent');
    expect(agent).toMatchObject({ enabled: false, deniedElsewhere: false });

    expect(await setAgentEnabled(root, 'recenzent', true)).toEqual({ ok: true, enabled: true });
    expect(readJson(localPath)['permissions']).toEqual({ allow: ['Bash(ls:*)'], deny: [] });
    const again = (await readSkillsSnapshot(root)).agents.find((a) => a.name === 'recenzent');
    expect(again).toMatchObject({ enabled: true, deniedElsewhere: false });
  });

  it('deny w settings.json projektu daje blokadę deniedElsewhere', async () => {
    const root = makeRoot();
    addAgent(root, 'projektowy');
    writeJson(join(root, '.claude', 'settings.json'), {
      permissions: { deny: ['Agent(projektowy)'] },
    });
    const agent = (await readSkillsSnapshot(root)).agents.find((a) => a.name === 'projektowy');
    expect(agent).toMatchObject({ enabled: false, deniedElsewhere: true });
  });

  it('deny w ~/.claude/settings.json też blokuje przełącznik', async () => {
    const root = makeRoot();
    addAgent(root, 'globalny');
    writeJson(join(fakeHome, '.claude', 'settings.json'), {
      permissions: { deny: ['Agent(globalny)'] },
    });
    const agent = (await readSkillsSnapshot(root)).agents.find((a) => a.name === 'globalny');
    expect(agent).toMatchObject({ enabled: false, deniedElsewhere: true });
  });

  it('uszkodzony settings.local.json nie jest nadpisywany', async () => {
    const root = makeRoot();
    addAgent(root, 'recenzent');
    const localPath = join(root, '.claude', 'settings.local.json');
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, '{ zepsute');

    expect(await setAgentEnabled(root, 'recenzent', false)).toEqual({
      ok: false,
      error: 'settings-unreadable',
    });
    expect(readFileSync(localPath, 'utf8')).toBe('{ zepsute');
  });
});

describe('buildAgentFile', () => {
  it('buduje frontmatter z wymaganych pól i promptu', () => {
    const content = buildAgentFile({
      name: 'recenzent-api',
      description: 'Recenzje endpointów',
      body: 'Jesteś recenzentem API.',
    });
    expect(content).toBe(
      '---\nname: recenzent-api\ndescription: Recenzje endpointów\n---\n\nJesteś recenzentem API.\n',
    );
  });

  it('dokłada tools i model tylko, gdy są wypełnione', () => {
    const content = buildAgentFile({
      name: 'zwiadowca',
      description: 'Szukanie po repo',
      tools: 'Read, Grep',
      model: 'haiku',
      body: '',
    });
    expect(content).toContain('tools: Read, Grep\n');
    expect(content).toContain('model: haiku\n');
    expect(buildAgentFile({ name: 'a', description: 'b', tools: '  ', model: '', body: '' })).toBe(
      '---\nname: a\ndescription: b\n---\n',
    );
  });
});

describe('createAgent', () => {
  it('zapisuje plik agenta i odmawia nadpisania istniejącego', async () => {
    const root = makeRoot();
    const result = await createAgent(root, {
      name: 'recenzent-api',
      description: 'Recenzje endpointów',
      body: 'Prompt.',
    });
    expect(result.ok).toBe(true);
    const path = join(root, '.claude', 'agents', 'recenzent-api.md');
    expect(readFileSync(path, 'utf8')).toContain('name: recenzent-api');

    expect(
      await createAgent(root, { name: 'recenzent-api', description: 'Inny', body: '' }),
    ).toEqual({ ok: false, error: 'exists' });
  });

  it('odrzuca nazwę spoza kebab-case', async () => {
    expect(
      await createAgent(makeRoot(), { name: 'Złe Imię', description: 'x', body: '' }),
    ).toEqual({ ok: false, error: 'invalid-name' });
  });

  it('utworzony agent pojawia się w snapszocie jako włączony', async () => {
    const root = makeRoot();
    await createAgent(root, { name: 'zwiadowca', description: 'Szukanie', body: '' });
    const agent = (await readSkillsSnapshot(root)).agents.find((a) => a.name === 'zwiadowca');
    expect(agent).toMatchObject({ enabled: true, deniedElsewhere: false });
  });
});
