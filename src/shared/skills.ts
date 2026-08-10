import { stringify } from 'yaml';

/**
 * Logika skilli współdzielona między procesami: walidacja nazw, treść nowego
 * SKILL.md i stany `skillOverrides` z plików settings Claude Code.
 *
 * Przełączanie skilli opiera się o natywny mechanizm Claude Code (≥2.1.199):
 * klucz `skillOverrides` w settings.json ze stanami on/off/name-only/
 * user-invocable-only. Aplikacja zapisuje wyłącznie
 * `<projekt>/.claude/settings.local.json` — plik o najwyższym priorytecie
 * spośród zarządzalnych, więc przełącznik zawsze działa, a globalna
 * konfiguracja użytkownika zostaje nietknięta.
 */

export const SKILL_OVERRIDE_STATES = ['on', 'off', 'name-only', 'user-invocable-only'] as const;
export type SkillOverrideState = (typeof SKILL_OVERRIDE_STATES)[number];

export function normalizeOverride(value: unknown): SkillOverrideState | undefined {
  return SKILL_OVERRIDE_STATES.includes(value as SkillOverrideState)
    ? (value as SkillOverrideState)
    : undefined;
}

/** Mapa `skillOverrides` ze sparsowanego pliku settings (tolerancyjnie). */
export function overridesOf(settings: unknown): Record<string, unknown> {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    return {};
  }
  const overrides = (settings as Record<string, unknown>)['skillOverrides'];
  if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
    return {};
  }
  return overrides as Record<string, unknown>;
}

/**
 * Efektywny stan skilla z łańcucha map override, od najwyższego priorytetu
 * (settings.local.json projektu) do najniższego (~/.claude/settings.json).
 */
export function effectiveOverride(
  chain: ReadonlyArray<Record<string, unknown>>,
  name: string,
): SkillOverrideState {
  for (const overrides of chain) {
    const state = normalizeOverride(overrides[name]);
    if (state) {
      return state;
    }
  }
  return 'on';
}

/**
 * Nowa mapa override najwyższego priorytetu po przełączeniu skilla.
 * Włączenie usuwa klucz (wraca stan domyślny), chyba że niższy poziom nadal
 * wyłącza skill — wtedy zostaje jawne "on", żeby przełącznik wygrał.
 */
export function toggledOverrides(
  local: Record<string, unknown>,
  rest: ReadonlyArray<Record<string, unknown>>,
  name: string,
  enable: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...local };
  if (!enable) {
    next[name] = 'off';
    return next;
  }
  delete next[name];
  if (effectiveOverride(rest, name) === 'off') {
    next[name] = 'on';
  }
  return next;
}

export type SkillNameError = 'empty' | 'invalid' | 'too-long';

/** Nazwa skilla = nazwa katalogu: kebab-case (małe litery/cyfry i myślniki). */
export function validateSkillName(name: string): SkillNameError | null {
  if (name.trim() === '') {
    return 'empty';
  }
  if (name.length > 64) {
    return 'too-long';
  }
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) ? null : 'invalid';
}

export interface SkillDraft {
  name: string;
  description: string;
  /** true → frontmatter `disable-model-invocation` (skill tylko do /wywołania). */
  manual: boolean;
  disallowedTools?: string;
  body: string;
}

/** Treść nowego SKILL.md: frontmatter YAML + instrukcje. */
export function buildSkillFile(draft: SkillDraft): string {
  const frontmatter: Record<string, unknown> = {
    name: draft.name,
    description: draft.description.trim(),
  };
  if (draft.manual) {
    frontmatter['disable-model-invocation'] = true;
  }
  const disallowed = draft.disallowedTools?.trim();
  if (disallowed) {
    frontmatter['disallowed-tools'] = disallowed;
  }
  const body = draft.body.trim();
  return `---\n${stringify(frontmatter)}---\n${body === '' ? '' : `\n${body}\n`}`;
}
