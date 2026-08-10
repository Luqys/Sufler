import { describe, expect, it } from 'vitest';
import {
  createClaudeStatusTracker,
  detectClaudeActivity,
  stripAnsi,
  type ClaudeActivity,
} from '../src/shared/claude-status';

describe('stripAnsi', () => {
  it('usuwa sekwencje CSI i OSC', () => {
    expect(stripAnsi('\x1b[31mczerwony\x1b[0m')).toBe('czerwony');
    expect(stripAnsi('\x1b]0;tytuł\x07tekst')).toBe('tekst');
  });
});

describe('detectClaudeActivity', () => {
  it('zwraca null bez sygnałów', () => {
    expect(detectClaudeActivity('zwykłe wyjście powłoki')).toBeNull();
  });

  it('rozpoznaje pracę, bezczynność i pytanie o zgodę', () => {
    expect(detectClaudeActivity('… esc to interrupt')).toBe('running');
    expect(detectClaudeActivity('gotowe\n? for shortcuts')).toBe('idle');
    expect(detectClaudeActivity('Do you want to allow Bash?\n  1. Yes')).toBe('needs-input');
  });

  it('wygrywa sygnał późniejszy w strumieniu', () => {
    const tail = 'esc to interrupt\n…praca…\nDo you want to proceed?\n  1. Yes';
    expect(detectClaudeActivity(tail)).toBe('needs-input');
    const answered = `${tail}\nOK, zrobione.\n? for shortcuts`;
    expect(detectClaudeActivity(answered)).toBe('idle');
  });

  it('działa na tekście pociętym sekwencjami ANSI', () => {
    expect(detectClaudeActivity('\x1b[2m? for shortcuts\x1b[0m')).toBe('idle');
  });
});

describe('createClaudeStatusTracker', () => {
  it('emituje tylko zmiany stanu', () => {
    const seen: ClaudeActivity[] = [];
    const tracker = createClaudeStatusTracker((activity) => seen.push(activity));
    tracker.push('start ');
    tracker.push('esc to interrupt');
    tracker.push(' nadal esc to interrupt');
    tracker.push('\nkoniec pracy\n? for shortcuts');
    tracker.push('\nDo you want to X?\n 1. Yes');
    expect(seen).toEqual(['running', 'idle', 'needs-input']);
  });
});
