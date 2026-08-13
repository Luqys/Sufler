import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { agentAvailability, buildAgentFile, denyRulesOf, withAgentDeny } from '../../shared/skills/agents';
import { commandNameFromRelative } from '../../shared/claude/commands';
import { frontmatterBool, frontmatterString, parseFrontmatter } from '../../shared/skills/frontmatter';
import { buildRuleFile } from '../../shared/skills/rules';
import {
  buildSkillFile,
  effectiveOverride,
  overridesOf,
  toggledOverrides,
  validateSkillName,
} from '../../shared/skills/skills';
import type {
  AgentCreateInput,
  AgentEntry,
  ClaudeMdEntry,
  CommandEntry,
  RuleCreateInput,
  RuleEntry,
  SkillCreateInput,
  SkillCreateResult,
  SkillEntry,
  SkillScope,
  SkillToggleResult,
  SkillsSnapshot,
} from '../../shared/ipc';

async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function listDir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}

function countLines(content: string): number {
  if (content === '') {
    return 0;
  }
  return content.replace(/\n$/, '').split('\n').length;
}

/** Katalogi źródłowe panelu — także do obserwacji chokidar. */
export function skillsSourceDirs(root: string): string[] {
  return [
    join(root, '.claude', 'skills'),
    join(homedir(), '.claude', 'skills'),
    join(root, '.claude', 'agents'),
    join(root, '.claude', 'rules'),
    join(root, '.claude', 'commands'),
    join(homedir(), '.claude', 'commands'),
  ];
}

/**
 * Pliki settings z `skillOverrides`, od najwyższego priorytetu.
 * Aplikacja zapisuje wyłącznie pierwszy z nich (settings.local.json).
 */
export function skillsSettingsPaths(root: string): string[] {
  return [
    join(root, '.claude', 'settings.local.json'),
    join(root, '.claude', 'settings.json'),
    join(homedir(), '.claude', 'settings.json'),
  ];
}

export function claudeMdCandidates(root: string): Array<{ label: string; path: string }> {
  return [
    { label: 'CLAUDE.md (projekt)', path: join(root, 'CLAUDE.md') },
    { label: 'CLAUDE.local.md', path: join(root, 'CLAUDE.local.md') },
    { label: '~/.claude/CLAUDE.md', path: join(homedir(), '.claude', 'CLAUDE.md') },
  ];
}

/** Sparsowane pliki settings z łańcucha; brak pliku lub uszkodzony JSON = null. */
async function readSettingsChain(root: string): Promise<unknown[]> {
  const chain: unknown[] = [];
  for (const path of skillsSettingsPaths(root)) {
    const content = await readTextIfExists(path);
    if (content === null) {
      chain.push(null);
      continue;
    }
    try {
      chain.push(JSON.parse(content));
    } catch {
      chain.push(null);
    }
  }
  return chain;
}

