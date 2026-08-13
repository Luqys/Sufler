import { describe, expect, it } from 'vitest';
import {
  clampSize,
  defaultLayout,
  LAYOUT_LIMITS,
  normalizeLayout,
} from '../../src/shared/docks/layout';

describe('normalizeLayout', () => {
  it('zwraca domyślny układ dla braku danych', () => {
    expect(normalizeLayout(undefined)).toEqual(defaultLayout());
    expect(normalizeLayout(null)).toEqual(defaultLayout());
  });

  it('zwraca domyślny układ dla danych innych niż obiekt', () => {
    expect(normalizeLayout('tekst')).toEqual(defaultLayout());
    expect(normalizeLayout(42)).toEqual(defaultLayout());
    expect(normalizeLayout([240, 360])).toEqual(defaultLayout());
  });

  it('zachowuje poprawne wartości w zakresie', () => {
    const state = {
      version: 1,
      sidebarWidth: 300,
      rightDockWidth: 420,
      bottomDockHeight: 260,
      sidebarVisible: true,
      rightDockVisible: false,
      bottomDockVisible: true,
    };
    expect(normalizeLayout(state)).toEqual(state);
  });

  it('flagi widoczności: brak lub śmieci → domyślnie true, false zachowane', () => {
    expect(normalizeLayout({}).sidebarVisible).toBe(true);
    expect(normalizeLayout({ sidebarVisible: 'nie' }).sidebarVisible).toBe(true);
    expect(normalizeLayout({ bottomDockVisible: false }).bottomDockVisible).toBe(false);
  });

  it('uzupełnia brakujące pola wartościami domyślnymi', () => {
    expect(normalizeLayout({ sidebarWidth: 300 })).toEqual({
      ...defaultLayout(),
      sidebarWidth: 300,
    });
  });

  it('przycina wartości spoza zakresu', () => {
    const result = normalizeLayout({ sidebarWidth: 9999, rightDockWidth: 1, bottomDockHeight: -50 });
    expect(result.sidebarWidth).toBe(LAYOUT_LIMITS.sidebarWidth.max);
    expect(result.rightDockWidth).toBe(LAYOUT_LIMITS.rightDockWidth.min);
    expect(result.bottomDockHeight).toBe(LAYOUT_LIMITS.bottomDockHeight.min);
  });

  it('odrzuca wartości nienumeryczne i niefinite', () => {
    const result = normalizeLayout({
      sidebarWidth: '300',
      rightDockWidth: Number.NaN,
      bottomDockHeight: Number.POSITIVE_INFINITY,
    });
    expect(result).toEqual(defaultLayout());
  });

  it('zaokrągla wartości ułamkowe', () => {
    expect(normalizeLayout({ sidebarWidth: 300.6 }).sidebarWidth).toBe(301);
  });

  it('normalizuje wersję do 1', () => {
    expect(normalizeLayout({ version: 99, sidebarWidth: 300 }).version).toBe(1);
  });
});

describe('clampSize', () => {
  it('przycina do minimum i maksimum', () => {
    expect(clampSize('sidebarWidth', 0)).toBe(LAYOUT_LIMITS.sidebarWidth.min);
    expect(clampSize('sidebarWidth', 10_000)).toBe(LAYOUT_LIMITS.sidebarWidth.max);
    expect(clampSize('sidebarWidth', 333)).toBe(333);
  });
});
