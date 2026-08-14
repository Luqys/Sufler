import { describe, expect, it } from 'vitest';
import {
  NO_OVERFLOW,
  sameOverflow,
  scrollStep,
  tabSignal,
  tabsOverflow,
  type TabBox,
  type TabSignal,
} from '../../src/shared/docks/tab-scroll';

/** Pasek z kartami po 100 px. */
function boxes(...signals: TabSignal[]): TabBox[] {
  return signals.map((signal, index) => ({ offset: index * 100, width: 100, signal }));
}

describe('tabsOverflow', () => {
  it('wszystko się mieści → bez strzałek', () => {
    expect(tabsOverflow(boxes('none', 'none'), 0, 300)).toEqual(NO_OVERFLOW);
    expect(tabsOverflow([], 0, 300)).toEqual(NO_OVERFLOW);
  });

  it('ciasny pasek: strzałka w prawo, po przewinięciu także w lewo', () => {
    const ciasno = tabsOverflow(boxes('none', 'none', 'none'), 0, 250);
    expect(ciasno.right).toBe(true);
    expect(ciasno.left).toBe(false);

    const przewiniete = tabsOverflow(boxes('none', 'none', 'none'), 20, 250);
    expect(przewiniete.left).toBe(true);
    expect(przewiniete.right).toBe(true);

    // Dojazd do końca (50 + 250 = 300 = koniec zawartości) gasi prawą strzałkę,
    // razem z zapasem na subpiksele.
    expect(tabsOverflow(boxes('none', 'none', 'none'), 50, 250).right).toBe(false);
    expect(tabsOverflow(boxes('none', 'none', 'none'), 49.5, 250).right).toBe(false);
  });

  it('strzałka niesie sygnał karty schowanej po jej stronie', () => {
    // Widok 100–200: pierwsza karta schowana z lewej, trzecia z prawej.
    const overflow = tabsOverflow(boxes('done', 'none', 'needs-input'), 100, 100);
    expect(overflow.leftSignal).toBe('done');
    expect(overflow.rightSignal).toBe('needs-input');
  });

  it('pytanie o zgodę bije martwą sesję i skończoną pracę po tej samej stronie', () => {
    const overflow = tabsOverflow(boxes('done', 'needs-input', 'none'), 200, 100);
    expect(overflow.leftSignal).toBe('needs-input');
    expect(overflow.rightSignal).toBe('none');
    expect(tabsOverflow(boxes('done', 'failed', 'none'), 200, 100).leftSignal).toBe('failed');
  });

  it('karta widoczna choćby skrajem nie zapala strzałki', () => {
    const overflow = tabsOverflow(boxes('done', 'none'), 60, 100);
    expect(overflow.left).toBe(true);
    expect(overflow.leftSignal).toBe('none');
  });
});

describe('tabSignal', () => {
  it('kolorem mówią tylko sesje Claude', () => {
    expect(tabSignal('terminal', 'idle')).toBe('none');
    expect(tabSignal('terminal', 'needs-input', true)).toBe('none');
  });

  it('kod wyjścia ≠ 0 bije stan sesji, praca w toku nic nie zgłasza', () => {
    expect(tabSignal('claude', 'exited', true)).toBe('failed');
    expect(tabSignal('claude', 'idle', true)).toBe('failed');
    expect(tabSignal('claude', 'needs-input')).toBe('needs-input');
    expect(tabSignal('claude', 'idle')).toBe('done');
    expect(tabSignal('claude', 'running')).toBe('none');
    expect(tabSignal('claude', 'exited')).toBe('none');
  });
});

describe('sameOverflow', () => {
  it('porównuje wszystkie cztery pola', () => {
    expect(sameOverflow(NO_OVERFLOW, { ...NO_OVERFLOW })).toBe(true);
    expect(sameOverflow(NO_OVERFLOW, { ...NO_OVERFLOW, right: true })).toBe(false);
    expect(sameOverflow(NO_OVERFLOW, { ...NO_OVERFLOW, leftSignal: 'done' })).toBe(false);
  });
});

describe('scrollStep', () => {
  it('skok to prawie cały widok, ale nigdy śladowy', () => {
    expect(scrollStep(400)).toBe(280);
    expect(scrollStep(40)).toBe(60);
  });
});
