import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFY_PREFS,
  normalizeNotifyPrefs,
  shouldAnnounce,
  signalForTransition,
  SIGNAL_THROTTLE_MS,
} from '../../src/shared/docks/tab-signals';

describe('signalForTransition', () => {
  it('pytanie o zgodę ogłasza się zawsze, z każdego stanu', () => {
    expect(signalForTransition('running', 'needs-input', false)).toBe('attention');
    expect(signalForTransition('idle', 'needs-input', false)).toBe('attention');
  });

  it('skończona praca liczy się po pracy albo po pytaniu', () => {
    expect(signalForTransition('running', 'idle', false)).toBe('done');
    expect(signalForTransition('needs-input', 'idle', false)).toBe('done');
  });

  it('świeżo otwarta karta nie ogłasza nic', () => {
    expect(signalForTransition(undefined, 'idle', false)).toBeNull();
    expect(signalForTransition(undefined, 'needs-input', false)).toBeNull();
  });

  it('ten sam status po raz drugi milczy', () => {
    expect(signalForTransition('idle', 'idle', false)).toBeNull();
    expect(signalForTransition('needs-input', 'needs-input', false)).toBeNull();
  });

  it('błąd tylko przy niezerowym kodzie wyjścia', () => {
    expect(signalForTransition('running', 'exited', true)).toBe('error');
    expect(signalForTransition('running', 'exited', false)).toBeNull();
  });

  it('start pracy nie jest zdarzeniem do ogłaszania', () => {
    expect(signalForTransition('idle', 'running', false)).toBeNull();
  });
});

describe('shouldAnnounce', () => {
  it('pierwszy sygnał przechodzi', () => {
    expect(shouldAnnounce(undefined, 'done', 1000)).toBe(true);
  });

  it('powtórka tego samego sygnału czeka na dławik', () => {
    const last = { signal: 'done' as const, at: 1000 };
    expect(shouldAnnounce(last, 'done', 1000 + SIGNAL_THROTTLE_MS - 1)).toBe(false);
    expect(shouldAnnounce(last, 'done', 1000 + SIGNAL_THROTTLE_MS)).toBe(true);
  });

  it('inny sygnał przechodzi od razu — pytanie o zgodę nie może czekać', () => {
    expect(shouldAnnounce({ signal: 'done', at: 1000 }, 'attention', 1100)).toBe(true);
  });
});

describe('normalizeNotifyPrefs', () => {
  it('brak zapisu = wszystko włączone', () => {
    expect(normalizeNotifyPrefs(undefined)).toEqual(DEFAULT_NOTIFY_PREFS);
    expect(normalizeNotifyPrefs(null)).toEqual(DEFAULT_NOTIFY_PREFS);
  });

  it('połowiczny zapis uzupełnia się domyślnymi', () => {
    expect(normalizeNotifyPrefs({ sounds: false })).toEqual({ sounds: false, system: true });
  });

  it('śmieci w polach nie przechodzą', () => {
    expect(normalizeNotifyPrefs({ sounds: 'tak', system: 0 })).toEqual(DEFAULT_NOTIFY_PREFS);
  });
});
