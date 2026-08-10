import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../src/shared/frontmatter';
import {
  buildSkillFile,
  effectiveOverride,
  normalizeOverride,
  overridesOf,
  toggledOverrides,
  validateSkillName,
} from '../src/shared/skills';
import { createSkill, readSkillsSnapshot, setSkillEnabled } from '../src/main/skills';

// Hermetyczny HOME: skille osobiste i ~/.claude/settings.json nie czytają
// prawdziwego konta użytkownika (os.homedir() honoruje $HOME).
const fakeHome = mkdtempSync(join(tmpdir(), 'vn3o-skills-home-'));
let realHome: string | undefined;

beforeAll(() => {
  realHome = process.env['HOME'];
  process.env['HOME'] = fakeHome;
});

afterAll(() => {
  process.env['HOME'] = realHome;
});

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), 'vn3o-skills-root-'));
}

function addSkill(root: string, name: string, frontmatter = ''): void {
  const dir = join(root, '.claude', 'skills', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Opis ${name}\n${frontmatter}---\n`);
}

describe('validateSkillName', () => {
  it('akceptuje kebab-case', () => {
    expect(validateSkillName('deploy')).toBeNull();
    expect(validateSkillName('generator-changelog-2')).toBeNull();
  });

  it('odrzuca pustą, wielkie litery, podkreślenia i myślniki na brzegach', () => {
    expect(validateSkillName('')).toBe('empty');
    expect(validateSkillName('  ')).toBe('empty');
    expect(validateSkillName('Deploy')).toBe('invalid');
    expect(validateSkillName('a_b')).toBe('invalid');
    expect(validateSkillName('-abc')).toBe('invalid');
    expect(validateSkillName('abc-')).toBe('invalid');
    expect(validateSkillName('a--b')).toBe('invalid');
    expect(validateSkillName('ż-le')).toBe('invalid');
  });

  it('odrzuca nazwę dłuższą niż 64 znaki', () => {
    expect(validateSkillName('a'.repeat(65))).toBe('too-long');
    expect(validateSkillName('a'.repeat(64))).toBeNull();
  });
});

describe('buildSkillFile', () => {
  it('buduje frontmatter odczytywalny przez parser panelu', () => {
    const content = buildSkillFile({
      name: 'deploy',
      description: 'Opis: z dwukropkiem i "cudzysłowem"',
      manual: true,
      disallowedTools: 'Bash, WebFetch',
      body: '## Kroki\n\n1. Zrób.',
    });
    const { data, body } = parseFrontmatter(content);
    expect(data['name']).toBe('deploy');
    expect(data['description']).toBe('Opis: z dwukropkiem i "cudzysłowem"');
    expect(data['disable-model-invocation']).toBe(true);
    expect(data['disallowed-tools']).toBe('Bash, WebFetch');
    expect(body.trim()).toBe('## Kroki\n\n1. Zrób.');
  });

  it('pomija opcjonalne pola i toleruje pustą treść', () => {
    const content = buildSkillFile({
      name: 'prosty',
      description: 'Opis',
      manual: false,
      body: '  ',
    });
    const { data, body } = parseFrontmatter(content);
    expect(data['disable-model-invocation']).toBeUndefined();
    expect(data['disallowed-tools']).toBeUndefined();
    expect(body.trim()).toBe('');
  });
});

describe('skillOverrides', () => {
  it('normalizuje tylko znane stany', () => {
    expect(normalizeOverride('off')).toBe('off');
    expect(normalizeOverride('user-invocable-only')).toBe('user-invocable-only');
    expect(normalizeOverride('nope')).toBeUndefined();
    expect(normalizeOverride(true)).toBeUndefined();
  });

  it('overridesOf toleruje śmieciowe settings', () => {
    expect(overridesOf(null)).toEqual({});
    expect(overridesOf({ skillOverrides: ['off'] })).toEqual({});
    expect(overridesOf({ skillOverrides: { a: 'off' } })).toEqual({ a: 'off' });
  });

  it('wyższy priorytet łańcucha wygrywa, brak wpisu = on', () => {
    const chain = [{ a: 'on' }, { a: 'off', b: 'off' }, { c: 'name-only' }];
    expect(effectiveOverride(chain, 'a')).toBe('on');
    expect(effectiveOverride(chain, 'b')).toBe('off');
    expect(effectiveOverride(chain, 'c')).toBe('name-only');
    expect(effectiveOverride(chain, 'd')).toBe('on');
    expect(effectiveOverride([{ a: 'zepsute' }, { a: 'off' }], 'a')).toBe('off');
  });

  it('toggledOverrides: wyłączenie dopisuje off, włączenie sprząta klucz', () => {
    expect(toggledOverrides({ inne: 'off' }, [], 'a', false)).toEqual({ inne: 'off', a: 'off' });
    expect(toggledOverrides({ a: 'off', inne: 'off' }, [], 'a', true)).toEqual({ inne: 'off' });
  });

  it('toggledOverrides: włączenie zostawia jawne on, gdy niższy poziom wyłącza', () => {
    expect(toggledOverrides({ a: 'off' }, [{ a: 'off' }], 'a', true)).toEqual({ a: 'on' });
    expect(toggledOverrides({ a: 'off' }, [{ a: 'name-only' }], 'a', true)).toEqual({});
  });
});

describe('createSkill', () => {
  it('tworzy katalog i SKILL.md, drugi raz zwraca exists', async () => {
    const root = makeRoot();
    const input = {
      scope: 'project' as const,
      name: 'nowy-skill',
      description: 'Opis nowego skilla',
      manual: false,
      body: 'Instrukcje.',
    };
    const result = await createSkill(root, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toBe(join(root, '.claude', 'skills', 'nowy-skill', 'SKILL.md'));
      const { data } = parseFrontmatter(readFileSync(result.path, 'utf8'));
      expect(data['name']).toBe('nowy-skill');
    }
    const again = await createSkill(root, input);
    expect(again).toEqual({ ok: false, error: 'exists' });
  });

  it('odrzuca złą nazwę i wspiera zakres osobisty', async () => {
    const root = makeRoot();
    expect(await createSkill(root, {
      scope: 'project',
      name: 'Złe Imię',
      description: 'x',
      manual: false,
      body: '',
    })).toEqual({ ok: false, error: 'invalid-name' });

    const personal = await createSkill(root, {
      scope: 'personal',
      name: 'osobisty-skill',
      description: 'x',
      manual: false,
      body: '',
    });
    expect(personal.ok).toBe(true);
    if (personal.ok) {
      expect(personal.path).toBe(join(fakeHome, '.claude', 'skills', 'osobisty-skill', 'SKILL.md'));
    }
  });
});

describe('setSkillEnabled + readSkillsSnapshot', () => {
  it('wyłączenie zapisuje off w settings.local.json i panel to widzi', async () => {
    const root = makeRoot();
    addSkill(root, 'deploy-prod');

    const off = await setSkillEnabled(root, 'deploy-prod', false);
    expect(off).toEqual({ ok: true, enabled: false });
    const localPath = join(root, '.claude', 'settings.local.json');
    const settings = JSON.parse(readFileSync(localPath, 'utf8')) as {
      skillOverrides: Record<string, string>;
    };
    expect(settings.skillOverrides['deploy-prod']).toBe('off');

    const snapshot = await readSkillsSnapshot(root);
    const entry = snapshot.projectSkills.find((skill) => skill.name === 'deploy-prod');
    expect(entry?.enabled).toBe(false);
    expect(entry?.override).toBe('off');

    const on = await setSkillEnabled(root, 'deploy-prod', true);
    expect(on).toEqual({ ok: true, enabled: true });
    const after = JSON.parse(readFileSync(localPath, 'utf8')) as {
      skillOverrides: Record<string, string>;
    };
    expect(after.skillOverrides['deploy-prod']).toBeUndefined();
  });

  it('nie niszczy innych kluczy pliku i pisze jawne on przy off z ustawień użytkownika', async () => {
    const root = makeRoot();
    addSkill(root, 'deploy-prod');
    const claudeDir = join(root, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, 'settings.local.json'),
      `${JSON.stringify({ permissions: { defaultMode: 'auto' } }, null, 2)}\n`,
    );
    mkdirSync(join(fakeHome, '.claude'), { recursive: true });
    writeFileSync(
      join(fakeHome, '.claude', 'settings.json'),
      `${JSON.stringify({ skillOverrides: { 'deploy-prod': 'off' } }, null, 2)}\n`,
    );

    // Skill wyłączony na poziomie użytkownika → panel widzi off.
    const before = await readSkillsSnapshot(root);
    expect(before.projectSkills.find((skill) => skill.name === 'deploy-prod')?.enabled).toBe(false);

    // Włączenie musi nadpisać poziom użytkownika jawnym "on" lokalnie.
    const on = await setSkillEnabled(root, 'deploy-prod', true);
    expect(on.ok).toBe(true);
    const settings = JSON.parse(readFileSync(join(claudeDir, 'settings.local.json'), 'utf8')) as {
      permissions: { defaultMode: string };
      skillOverrides: Record<string, string>;
    };
    expect(settings.permissions.defaultMode).toBe('auto');
    expect(settings.skillOverrides['deploy-prod']).toBe('on');

    const snapshot = await readSkillsSnapshot(root);
    expect(snapshot.projectSkills.find((skill) => skill.name === 'deploy-prod')?.enabled).toBe(true);
  });

  it('uszkodzony settings.local.json nie jest nadpisywany', async () => {
    const root = makeRoot();
    const claudeDir = join(root, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'settings.local.json'), '{zepsute');

    const result = await setSkillEnabled(root, 'cokolwiek', false);
    expect(result).toEqual({ ok: false, error: 'settings-unreadable' });
    expect(readFileSync(join(claudeDir, 'settings.local.json'), 'utf8')).toBe('{zepsute');
  });
});
