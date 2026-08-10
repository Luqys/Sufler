import { describe, expect, it } from 'vitest';
import { formatElementReference, normalizeUrl } from '../src/shared/preview';

describe('normalizeUrl', () => {
  it('dodaje http:// gdy brak schematu', () => {
    expect(normalizeUrl('localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeUrl('  127.0.0.1:8080/app  ')).toBe('http://127.0.0.1:8080/app');
  });

  it('zachowuje istniejący schemat i pusty tekst', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeUrl('HTTP://x.pl')).toBe('HTTP://x.pl');
    expect(normalizeUrl('   ')).toBe('');
  });
});

describe('formatElementReference', () => {
  it('składa pełne odniesienie z id, klasami i tekstem', () => {
    const text = formatElementReference({
      selector: '#kup',
      tag: 'button',
      id: 'kup',
      classes: ['cta', 'duza'],
      text: 'Kup teraz',
      url: 'http://localhost:3000/',
    });
    expect(text).toBe(
      'Element <button id="kup" class="cta duza"> z tekstem „Kup teraz" — selektor CSS: #kup (strona: http://localhost:3000/) ',
    );
  });

  it('pomija puste fragmenty', () => {
    const text = formatElementReference({
      selector: 'main > div:nth-of-type(2)',
      tag: 'div',
      id: '',
      classes: [],
      text: '',
      url: 'http://localhost:5173/',
    });
    expect(text).toBe(
      'Element <div> — selektor CSS: main > div:nth-of-type(2) (strona: http://localhost:5173/) ',
    );
  });
});
