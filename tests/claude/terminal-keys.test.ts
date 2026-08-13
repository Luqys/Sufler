import { describe, expect, it } from 'vitest';
import { CLAUDE_NEWLINE, isClaudeNewline, type KeyStroke } from '../../src/shared/claude/terminal-keys';

function stroke(overrides: Partial<KeyStroke> = {}): KeyStroke {
  return {
    type: 'keydown',
    key: 'Enter',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...overrides,
  };
}

describe('isClaudeNewline', () => {
  it('Shift+Enter to nowa linia w poleceniu', () => {
    expect(isClaudeNewline(stroke({ shiftKey: true }))).toBe(true);
  });

  it('zwykły Enter zatwierdza polecenie', () => {
    expect(isClaudeNewline(stroke())).toBe(false);
  });

  it('inne modyfikatory zostawiamy terminalowi', () => {
    expect(isClaudeNewline(stroke({ shiftKey: true, altKey: true }))).toBe(false);
    expect(isClaudeNewline(stroke({ shiftKey: true, ctrlKey: true }))).toBe(false);
    expect(isClaudeNewline(stroke({ shiftKey: true, metaKey: true }))).toBe(false);
  });

  it('reaguje tylko na wciśnięcie klawisza Enter', () => {
    expect(isClaudeNewline(stroke({ shiftKey: true, type: 'keyup' }))).toBe(false);
    expect(isClaudeNewline(stroke({ shiftKey: true, key: 'a' }))).toBe(false);
  });

  it('ciąg wysyłany do pty to ESC + CR — tego oczekuje Claude Code', () => {
    const escape = String.fromCharCode(27);
    const carriageReturn = String.fromCharCode(13);
    expect(CLAUDE_NEWLINE).toBe(`${escape}${carriageReturn}`);
  });
});
