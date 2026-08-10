/**
 * Heurystyka statusu sesji Claude na strumieniu wyjściowym pty (v1 wg SPEC.md).
 * Sygnały z TUI Claude Code:
 *  - „esc to interrupt" — trwa praca,
 *  - „? for shortcuts" — bezczynny prompt (praca skończona),
 *  - „Do you want …" / menu „1. Yes" — pytanie o zgodę.
 * Wygrywa sygnał, który wystąpił NAJPÓŹNIEJ w ogonie strumienia.
 * Jeśli heurystyka okaże się zawodna: hook Notification → gniazdo lokalne (docelowo).
 */

export type ClaudeActivity = 'running' | 'idle' | 'needs-input';

const ANSI_PATTERN = new RegExp(
  ['\\x1b\\[[0-9;?]*[ -/]*[@-~]', '\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)', '\\x1b[@-_]'].join(
    '|',
  ),
  'g',
);

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

interface Signal {
  activity: ClaudeActivity;
  pattern: RegExp;
}

const SIGNALS: Signal[] = [
  { activity: 'needs-input', pattern: /Do you want|Would you like|❯?\s*1\.\s*Yes/g },
  { activity: 'running', pattern: /esc to interrupt|Thinking…/g },
  { activity: 'idle', pattern: /\? for shortcuts/g },
];

function lastIndexOfPattern(text: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  let last = -1;
  for (const match of text.matchAll(pattern)) {
    last = match.index;
  }
  return last;
}

/** Zwraca wykryty stan albo null, gdy w ogonie nie ma żadnego sygnału. */
export function detectClaudeActivity(rawTail: string): ClaudeActivity | null {
  const text = stripAnsi(rawTail);
  let best: ClaudeActivity | null = null;
  let bestIndex = -1;
  for (const signal of SIGNALS) {
    const index = lastIndexOfPattern(text, signal.pattern);
    if (index > bestIndex) {
      bestIndex = index;
      best = signal.activity;
    }
  }
  return best;
}

export function createClaudeStatusTracker(onChange: (activity: ClaudeActivity) => void): {
  push(chunk: string): void;
} {
  let tail = '';
  let last: ClaudeActivity | null = null;
  return {
    push(chunk: string): void {
      tail = (tail + chunk).slice(-6000);
      const activity = detectClaudeActivity(tail);
      if (activity && activity !== last) {
        last = activity;
        onChange(activity);
      }
    },
  };
}
