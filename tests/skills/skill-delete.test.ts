import { describe, expect, it } from 'vitest';
import { skillDirToDelete } from '../../src/shared/skills/skills';

const PROJEKT = '/Users/ktos/projekt/.claude/skills';
const OSOBISTE = '/Users/ktos/.claude/skills';
const DOZWOLONE = [PROJEKT, OSOBISTE];

describe('skillDirToDelete', () => {
  it('zwraca katalog skilla z projektu', () => {
    expect(skillDirToDelete(`${PROJEKT}/autofix/SKILL.md`, DOZWOLONE)).toBe(`${PROJEKT}/autofix`);
  });

  it('zwraca katalog skilla osobistego', () => {
    expect(skillDirToDelete(`${OSOBISTE}/canary/SKILL.md`, DOZWOLONE)).toBe(`${OSOBISTE}/canary`);
  });

  it('odmawia, gdy skill leży poza katalogami skilli', () => {
    expect(skillDirToDelete('/Users/ktos/inne/autofix/SKILL.md', DOZWOLONE)).toBeNull();
  });

  it('odmawia zagnieżdżeniu głębiej niż jeden katalog', () => {
    expect(skillDirToDelete(`${PROJEKT}/grupa/autofix/SKILL.md`, DOZWOLONE)).toBeNull();
  });

  it('odmawia plikom, które nie są SKILL.md', () => {
    expect(skillDirToDelete(`${PROJEKT}/autofix/README.md`, DOZWOLONE)).toBeNull();
  });

  it('odmawia ścieżkom z wyjściem w górę', () => {
    expect(skillDirToDelete(`${PROJEKT}/../../../etc/SKILL.md`, DOZWOLONE)).toBeNull();
  });

  it('sam katalog skilli nie jest skillem', () => {
    expect(skillDirToDelete(`${PROJEKT}/SKILL.md`, DOZWOLONE)).toBeNull();
  });
});
