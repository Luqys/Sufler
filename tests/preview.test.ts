import { describe, expect, it } from 'vitest';
import {
  BROWSER_PREVIEW_PATH,
  browserPreviewIndex,
  browserPreviewPath,
  formatElementReference,
  isBrowserPreviewPath,
  nextBrowserPreviewPath,
  normalizeUrl,
} from '../src/shared/preview';

describe('ścieżki podglądu przeglądarki', () => {
  it('pierwszy podgląd zachowuje historyczną ścieżkę', () => {
    expect(browserPreviewPath(1)).toBe(BROWSER_PREVIEW_PATH);
    expect(browserPreviewPath(0)).toBe(BROWSER_PREVIEW_PATH);
    expect(browserPreviewPath(2)).toBe(`${BROWSER_PREVIEW_PATH}/2`);
  });

  it('rozpoznaje własne ścieżki i odczytuje numer', () => {
    expect(isBrowserPreviewPath(BROWSER_PREVIEW_PATH)).toBe(true);
    expect(isBrowserPreviewPath(`${BROWSER_PREVIEW_PATH}/7`)).toBe(true);
    expect(isBrowserPreviewPath('vn3o://graph')).toBe(false);
    expect(isBrowserPreviewPath('/projekt/plik.ts')).toBe(false);
    expect(browserPreviewIndex(BROWSER_PREVIEW_PATH)).toBe(1);
    expect(browserPreviewIndex(`${BROWSER_PREVIEW_PATH}/7`)).toBe(7);
    expect(browserPreviewIndex(`${BROWSER_PREVIEW_PATH}/nic`)).toBe(1);
  });

  it('kolejne kliknięcie daje kolejny wolny numer', () => {
    expect(nextBrowserPreviewPath([])).toBe(BROWSER_PREVIEW_PATH);
    expect(nextBrowserPreviewPath([BROWSER_PREVIEW_PATH])).toBe(`${BROWSER_PREVIEW_PATH}/2`);
    expect(
      nextBrowserPreviewPath([BROWSER_PREVIEW_PATH, `${BROWSER_PREVIEW_PATH}/2`, '/plik.ts']),
    ).toBe(`${BROWSER_PREVIEW_PATH}/3`);
  });

  it('zamknięty podgląd zwalnia swój numer', () => {
    expect(nextBrowserPreviewPath([`${BROWSER_PREVIEW_PATH}/2`])).toBe(BROWSER_PREVIEW_PATH);
    expect(nextBrowserPreviewPath([BROWSER_PREVIEW_PATH, `${BROWSER_PREVIEW_PATH}/3`])).toBe(
      `${BROWSER_PREVIEW_PATH}/2`,
    );
  });
});

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
