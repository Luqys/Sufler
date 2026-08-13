import { describe, expect, it } from 'vitest';
import {
  effortCommand,
  handoverPrompt,
  modelCommand,
  planHandover,
  SHIFT_TAB,
  slashCommand,
} from '../../src/shared/claude/controls';

const CR = String.fromCharCode(13);
const ESC = String.fromCharCode(27);

describe('slashCommand', () => {
  it('dokłada Enter — bez niego wpis zawisłby w polu wejściowym', () => {
    expect(slashCommand('clear')).toBe(`/clear${CR}`);
    expect(slashCommand('compact')).toBe(`/compact${CR}`);
  });

  it('argument idzie po spacji, białe znaki obcięte', () => {
    expect(slashCommand('model', '  opus  ')).toBe(`/model opus${CR}`);
    expect(slashCommand('model', '')).toBe(`/model${CR}`);
    expect(slashCommand('model')).toBe(`/model${CR}`);
  });
});

describe('komendy modelu i wysiłku', () => {
  it('składają komendy, które CLI faktycznie zna', () => {
    expect(modelCommand('opus')).toBe(`/model opus${CR}`);
    expect(modelCommand('haiku')).toBe(`/model haiku${CR}`);
    expect(effortCommand('xhigh')).toBe(`/effort xhigh${CR}`);
    expect(effortCommand('max')).toBe(`/effort max${CR}`);
  });
});

describe('SHIFT_TAB', () => {
  it('to CSI Z — jedyna droga do zmiany trybu uprawnień w trakcie sesji', () => {
    expect(SHIFT_TAB).toBe(`${ESC}[Z`);
    expect(SHIFT_TAB).toHaveLength(3);
  });
});

describe('handoverPrompt', () => {
  it('każe przeczytać dziennik składnią @ i nie zaczynać pracy samemu', () => {
    const prompt = handoverPrompt('dziennik-sesji/2026-08-13-abc.md', null);
    expect(prompt).toContain('@dziennik-sesji/2026-08-13-abc.md');
    expect(prompt).toContain('nie zaczynaj pracy sam');
    expect(prompt).not.toContain('Streszczenie poprzedniej sesji');
  });

  it('streszczenie dokleja się osobnym akapitem', () => {
    const prompt = handoverPrompt('dziennik-sesji/a.md', '  Zrobione: X. Dalej: Y.  ');
    expect(prompt).toContain('Streszczenie poprzedniej sesji:');
    expect(prompt).toContain('Zrobione: X. Dalej: Y.');
  });
});

describe('planHandover', () => {
  const dzienniki = [
    { path: 'dziennik-sesji/2026-08-11-stary.md', mtimeMs: 1000 },
    { path: 'dziennik-sesji/2026-08-13-nowy.md', mtimeMs: 3000 },
    { path: 'dziennik-sesji/2026-08-12-sredni.md', mtimeMs: 2000 },
  ];

  it('bierze najświeższy dziennik, nie pierwszy z listy', () => {
    const plan = planHandover(dzienniki);
    expect(plan?.logPath).toBe('dziennik-sesji/2026-08-13-nowy.md');
    expect(plan?.prompt).toContain('@dziennik-sesji/2026-08-13-nowy.md');
  });

  it('brak dziennika to brak planu — nie otwieramy sesji z obietnicą kontekstu', () => {
    expect(planHandover([])).toBeNull();
  });

  it('nie modyfikuje wejścia', () => {
    const kopia = [...dzienniki];
    planHandover(dzienniki);
    expect(dzienniki).toEqual(kopia);
  });
});
