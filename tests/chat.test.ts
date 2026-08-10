import { describe, expect, it } from 'vitest';
import {
  applyChatEvent,
  emptyChatState,
  summarizeToolInput,
  type ChatState,
} from '../src/shared/chat';

function play(events: Parameters<typeof applyChatEvent>[1][]): ChatState {
  return events.reduce(applyChatEvent, emptyChatState);
}

describe('applyChatEvent', () => {
  it('składa pełną turę: user → tool → text → done', () => {
    const state = play([
      { kind: 'user', text: 'Co robi ten projekt?' },
      { kind: 'tool', name: 'Read', detail: 'README.md' },
      { kind: 'text', text: 'To środowisko pracy z Claude Code.' },
      { kind: 'done', sessionId: 's1', costUsd: 0.12 },
    ]);
    expect(state.entries.map((entry) => entry.role)).toEqual(['user', 'tool', 'assistant']);
    expect(state.entries[1]).toMatchObject({ tool: 'Read', text: 'README.md' });
    expect(state.busy).toBe(false);
    expect(state.costUsd).toBe(0.12);
  });

  it('user włącza busy, error je gasi i dodaje wpis', () => {
    const afterUser = applyChatEvent(emptyChatState, { kind: 'user', text: 'x' });
    expect(afterUser.busy).toBe(true);
    const afterError = applyChatEvent(afterUser, { kind: 'error', message: 'brak sieci' });
    expect(afterError.busy).toBe(false);
    expect(afterError.entries.at(-1)).toMatchObject({ role: 'error', text: 'brak sieci' });
  });

  it('done bez kosztu nie kasuje poprzedniego kosztu', () => {
    const state = play([
      { kind: 'user', text: 'a' },
      { kind: 'done', sessionId: 's1', costUsd: 0.5 },
      { kind: 'user', text: 'b' },
      { kind: 'done', sessionId: 's1', costUsd: null },
    ]);
    expect(state.costUsd).toBe(0.5);
  });
});

describe('summarizeToolInput', () => {
  it('wybiera najbardziej znaczące pole wejścia', () => {
    expect(summarizeToolInput({ file_path: '/proj/a.ts' })).toBe('/proj/a.ts');
    expect(summarizeToolInput({ command: 'npm test' })).toBe('npm test');
    expect(summarizeToolInput({ pattern: 'TODO', path: '/proj' })).toBe('/proj');
    expect(summarizeToolInput({})).toBe('');
    expect(summarizeToolInput(null)).toBe('');
  });

  it('przycina bardzo długie wartości', () => {
    const long = 'x'.repeat(300);
    expect(summarizeToolInput({ command: long })).toHaveLength(120);
  });
});
