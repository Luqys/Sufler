import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commandHint, commandInvocation, commandNameFromRelative } from '../src/shared/commands';
import { readSkillsSnapshot, skillsSourceDirs } from '../src/main/skills';

describe('commandNameFromRelative', () => {
  it('bierze nazwę pliku bez rozszerzenia', () => {
    expect(commandNameFromRelative('wydanie.md')).toBe('wydanie');
  });

  it('podkatalog tworzy przestrzeń nazw z dwukropkiem', () => {
    expect(commandNameFromRelative('frontend/build.md')).toBe('frontend:build');
    expect(commandNameFromRelative('a/b/c.md')).toBe('a:b:c');
  });

  it('pomija pliki spoza .md', () => {
    expect(commandNameFromRelative('README.txt')).toBeNull();
    expect(commandNameFromRelative('katalog')).toBeNull();
  });

  it('rozumie ścieżki z ukośnikiem wstecznym i przedrostkiem ./', () => {
    expect(commandNameFromRelative('.\\frontend\\build.md')).toBe('frontend:build');
  });
});

describe('commandInvocation / commandHint', () => {
  it('wywołanie ma ukośnik', () => {
    expect(commandInvocation('frontend:build')).toBe('/frontend:build');
  });

  it('pusta podpowiedź argumentów znaczy brak plakietki', () => {
    expect(commandHint('   ')).toBeNull();
    expect(commandHint(undefined)).toBeNull();
    expect(commandHint(' <ticket> ')).toBe('<ticket>');
  });
});

describe('readSkillsSnapshot — komendy projektu', () => {
  function makeProject(): string {
    const root = mkdtempSync(join(tmpdir(), 'vn3o-komendy-'));
    const dir = join(root, '.claude', 'commands');
    mkdirSync(join(dir, 'frontend'), { recursive: true });
    writeFileSync(
      join(dir, 'wydanie.md'),
      '---\ndescription: Buduje paczkę\nargument-hint: "<wersja>"\n---\n\nZrób wydanie.\n',
    );
    writeFileSync(join(dir, 'frontend', 'build.md'), 'Bez frontmattera.\n');
    writeFileSync(join(dir, 'notatka.txt'), 'nie komenda\n');
    return root;
  }

  it('czyta komendy z frontmatterem, przestrzenie nazw i pomija nie-.md', async () => {
    const snapshot = await readSkillsSnapshot(makeProject());
    const names = snapshot.commands.filter((c) => c.scope === 'project').map((c) => c.name);

    expect(names).toContain('wydanie');
    expect(names).toContain('frontend:build');
    expect(names).not.toContain('notatka');

    const release = snapshot.commands.find((c) => c.name === 'wydanie');
    expect(release?.description).toBe('Buduje paczkę');
    expect(release?.argumentHint).toBe('<wersja>');
    expect(release?.scope).toBe('project');
  });

  it('komenda bez frontmattera ma pusty opis, nie znika z listy', async () => {
    const snapshot = await readSkillsSnapshot(makeProject());
    expect(snapshot.commands.find((c) => c.name === 'frontend:build')?.description).toBe('');
  });

  it('katalogi komend są obserwowane razem z resztą panelu', () => {
    const dirs = skillsSourceDirs('/projekt');
    expect(dirs).toContain('/projekt/.claude/commands');
    expect(dirs.some((dir) => dir.endsWith('/.claude/commands') && dir !== '/projekt/.claude/commands')).toBe(
      true,
    );
  });
});
