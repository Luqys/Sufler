import { stringify } from 'yaml';

/**
 * Logika wyłączania subagentów współdzielona między procesami.
 *
 * Claude Code nie ma `agentOverrides` — oficjalny mechanizm wyłączenia
 * subagenta to reguła `Agent(nazwa)` w `permissions.deny` (docs:
 * sub-agents.md#disable-specific-subagents). Deny obowiązuje z każdego
 * poziomu settings i nie da się go nadpisać wyżej, dlatego aplikacja:
 * - zapisuje wyłącznie `<projekt>/.claude/settings.local.json`,
 * - regułę z settings.json projektu lub użytkownika pokazuje jako blokadę
 *   przełącznika, zamiast udawać, że umie ją cofnąć.
 */

export interface AgentDraft {
  name: string;
  description: string;
  /** Narzędzia po przecinku; puste = agent dziedziczy wszystkie. */
  tools?: string;
  /** Alias modelu (sonnet/opus/haiku); puste = dziedziczy z sesji. */
  model?: string;
  body: string;
}

/** Treść nowego pliku `.claude/agents/<nazwa>.md`: frontmatter + prompt. */
export function buildAgentFile(draft: AgentDraft): string {
  const frontmatter: Record<string, unknown> = {
    name: draft.name,
    description: draft.description.trim(),
  };
  const tools = draft.tools?.trim();
  if (tools) {
    frontmatter['tools'] = tools;
  }
  const model = draft.model?.trim();
  if (model) {
    frontmatter['model'] = model;
  }
  const body = draft.body.trim();
  return `---\n${stringify(frontmatter)}---\n${body === '' ? '' : `\n${body}\n`}`;
}

export function agentDenyRule(name: string): string {
  return `Agent(${name})`;
}

/** Nazwa z reguły `Agent(nazwa)`; null dla pozostałych reguł permissions. */
export function agentOfDenyRule(rule: string): string | null {
  const match = /^Agent\((.+)\)$/.exec(rule.trim());
  const name = match?.[1]?.trim();
  return name ? name : null;
}

/** Lista `permissions.deny` ze sparsowanego pliku settings (tolerancyjnie). */
export function denyRulesOf(settings: unknown): string[] {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    return [];
  }
  const permissions = (settings as Record<string, unknown>)['permissions'];
  if (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions)) {
    return [];
  }
  const deny = (permissions as Record<string, unknown>)['deny'];
  return Array.isArray(deny) ? deny.filter((rule): rule is string => typeof rule === 'string') : [];
}

export function denyHasAgent(deny: readonly string[], name: string): boolean {
  return deny.some((rule) => agentOfDenyRule(rule) === name);
}

export interface AgentAvailability {
  /** false ⇔ reguła deny na którymkolwiek poziomie settings. */
  enabled: boolean;
  /** Reguła poza settings.local.json — lokalny przełącznik jej nie cofnie. */
  deniedElsewhere: boolean;
}

/** Stan agenta z łańcucha deny, od settings.local.json projektu w dół. */
export function agentAvailability(
  chain: ReadonlyArray<readonly string[]>,
  name: string,
): AgentAvailability {
  const denied = chain.map((deny) => denyHasAgent(deny, name));
  return { enabled: !denied.some(Boolean), deniedElsewhere: denied.slice(1).some(Boolean) };
}

/**
 * Settings po przełączeniu agenta: zmienia wyłącznie `permissions.deny`
 * (pozostałe reguły i klucze pliku zostają nietknięte). Włączenie bez
 * aktywnej reguły jest no-opem — nie dopisuje pustych struktur.
 */
export function withAgentDeny(
  settings: Record<string, unknown>,
  name: string,
  enable: boolean,
): Record<string, unknown> {
  const permissionsRaw = settings['permissions'];
  const permissions =
    typeof permissionsRaw === 'object' && permissionsRaw !== null && !Array.isArray(permissionsRaw)
      ? { ...(permissionsRaw as Record<string, unknown>) }
      : {};
  const denyRaw = permissions['deny'];
  const deny: unknown[] = Array.isArray(denyRaw) ? denyRaw : [];
  const kept = deny.filter((rule) => typeof rule !== 'string' || agentOfDenyRule(rule) !== name);
  if (enable && kept.length === deny.length) {
    return settings;
  }
  permissions['deny'] = enable ? kept : [...kept, agentDenyRule(name)];
  return { ...settings, permissions };
}
