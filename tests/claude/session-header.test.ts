import { describe, expect, it } from 'vitest';
import {
  createSessionStateTracker,
  stanZWyjscia,
  type StanSesji,
} from '../../src/shared/claude/session-header';

const NAGLOWEK =
  'Opus 5 (1M context) with xhigh · Claude Max · szymon@n3osystem.io\n' +
  '  ~/Desktop/Projekty/N3O_PANEL\n';

describe('stanZWyjscia', () => {
  it('czyta model i wysiłek z nagłówka sesji', () => {
    const stan = stanZWyjscia(NAGLOWEK);
    expect(stan.model).toBe('opus');
    expect(stan.modelOpis).toBe('Opus 5 (1M context)');
    expect(stan.wysilek).toBe('xhigh');
  });

  it('nagłówek bez wysiłku nie zgaduje poziomu', () => {
    const stan = stanZWyjscia('Sonnet 4.5 · Claude Pro · konto@example.com\n');
    expect(stan.model).toBe('sonnet');
    expect(stan.wysilek).toBeNull();
  });

  it('potwierdzenie zmiany w trakcie wygrywa z nagłówkiem startowym', () => {
    const stan = stanZWyjscia(`${NAGLOWEK}\n> /model sonnet\nSet model to sonnet\n`);
    expect(stan.model).toBe('sonnet');
    expect(stan.modelOpis).toBe('sonnet');
    // Wysiłek nie był zmieniany — zostaje ten z nagłówka.
    expect(stan.wysilek).toBe('xhigh');
  });

  it('liczy się OSTATNIA zmiana, nie pierwsza', () => {
    const stan = stanZWyjscia(
      `${NAGLOWEK}Set model to sonnet\nSet model to haiku\nSet effort to low\nEffort set to max\n`,
    );
    expect(stan.model).toBe('haiku');
    expect(stan.wysilek).toBe('max');
  });

  it('radzi sobie z kolorowaniem ANSI w strumieniu', () => {
    const esc = String.fromCharCode(27);
    const stan = stanZWyjscia(`${esc}[1mOpus 5 (1M context) with max${esc}[0m · Claude Max\n`);
    expect(stan.model).toBe('opus');
    expect(stan.wysilek).toBe('max');
  });

  it('wyjście bez nagłówka nie wymyśla stanu', () => {
    const stan = stanZWyjscia('zwykły terminal, nic o modelu\n$ ls\n');
    expect(stan).toEqual({ model: null, modelOpis: null, wysilek: null });
  });
});

describe('createSessionStateTracker', () => {
  it('zgłasza dopiero zmianę stanu, nie każdy chunk', () => {
    const zmiany: StanSesji[] = [];
    const tracker = createSessionStateTracker((stan) => zmiany.push(stan));
    tracker.push(NAGLOWEK);
    tracker.push('jakieś wyjście bez znaczenia\n');
    tracker.push('kolejne wyjście\n');
    expect(zmiany).toHaveLength(1);
    expect(zmiany[0]?.model).toBe('opus');

    tracker.push('Set model to haiku\n');
    expect(zmiany).toHaveLength(2);
    expect(zmiany[1]?.model).toBe('haiku');
  });

  it('skleja stan z chunków podzielonych w środku wiersza', () => {
    const zmiany: StanSesji[] = [];
    const tracker = createSessionStateTracker((stan) => zmiany.push(stan));
    tracker.push('Opus 5 (1M cont');
    tracker.push('ext) with high · Claude Max\n');
    expect(zmiany[zmiany.length - 1]?.wysilek).toBe('high');
  });
});
