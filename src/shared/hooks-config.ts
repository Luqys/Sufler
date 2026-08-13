/**
 * Edytor hooków Claude Code (M70). Hooki mieszkają w `settings.json` jako
 * mapa zdarzenie → lista grup, a każda grupa ma opcjonalny `matcher`
 * i listę komend:
 *
 * ```json
 * { "hooks": { "PreToolUse": [ { "matcher": "Bash",
 *   "hooks": [ { "type": "command", "command": "..." } ] } ] } }
 * ```
 *
 * Ręczna edycja tego w JSON-ie jest okropna, więc panel Ustawień robi to
 * formularzem. Czysta logika: odczyt listy, dokładanie i usuwanie wpisów
 * bez ruszania cudzych.
 *
 * Nazwy zdarzeń wyczytane z binarki CLI 2.1.229 — tak samo jak kontrakt
 * `skillOverrides`.
 */

export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SubagentStop',
  'UserPromptSubmit',
  'SessionStart',
  'SessionEnd',
  'PreCompact',
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export interface HookEntry {
  event: HookEvent;
  /** Wzorzec narzędzia; pusty = wszystkie (tylko `PreToolUse`/`PostToolUse`). */
  matcher: string;
  command: string;
}

export function isHookEvent(value: string): value is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(value);
}

/** Zdarzenia, dla których `matcher` ma sens — reszta dotyczy całej sesji. */
export function supportsMatcher(event: HookEvent): boolean {
  return event === 'PreToolUse' || event === 'PostToolUse';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function commandsOf(group: unknown): string[] {
  const record = asRecord(group);
  const list = record?.['hooks'];
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((item) => asRecord(item)?.['command'])
    .filter((command): command is string => typeof command === 'string' && command !== '');
}

/** Wszystkie wpisy hooków z jednego pliku settings, w kolejności zapisu. */
export function readHookEntries(settings: unknown): HookEntry[] {
  const hooks = asRecord(asRecord(settings)?.['hooks']);
  if (!hooks) {
    return [];
  }
  const entries: HookEntry[] = [];
  for (const [event, groups] of Object.entries(hooks)) {
    if (!isHookEvent(event) || !Array.isArray(groups)) {
      continue;
    }
    for (const group of groups) {
      const matcher = asRecord(group)?.['matcher'];
      for (const command of commandsOf(group)) {
        entries.push({
          event,
          matcher: typeof matcher === 'string' ? matcher : '',
          command,
        });
      }
    }
  }
  return entries;
}

export type HookProblem = 'empty-command' | 'unknown-event';

export function hookProblem(event: string, command: string): HookProblem | null {
  if (!isHookEvent(event)) {
    return 'unknown-event';
  }
  return command.trim() === '' ? 'empty-command' : null;
}

/**
 * Settings po dołożeniu wpisu. Grupy o tym samym `matcher` łączymy, żeby nie
 * mnożyć wpisów; cudze komendy i nieznane pola zostają nietknięte.
 */
export function withHookAdded(
  settings: Record<string, unknown>,
  entry: HookEntry,
): Record<string, unknown> {
  const hooks = { ...(asRecord(settings['hooks']) ?? {}) };
  const groups = Array.isArray(hooks[entry.event]) ? [...(hooks[entry.event] as unknown[])] : [];
  const command = { type: 'command', command: entry.command.trim() };
  const index = groups.findIndex((group) => {
    const matcher = asRecord(group)?.['matcher'];
    return (typeof matcher === 'string' ? matcher : '') === entry.matcher;
  });
  if (index === -1) {
    const group: Record<string, unknown> = { hooks: [command] };
    if (entry.matcher !== '') {
      group['matcher'] = entry.matcher;
    }
    groups.push(group);
  } else {
    const group = { ...(asRecord(groups[index]) ?? {}) };
    const list = Array.isArray(group['hooks']) ? [...(group['hooks'] as unknown[])] : [];
    group['hooks'] = [...list, command];
    groups[index] = group;
  }
  hooks[entry.event] = groups;
  return { ...settings, hooks };
}

/**
 * Settings po usunięciu wpisu. Puste grupy, puste zdarzenia i pusta mapa
 * hooków znikają, żeby po sprzątaniu nie zostawały puste struktury.
 */
export function withHookRemoved(
  settings: Record<string, unknown>,
  entry: HookEntry,
): Record<string, unknown> {
  const hooksRaw = asRecord(settings['hooks']);
  if (!hooksRaw) {
    return settings;
  }
  const hooks = { ...hooksRaw };
  const groups = Array.isArray(hooks[entry.event]) ? (hooks[entry.event] as unknown[]) : [];
  const nextGroups: unknown[] = [];
  for (const group of groups) {
    const record = asRecord(group);
    const matcher = record?.['matcher'];
    const sameMatcher = (typeof matcher === 'string' ? matcher : '') === entry.matcher;
    if (!record || !sameMatcher) {
      nextGroups.push(group);
      continue;
    }
    const list = Array.isArray(record['hooks']) ? (record['hooks'] as unknown[]) : [];
    const kept = list.filter((item) => asRecord(item)?.['command'] !== entry.command);
    if (kept.length > 0) {
      nextGroups.push({ ...record, hooks: kept });
    }
  }
  if (nextGroups.length > 0) {
    hooks[entry.event] = nextGroups;
  } else {
    delete hooks[entry.event];
  }
  const next = { ...settings };
  if (Object.keys(hooks).length > 0) {
    next['hooks'] = hooks;
  } else {
    delete next['hooks'];
  }
  return next;
}
