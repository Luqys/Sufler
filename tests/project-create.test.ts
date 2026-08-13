import { describe, expect, it } from 'vitest';
import { projectNameProblem, projectTargetPath } from '../src/shared/project-create';

describe('projectNameProblem', () => {
  it('przyjmuje normalne nazwy folderów', () => {
    expect(projectNameProblem('moj-projekt')).toBeNull();
    expect(projectNameProblem('Sklep 2026')).toBeNull();
    expect(projectNameProblem('ćwiczenia_zażółć')).toBeNull();
    expect(projectNameProblem('projekt.v2')).toBeNull();
  });

  it('puste i same białe znaki odpadają', () => {
    expect(projectNameProblem('')).toBe('empty');
    expect(projectNameProblem('   ')).toBe('empty');
  });

  it('ukośnik i dwukropek to już ścieżka, nie nazwa', () => {
    expect(projectNameProblem('a/b')).toBe('separator');
    expect(projectNameProblem('/tmp')).toBe('separator');
    expect(projectNameProblem('C:cos')).toBe('separator');
  });

  it('kropka na początku ukrywa folder', () => {
    expect(projectNameProblem('.ukryty')).toBe('dot');
    expect(projectNameProblem('.')).toBe('dot');
    expect(projectNameProblem('..')).toBe('dot');
  });

  it('odrzuca znaki psujące ścieżki i znaki kontrolne', () => {
    for (const znak of ['<', '>', '"', '|', '?', '*', '\\']) {
      expect(projectNameProblem(`projekt${znak}`)).toBe('invalid');
    }
    // Znak kontrolny w środku nazwy; na końcu obcina go `trim()`.
    expect(projectNameProblem(`projekt${String.fromCharCode(9)}nowy`)).toBe('invalid');
    expect(projectNameProblem(`projekt${String.fromCharCode(0)}`)).toBe('invalid');
  });

  it('białe znaki na brzegach są obcinane, nie odrzucane', () => {
    expect(projectNameProblem(`  sklep${String.fromCharCode(9)}`)).toBeNull();
  });

  it('pilnuje długości składowej ścieżki', () => {
    expect(projectNameProblem('a'.repeat(120))).toBeNull();
    expect(projectNameProblem('a'.repeat(121))).toBe('too-long');
  });
});

describe('projectTargetPath', () => {
  it('składa ścieżkę i przycina białe znaki', () => {
    expect(projectTargetPath('/Users/ktos/Projekty', 'sklep')).toBe('/Users/ktos/Projekty/sklep');
    expect(projectTargetPath('  /tmp  ', '  sklep  ')).toBe('/tmp/sklep');
  });

  it('nie dubluje ukośnika', () => {
    expect(projectTargetPath('/tmp/', 'sklep')).toBe('/tmp/sklep');
  });

  it('null przy złej nazwie albo braku lokalizacji', () => {
    expect(projectTargetPath('/tmp', '')).toBeNull();
    expect(projectTargetPath('/tmp', 'a/b')).toBeNull();
    expect(projectTargetPath('', 'sklep')).toBeNull();
  });
});