async function readSkillsFrom(
  dir: string,
  chain: ReadonlyArray<Record<string, unknown>>,
): Promise<SkillEntry[]> {
  const entries: SkillEntry[] = [];
  for (const child of await listDir(dir)) {
    const path = join(dir, child, 'SKILL.md');
    const content = await readTextIfExists(path);
    if (content === null) {
      continue;
    }
    const { data } = parseFrontmatter(content);
    const name = frontmatterString(data, 'name') ?? child;
    const override = effectiveOverride(chain, name);
    entries.push({
      name,
      description: frontmatterString(data, 'description') ?? '',
      path,
      manual: frontmatterBool(data, 'disable-model-invocation'),
      disallowedTools: frontmatterString(data, 'disallowed-tools'),
      override,
      enabled: override !== 'off',
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function readAgents(
  root: string,
  denyChain: ReadonlyArray<readonly string[]>,
): Promise<AgentEntry[]> {
  const dir = join(root, '.claude', 'agents');
  const entries: AgentEntry[] = [];
  for (const file of await listDir(dir)) {
    if (!file.endsWith('.md')) {
      continue;
    }
    const path = join(dir, file);
    const content = await readTextIfExists(path);
    if (content === null) {
      continue;
    }
    const { data } = parseFrontmatter(content);
    const name = frontmatterString(data, 'name') ?? file.replace(/\.md$/, '');
    entries.push({
      name,
      description: frontmatterString(data, 'description') ?? '',
      path,
      tools: frontmatterString(data, 'tools'),
      model: frontmatterString(data, 'model'),
      ...agentAvailability(denyChain, name),
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function readRules(root: string): Promise<RuleEntry[]> {
  const dir = join(root, '.claude', 'rules');
  const entries: RuleEntry[] = [];
  for (const file of await listDir(dir)) {
    if (!file.endsWith('.md')) {
      continue;
    }
    const path = join(dir, file);
    const content = await readTextIfExists(path);
    if (content === null) {
      continue;
    }
    const { data } = parseFrontmatter(content);
    entries.push({
      name: file.replace(/\.md$/, ''),
      path,
      paths: frontmatterString(data, 'paths'),
    });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Slash-komendy z katalogu `commands` (M68). Podkatalogi tworzą przestrzenie
 * nazw, więc schodzimy rekurencyjnie — z płytkim limitem, żeby dowiązanie
 * w kółko nie zapętliło panelu.
 */
async function readCommands(
  dir: string,
  scope: SkillScope,
  prefix = '',
  depth = 0,
): Promise<CommandEntry[]> {
  if (depth > 4) {
    return [];
  }
  const entries: CommandEntry[] = [];
  for (const child of await listDir(dir)) {
    const relative = prefix === '' ? child : `${prefix}/${child}`;
    const path = join(dir, child);
    const name = commandNameFromRelative(relative);
    if (name === null) {
      entries.push(...(await readCommands(path, scope, relative, depth + 1)));
      continue;
    }
    const content = await readTextIfExists(path);
    if (content === null) {
      continue;
    }
    const { data } = parseFrontmatter(content);
    entries.push({
      name,
      description: frontmatterString(data, 'description') ?? '',
      path,
      scope,
      argumentHint: frontmatterString(data, 'argument-hint'),
      model: frontmatterString(data, 'model'),
      allowedTools: frontmatterString(data, 'allowed-tools'),
    });
  }
  return entries;
}

async function readClaudeMd(root: string): Promise<ClaudeMdEntry[]> {
  const entries: ClaudeMdEntry[] = [];
  for (const candidate of claudeMdCandidates(root)) {
    const content = await readTextIfExists(candidate.path);
    if (content !== null) {
      entries.push({ ...candidate, lines: countLines(content) });
    }
  }
  return entries;
}

export async function readSkillsSnapshot(root: string): Promise<SkillsSnapshot> {
  const settingsChain = await readSettingsChain(root);
  const chain = settingsChain.map(overridesOf);
  const [projectSkills, personalSkills, agents, rules, projectCommands, personalCommands, claudeMd] =
    await Promise.all([
      readSkillsFrom(join(root, '.claude', 'skills'), chain),
      readSkillsFrom(join(homedir(), '.claude', 'skills'), chain),
      readAgents(root, settingsChain.map(denyRulesOf)),
      readRules(root),
      readCommands(join(root, '.claude', 'commands'), 'project'),
      readCommands(join(homedir(), '.claude', 'commands'), 'personal'),
      readClaudeMd(root),
    ]);
  // Komenda projektu przykrywa osobistą o tej samej nazwie — tak samo jak w CLI.
  const commands = [...projectCommands, ...personalCommands]
    .filter(
      (entry, index, all) => all.findIndex((other) => other.name === entry.name) === index,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return { projectSkills, personalSkills, agents, rules, commands, claudeMd };
}

export function skillsDirForScope(root: string, scope: SkillScope): string {
  return scope === 'personal'
    ? join(homedir(), '.claude', 'skills')
    : join(root, '.claude', 'skills');
}

/** Wspólny zapis kreatorów; `wx` chroni przed nadpisaniem istniejącego pliku. */
async function writeNewFile(dir: string, file: string, content: string): Promise<SkillCreateResult> {
  const path = join(dir, file);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path, content, { encoding: 'utf8', flag: 'wx' });
    return { ok: true, path };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, error: code === 'EEXIST' ? 'exists' : 'write-failed' };
  }
}

/** Kreator: katalog skilla + SKILL.md. */
export async function createSkill(root: string, input: SkillCreateInput): Promise<SkillCreateResult> {
  if (validateSkillName(input.name) !== null) {
    return { ok: false, error: 'invalid-name' };
  }
  return writeNewFile(join(skillsDirForScope(root, input.scope), input.name), 'SKILL.md', buildSkillFile(input));
}

/** Kreator subagenta: <root>/.claude/agents/<nazwa>.md. */
export async function createAgent(root: string, input: AgentCreateInput): Promise<SkillCreateResult> {
  if (validateSkillName(input.name) !== null) {
    return { ok: false, error: 'invalid-name' };
  }
  return writeNewFile(join(root, '.claude', 'agents'), `${input.name}.md`, buildAgentFile(input));
}

/** Kreator reguły: <root>/.claude/rules/<nazwa>.md. */
export async function createRule(root: string, input: RuleCreateInput): Promise<SkillCreateResult> {
  if (validateSkillName(input.name) !== null) {
    return { ok: false, error: 'invalid-name' };
  }
  return writeNewFile(join(root, '.claude', 'rules'), `${input.name}.md`, buildRuleFile(input));
}

/** settings.local.json do zapisu; uszkodzony JSON → null (nie nadpisujemy go). */
async function readWritableSettings(path: string): Promise<Record<string, unknown> | null> {
  const content = await readTextIfExists(path);
  if (content === null || content.trim() === '') {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function writeSettings(
  path: string,
  settings: Record<string, unknown>,
  enabled: boolean,
): Promise<SkillToggleResult> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    return { ok: true, enabled };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}

/**
 * Przełącznik skilla: aktualizuje `skillOverrides` w settings.local.json
 * projektu. Nie dotyka pozostałych kluczy pliku; uszkodzony JSON nie jest
 * nadpisywany.
 */
export async function setSkillEnabled(
  root: string,
  name: string,
  enabled: boolean,
): Promise<SkillToggleResult> {
  const localPath = skillsSettingsPaths(root)[0] ?? join(root, '.claude', 'settings.local.json');
  const settings = await readWritableSettings(localPath);
  if (settings === null) {
    return { ok: false, error: 'settings-unreadable' };
  }
  const chain = (await readSettingsChain(root)).map(overridesOf);
  settings['skillOverrides'] = toggledOverrides(chain[0] ?? {}, chain.slice(1), name, enabled);
  return writeSettings(localPath, settings, enabled);
}

/**
 * Przełącznik subagenta: reguła `Agent(nazwa)` w `permissions.deny`
 * settings.local.json projektu. Deny z niższych poziomów nie da się cofnąć
 * lokalnie — UI pokazuje wtedy blokadę (AgentEntry.deniedElsewhere).
 */
export async function setAgentEnabled(
  root: string,
  name: string,
  enabled: boolean,
): Promise<SkillToggleResult> {
  const localPath = skillsSettingsPaths(root)[0] ?? join(root, '.claude', 'settings.local.json');
  const settings = await readWritableSettings(localPath);
  if (settings === null) {
    return { ok: false, error: 'settings-unreadable' };
  }
  return writeSettings(localPath, withAgentDeny(settings, name, enabled), enabled);
}
