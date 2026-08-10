import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { frontmatterBool, frontmatterString, parseFrontmatter } from '../shared/frontmatter';
import type {
  AgentEntry,
  ClaudeMdEntry,
  RuleEntry,
  SkillEntry,
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

export function claudeMdCandidates(root: string): Array<{ label: string; path: string }> {
  return [
    { label: 'CLAUDE.md (projekt)', path: join(root, 'CLAUDE.md') },
    { label: 'CLAUDE.local.md', path: join(root, 'CLAUDE.local.md') },
    { label: '~/.claude/CLAUDE.md', path: join(homedir(), '.claude', 'CLAUDE.md') },
  ];
}

async function readSkillsFrom(dir: string): Promise<SkillEntry[]> {
  const entries: SkillEntry[] = [];
  for (const child of await listDir(dir)) {
    const path = join(dir, child, 'SKILL.md');
    const content = await readTextIfExists(path);
    if (content === null) {
      continue;
    }
    const { data } = parseFrontmatter(content);
    entries.push({
      name: frontmatterString(data, 'name') ?? child,
      description: frontmatterString(data, 'description') ?? '',
      path,
      manual: frontmatterBool(data, 'disable-model-invocation'),
      disallowedTools: frontmatterString(data, 'disallowed-tools'),
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
  const [projectSkills, personalSkills, agents, rules, claudeMd] = await Promise.all([
    readSkillsFrom(join(root, '.claude', 'skills')),
    readSkillsFrom(join(homedir(), '.claude', 'skills')),
    readAgents(root),
    readRules(root),
    readClaudeMd(root),
  ]);
  return { projectSkills, personalSkills, agents, rules, claudeMd };
}
