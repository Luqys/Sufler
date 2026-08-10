import { spawn } from 'node:child_process';
import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DirEntry,
  ReadDirResult,
  ReadFileResult,
  ReadImageResult,
  WriteFileResult,
} from '../shared/ipc';
import { imageMime } from '../shared/media';

/** Spec wyklucza pliki >50 MB; tniemy znacznie wcześniej, zanim Monaco zacznie się krztusić. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Zdjęcia bywają większe niż pliki tekstowe; data URI ~25 MB Chromium trawi bez problemu. */
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

/**
 * Wyjście `git check-ignore -z --stdin`: ścieżki rozdzielone NUL-ami, katalogi
 * echem z końcowym ukośnikiem (bo tak je podajemy na wejściu).
 */
export function parseCheckIgnoreOutput(output: string): Set<string> {
  const names = new Set<string>();
  for (const raw of output.split('\0')) {
    if (!raw) {
      continue;
    }
    names.add(raw.endsWith('/') ? raw.slice(0, -1) : raw);
  }
  return names;
}

export function sortEntries<T extends { name: string; kind: 'dir' | 'file' }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'dir' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Pyta gita, które wpisy z katalogu są ignorowane. Delegowanie do `git check-ignore`
 * zamiast własnego parsera .gitignore daje pełną semantykę (zagnieżdżone pliki,
 * negacje, exclude globalny). Poza repozytorium git — pusty zbiór.
 */
function gitIgnoredNames(cwd: string, names: string[]): Promise<Set<string>> {
  return new Promise((resolve) => {
    if (names.length === 0) {
      resolve(new Set());
      return;
    }
    const child = spawn('git', ['check-ignore', '-z', '--stdin'], { cwd });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.on('error', () => resolve(new Set()));
    child.on('close', () => resolve(parseCheckIgnoreOutput(output)));
    child.stdin.on('error', () => {
      // git nie istnieje albo zamknął wejście — 'error'/'close' powyżej domkną sprawę
    });
    child.stdin.write(names.join('\0'));
    child.stdin.end();
  });
}

export async function readDirListing(dirPath: string): Promise<ReadDirResult> {
  try {
    const dirents = await readdir(dirPath, { withFileTypes: true });
    const entries: DirEntry[] = dirents
      .filter((dirent) => dirent.name !== '.git')
      .map((dirent) => ({
        name: dirent.name,
        path: join(dirPath, dirent.name),
        kind: dirent.isDirectory() ? 'dir' : 'file',
        ignored: false,
      }));
    const ignored = await gitIgnoredNames(
      dirPath,
      entries.map((entry) => (entry.kind === 'dir' ? `${entry.name}/` : entry.name)),
    );
    for (const entry of entries) {
      entry.ignored = ignored.has(entry.name);
    }
    return { ok: true, entries: sortEntries(entries) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function writeTextFile(filePath: string, content: string): Promise<WriteFileResult> {
  try {
    const tmp = `${filePath}.visualn3o-tmp`;
    await writeFile(tmp, content, 'utf8');
    await rename(tmp, filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function readImageForPreview(filePath: string): Promise<ReadImageResult> {
  const mime = imageMime(filePath);
  if (!mime) {
    return { ok: false, error: 'not-image' };
  }
  try {
    const info = await stat(filePath);
    if (info.size > MAX_IMAGE_SIZE) {
      return { ok: false, error: 'too-large' };
    }
    const buffer = await readFile(filePath);
    return { ok: true, dataUri: `data:${mime};base64,${buffer.toString('base64')}`, size: info.size };
  } catch {
    return { ok: false, error: 'unreadable' };
  }
}

export async function readFileForEditor(filePath: string): Promise<ReadFileResult> {
  try {
    const info = await stat(filePath);
    if (info.size > MAX_FILE_SIZE) {
      return { ok: false, error: 'too-large' };
    }
    const buffer = await readFile(filePath);
    if (buffer.subarray(0, 8192).includes(0)) {
      return { ok: false, error: 'binary' };
    }
    return { ok: true, content: buffer.toString('utf8') };
  } catch {
    return { ok: false, error: 'unreadable' };
  }
}
