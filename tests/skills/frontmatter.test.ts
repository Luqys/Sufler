import { describe, expect, it } from 'vitest';
import { frontmatterBool, frontmatterString, parseFrontmatter } from '../../src/shared/skills/frontmatter';

describe('parseFrontmatter', () => {
  it('wyciąga pola i treść', () => {
    const { data, body } = parseFrontmatter(
      '---\nname: deploy\ndescription: Wdrożenie na prod\ndisable-model-invocation: true\n---\n\nInstrukcje\n',
    );
    expect(data['name']).toBe('deploy');
    expect(data['description']).toBe('Wdrożenie na prod');
    expect(data['disable-model-invocation']).toBe(true);
    expect(body).toBe('\nInstrukcje\n');
  });

  it('brak frontmattera → puste dane, pełna treść', () => {
    const { data, body } = parseFrontmatter('# Tytuł\ntekst');
    expect(data).toEqual({});
    expect(body).toBe('# Tytuł\ntekst');
  });

  it('uszkodzony YAML → puste dane', () => {
    const { data } = parseFrontmatter('---\n[niedomknięta lista\n---\ntreść');
    expect(data).toEqual({});
  });

  it('frontmatter będący skalarem → puste dane', () => {
    const { data } = parseFrontmatter('---\ntylko tekst\n---\ntreść');
    expect(data).toEqual({});
  });

  it('frontmatter musi zaczynać się w pierwszej linii', () => {
    const { data } = parseFrontmatter('\n---\nname: x\n---\n');
    expect(data).toEqual({});
  });

  it('obsługuje CRLF i frontmatter na końcu pliku', () => {
    expect(parseFrontmatter('---\r\nname: x\r\n---\r\ndalej').data['name']).toBe('x');
    expect(parseFrontmatter('---\nname: y\n---').data['name']).toBe('y');
  });
});

describe('frontmatterString / frontmatterBool', () => {
  it('normalizuje typy do tekstu', () => {
    const data = { a: 'tekst', b: 42, c: true, d: ['x', 'y'], e: { nested: 1 } };
    expect(frontmatterString(data, 'a')).toBe('tekst');
    expect(frontmatterString(data, 'b')).toBe('42');
    expect(frontmatterString(data, 'c')).toBe('true');
    expect(frontmatterString(data, 'd')).toBe('x, y');
    expect(frontmatterString(data, 'e')).toBeUndefined();
    expect(frontmatterString(data, 'brak')).toBeUndefined();
  });

  it('bool akceptuje true i "true"', () => {
    expect(frontmatterBool({ x: true }, 'x')).toBe(true);
    expect(frontmatterBool({ x: 'true' }, 'x')).toBe(true);
    expect(frontmatterBool({ x: false }, 'x')).toBe(false);
    expect(frontmatterBool({}, 'x')).toBe(false);
  });
});
