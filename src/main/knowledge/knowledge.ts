import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { KnowledgeFile } from '../../shared/ipc';
import { buildOutline } from '../../shared/knowledge/knowledge-outline';
import { baseName } from '../../shared/editor/paths';
import { writeTextFile } from '../project/fs-tree';

const execFileAsync = promisify(execFile);

/** Plik dawnego generatora kontekstu — nadal wykluczany, bo mógł zostać w projektach. */
export const KNOWLEDGE_OUTPUT = 'kontekst-agenta.md';

/** Automatycznie utrzymywany konspekt wiedzy — też wykluczany ze źródeł. */
export const OUTLINE_OUTPUT = 'konspekt-wiedzy.md';

const WALK_SKIP = new Set(['node_modules', '.git', '.obsidian', '.trash', 'dist', 'out']);
const WALK_MAX_FILES = 500;
const WALK_MAX_DEPTH = 6;

function countLines(content: string): number {
  if (content === '') {
    return 0;
  }
  return content.replace(/\n$/, '').split('\n').length;
}

async function listViaGit(root: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '-z', '-co', '--exclude-standard', '--', '*.md'],
      { cwd: root, timeout: 10_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' },
    );
    return stdout.split('\0').filter(Boolean);
  } catch {
    return null; // poza repozytorium git
  }
}

async function listViaWalk(root: string): Promise<string[]> {
  const results: string[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > WALK_MAX_DEPTH || results.length >= WALK_MAX_FILES) {
      return;
    }
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (results.length >= WALK_MAX_FILES) {
        return;
      }
      const full = join(dir, name);
      if (name.endsWith('.md')) {
        results.push(full.slice(root.length + 1));
      } else if (!name.includes('.') && !WALK_SKIP.has(name)) {
        await walk(full, depth + 1);
      }
    }
  };
  await walk(root, 0);
  return results;
}

export async function listMarkdownFiles(root: string): Promise<KnowledgeFile[]> {
  const paths = (await listViaGit(root)) ?? (await listViaWalk(root));
  const files: KnowledgeFile[] = [];
  for (const path of paths) {
    if (!path.endsWith('.md') || path === KNOWLEDGE_OUTPUT || path === OUTLINE_OUTPUT) {
      continue;
    }
    try {
      const content = await readFile(join(root, path), 'utf8');
      files.push({ path, lines: countLines(content) });
    } catch {
      // plik zniknął — pomijamy
    }
  }
  // Pliki z korzenia najpierw, potem katalogi alfabetycznie, w środku po nazwie.
  const dirOf = (path: string): string => {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
  };
  return files.sort((a, b) => {
    const dirA = dirOf(a.path);
    const dirB = dirOf(b.path);
    if (dirA !== dirB) {
      if (dirA === '') {
        return -1;
      }
      if (dirB === '') {
        return 1;
      }
      return dirA.localeCompare(dirB, undefined, { sensitivity: 'base' });
    }
    return a.path.localeCompare(b.path, undefined, { sensitivity: 'base' });
  });
}

/**
 * Przelicza konspekt wiedzy (konspekt-wiedzy.md w korzeniu projektu).
 * Zapis tylko, gdy treść realnie się zmieniła (bez pętli zapisu z watcherem).
 */
export async function rebuildOutline(root: string): Promise<void> {
  const files = await listMarkdownFiles(root);
  const sources: Array<{ path: string; content: string }> = [];
  for (const file of files.slice(0, 300)) {
    try {
      sources.push({ path: file.path, content: await readFile(join(root, file.path), 'utf8') });
    } catch {
      // plik zniknął między listowaniem a odczytem
    }
  }
  const outline = buildOutline(baseName(root), sources);
  const target = join(root, OUTLINE_OUTPUT);
  const existing = await readFile(target, 'utf8').catch(() => null);
  if (existing !== outline) {
    await writeTextFile(target, outline);
  }
}
