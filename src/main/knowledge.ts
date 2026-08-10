import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { KnowledgeFile, KnowledgeGenerateResult } from '../shared/ipc';
import { baseName } from '../shared/paths';
import { writeTextFile } from './fs-tree';

const execFileAsync = promisify(execFile);

/** Plik wynikowy generatora — wykluczany z listy źródeł. */
export const KNOWLEDGE_OUTPUT = 'kontekst-agenta.md';

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
    if (!path.endsWith('.md') || path === KNOWLEDGE_OUTPUT) {
      continue;
    }
    try {
      files.push({ path, lines: countLines(await readFile(join(root, path), 'utf8')) });
    } catch {
      // plik zniknął — pomijamy
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Skleja wybrane pliki .md w jeden dokument-kontekst dla agenta. */
export async function generateKnowledgeContext(
  root: string,
  relPaths: string[],
): Promise<KnowledgeGenerateResult> {
  const sections: string[] = [];
  const included: string[] = [];
  for (const rel of relPaths) {
    try {
      const content = await readFile(join(root, rel), 'utf8');
      included.push(rel);
      sections.push(`\n\n---\n\n# 📄 ${rel}\n\n${content.trim()}\n`);
    } catch {
      // nieczytelny — pomijamy, resztę składamy dalej
    }
  }
  if (included.length === 0) {
    return { ok: false, error: 'Żaden z wybranych plików nie dał się odczytać.' };
  }
  const header = [
    '# Kontekst wiedzy agenta',
    '',
    `Projekt: ${baseName(root)} · plików: ${included.length} · wygenerowano: ${new Date().toISOString()}`,
    '',
    '## Spis treści',
    ...included.map((rel, index) => `${index + 1}. ${rel}`),
  ].join('\n');
  const document = header + sections.join('');
  const outputPath = join(root, KNOWLEDGE_OUTPUT);
  const written = await writeTextFile(outputPath, document);
  if (!written.ok) {
    return { ok: false, error: written.error };
  }
  return { ok: true, path: outputPath, files: included.length, bytes: document.length };
}
