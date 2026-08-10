import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRuleFile, parseRulePaths } from '../src/shared/rules';
import { createRule, readSkillsSnapshot } from '../src/main/skills';

function makeRoot(): string {
  return mkdtempSync(join(tmpdir(), 'vn3o-rules-root-'));
}

describe('parseRulePaths', () => {
  it('tnie po przecinkach i odrzuca puste segmenty', () => {
    expect(parseRulePaths(' tests/**/*.ts , e2e/** ,, ')).toEqual(['tests/**/*.ts', 'e2e/**']);
    expect(parseRulePaths(undefined)).toEqual([]);
    expect(parseRulePaths('   ')).toEqual([]);
  });
});

describe('buildRuleFile', () => {
  it('bez globów zapisuje samą treść, bez frontmattera', () => {
    expect(buildRuleFile({ name: 'styl', body: '- Wcięcia: 2 spacje.\n' })).toBe(
      '- Wcięcia: 2 spacje.\n',
    );
  });

  it('globy trafiają do frontmattera jako lista YAML', () => {
    const content = buildRuleFile({
      name: 'testy',
      paths: 'tests/**/*.ts, e2e/**',
      body: '- Nazwy opisowe.',
    });
    expect(content).toBe(
      '---\npaths:\n  - tests/**/*.ts\n  - e2e/**\n---\n\n- Nazwy opisowe.\n',
    );
  });

  it('pusta treść z globami daje sam frontmatter', () => {
    expect(buildRuleFile({ name: 'x', paths: 'src/**', body: '  ' })).toBe(
      '---\npaths:\n  - src/**\n---\n',
    );
  });
});

describe('createRule', () => {
  it('zapisuje plik reguły widoczny w snapszocie z badge paths', async () => {
    const root = makeRoot();
    const result = await createRule(root, {
      name: 'konwencje-testow',
      paths: 'tests/**/*.ts',
      body: '- Bez snapshotów.',
    });
    expect(result.ok).toBe(true);
    expect(readFileSync(join(root, '.claude', 'rules', 'konwencje-testow.md'), 'utf8')).toContain(
      'paths:\n  - tests/**/*.ts',
    );
    const rule = (await readSkillsSnapshot(root)).rules.find((r) => r.name === 'konwencje-testow');
    expect(rule).toMatchObject({ paths: 'tests/**/*.ts' });
  });

  it('odmawia nadpisania i odrzuca złą nazwę', async () => {
    const root = makeRoot();
    await createRule(root, { name: 'styl', body: 'a' });
    expect(await createRule(root, { name: 'styl', body: 'b' })).toEqual({
      ok: false,
      error: 'exists',
    });
    expect(await createRule(root, { name: 'Zła Nazwa', body: '' })).toEqual({
      ok: false,
      error: 'invalid-name',
    });
  });
});
