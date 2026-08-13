import { describe, expect, it } from 'vitest';
import { klasaPadu } from '../../e2e/reporter-flaki';

describe('klasaPadu', () => {
  it('start okna ma pierwszeństwo — to inna klasa niż asercja', () => {
    expect(klasaPadu('electronApplication.firstWindow: Timeout 30000ms exceeded')).toBe('start-okna');
    expect(klasaPadu('Timeout while waiting for event "window"')).toBe('start-okna');
  });

  it('treść kontra widoczność — dwie różne drogi diagnozy', () => {
    expect(klasaPadu('expect(locator).toContainText(expected) failed')).toBe('tresc');
    expect(klasaPadu('expect(locator).toBeVisible() failed')).toBe('widocznosc');
    expect(klasaPadu('expect(locator).toHaveClass(/focus/) failed')).toBe('widocznosc');
  });

  it('liczba elementów mówi o stanie aplikacji, nie o renderze', () => {
    expect(klasaPadu('expect(locator).toHaveCount(expected) failed')).toBe('liczba');
  });

  it('nieznany komunikat trafia do „inne" zamiast być zgadywany', () => {
    expect(klasaPadu('Error: connect ECONNREFUSED')).toBe('inne');
    expect(klasaPadu('')).toBe('inne');
  });
});
