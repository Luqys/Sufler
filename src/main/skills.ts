import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { frontmatterBool, frontmatterString, parseFrontmatter } from '../shared/frontmatter';
import {
  buildSkillFile,
  effectiveOverride,
  overridesOf,
  toggledOverrides,
  validateSkillName,
} from '../shared/skills';
import type {
  AgentEntry,
  ClaudeMdEntry,
  RuleEntry,
  SkillCreateInput,
  SkillCreateResult,
  SkillEntry,
  SkillScope,
  SkillToggleResult,
  SkillsSnapshot,
} from '../shared/ipc';

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

/** Mapy skillOverrides z łańcucha settings; uszkodzony JSON = pusta mapa. */
async function readOverridesChain(root: string): Promise<Array<Record<string, unknown>>> {
  const chain: Array<Record<string, unknown>> = [];
  for (const path of skillsSettingsPaths(root)) {
    const content = await readTextIfExists(path);
    if (content === null) {
      chain.push({});
      continue;
    }
    try {
      chain.push(overridesOf(JSON.parse(content)));
    } catch {
      chain.push({});
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

async function readAgents(root: string): Promise<AgentEntry[]> {
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
    entries.push({
      name: frontmatterString(data, 'name') ?? file.replace(/\.md$/, ''),
      description: frontmatterString(data, 'description') ?? '',
      path,
      tools: frontmatterString(data, 'tools'),
      model: frontmatterString(data, 'model'),
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
  const chain = await readOverridesChain(root);
  const [projectSkills, personalSkills, agents, rules, claudeMd] = await Promise.all([
    readSkillsFrom(join(root, '.claude', 'skills'), chain),
    readSkillsFrom(join(homedir(), '.claude', 'skills'), chain),
    readAgents(root),
    readRules(root),
    readClaudeMd(root),
  ]);
  return { projectSkills, personalSkills, agents, rules, claudeMd };
}

export function skillsDirForScope(root: string, scope: SkillScope): string {
  return scope === 'personal'
    ? join(homedir(), '.claude', 'skills')
    : join(root, '.claude', 'skills');
}

/** Kreator: katalog skilla + SKILL.md; `wx` chroni przed nadpisaniem. */
export async function createSkill(root: string, input: SkillCreateInput): Promise<SkillCreateResult> {
  if (validateSkillName(input.name) !== null) {
    return { ok: false, error: 'invalid-name' };
  }
  const dir = join(skillsDirForScope(root, input.scope), input.name);
  const path = join(dir, 'SKILL.md');
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path, buildSkillFile(input), { encoding: 'utf8', flag: 'wx' });
    return { ok: true, path };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, error: code === 'EEXIST' ? 'exists' : 'write-failed' };
  }
}

/**
 * Przełącznik: aktualizuje `skillOverrides` w settings.local.json projektu.
 * Nie dotyka pozostałych kluczy pliku; uszkodzony JSON nie jest nadpisywany.
 */
export async function setSkillEnabled(
  root: string,
  name: string,
  enabled: boolean,
): Promise<SkillToggleResult> {
  const localPath = skillsSettingsPaths(root)[0] ?? join(root, '.claude', 'settings.local.json');
  let settings: Record<string, unknown> = {};
  const content = await readTextIfExists(localPath);
  if (content !== null && content.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { ok: false, error: 'settings-unreadable' };
      }
      settings = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'settings-unreadable' };
    }
  }
  const chain = await readOverridesChain(root);
  settings['skillOverrides'] = toggledOverrides(chain[0] ?? {}, chain.slice(1), name, enabled);
  try {
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    return { ok: true, enabled };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}
