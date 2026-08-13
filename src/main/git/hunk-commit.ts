import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { commitMessageProblem, isSafeRelativePath, normalizeCommitMessage } from '../../shared/git/git-commit';
import { buildPatch, parseUnifiedDiff, type FileDiff } from '../../shared/git/hunks';
import type { GitCommitResult } from '../../shared/ipc';

const execFileAsync = promisify(execFile);

/**
 * Commit wybranych fragmentów (M85).
 *
 * Zwykły `git apply --cached` wpuściłby łatkę do indeksu użytkownika, a potem
 * trzeba by commitować indeks — czyli zabrać ze sobą wszystko, co ktoś
 * zastage'ował wcześniej. Aplikacja tego nie robi (zasada z M69: nie ruszamy
 * indeksu pod palcami pracującego człowieka), więc cała operacja idzie przez
 * TYMCZASOWY indeks: `read-tree HEAD` → łatki wybranych hunków → `write-tree`
 * → `commit-tree` → `update-ref HEAD`.
 *
 * Skutek: HEAD dostaje dokładnie zaznaczone fragmenty, a drzewo robocze
 * zostaje nietknięte. Indeks też — z jednym koniecznym wyjątkiem: dla ścieżek,
 * które właśnie weszły do commita, zrównujemy go z nowym HEAD. Bez tego trzyma
 * treść sprzed commita i `git status` pokazuje zmianę w obie strony (odwrotny
 * diff w indeksie). Test jednostkowy pilnuje, że cudze zastage'owane pliki
 * zostają przy tym w spokoju.
 */

async function git(root: string, args: string[], env?: Record<string, string>): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    timeout: 30_000,
    maxBuffer: 32 * 1024 * 1024,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
  });
  return stdout;
}

function messageOf(error: unknown): string {
  const shell = error as { stderr?: string; stdout?: string; message?: string };
  return `${shell.stderr ?? ''}\n${shell.stdout ?? ''}\n${shell.message ?? ''}`.trim();
}

/**
 * Hunki pliku liczone wobec HEAD (nie wobec indeksu) — łatka ma się nakładać
 * na zawartość z HEAD, bo taki jest punkt wyjścia tymczasowego indeksu.
 */
export async function readFileHunks(root: string, path: string): Promise<FileDiff | null> {
  if (!isSafeRelativePath(path)) {
    return null;
  }
  try {
    const stdout = await git(root, ['diff', 'HEAD', '--', path]);
    return parseUnifiedDiff(stdout)[0] ?? null;
  } catch {
    return null;
  }
}

export interface HunkSelection {
  path: string;
  /** Indeksy hunków w kolejności z `readFileHunks`; pusta lista = cały plik. */
  hunks: number[];
}

export async function commitHunks(
  root: string,
  selections: readonly HunkSelection[],
  message: string,
): Promise<GitCommitResult> {
  if (selections.some((entry) => !isSafeRelativePath(entry.path))) {
    return { ok: false, error: 'bad-path' };
  }
  if (selections.length === 0) {
    return { ok: false, error: 'nothing-selected' };
  }
  if (commitMessageProblem(message) !== null) {
    return { ok: false, error: 'empty-message' };
  }
  try {
    await git(root, ['rev-parse', '--verify', 'HEAD']);
  } catch {
    // Bez HEAD nie ma z czego zbudować indeksu częściowego — to droga dla M69.
    return { ok: false, error: 'commit-failed', detail: 'brak-HEAD' };
  }

  const dir = await mkdtemp(join(tmpdir(), 'sufler-hunk-'));
  const indexFile = join(dir, 'index');
  const env = { GIT_INDEX_FILE: indexFile };
  try {
    await git(root, ['read-tree', 'HEAD'], env);
    for (const selection of selections) {
      if (selection.hunks.length === 0) {
        // Cały plik: zawartość z drzewa roboczego prosto do tymczasowego indeksu.
        await git(root, ['update-index', '--add', '--', selection.path], env);
        continue;
      }
      const file = await readFileHunks(root, selection.path);
      if (file === null || file.binary) {
        return { ok: false, error: 'commit-failed', detail: 'plik-nierozdzielny' };
      }
      const patch = buildPatch(file, selection.hunks);
      if (patch === '') {
        continue;
      }
      const patchFile = join(dir, 'latka.diff');
      await writeFile(patchFile, patch, 'utf8');
      await git(root, ['apply', '--cached', patchFile], env);
    }

    const tree = (await git(root, ['write-tree'], env)).trim();
    const head = (await git(root, ['rev-parse', 'HEAD'])).trim();
    const headTree = (await git(root, ['rev-parse', 'HEAD^{tree}'])).trim();
    if (tree === headTree) {
      return { ok: false, error: 'nothing-to-commit' };
    }
    const hash = (
      await git(root, ['commit-tree', tree, '-p', head, '-m', normalizeCommitMessage(message)])
    ).trim();
    await git(root, ['update-ref', 'HEAD', hash]);
    /*
     * Indeks użytkownika trzeba zrównać z NOWYM HEAD dla zatwierdzonych
     * ścieżek — inaczej trzyma treść sprzed commita i `git status` pokazuje
     * zmianę w obie strony (odwrotny diff w indeksie). Dotykamy wyłącznie
     * ścieżek, które właśnie weszły do commita; cudze zastage'owane pliki
     * zostają nietknięte. Drzewo robocze zostaje bez zmian.
     */
    await git(root, ['reset', '--quiet', 'HEAD', '--', ...selections.map((entry) => entry.path)]);
    return { ok: true, shortHash: hash.slice(0, 7), files: selections.length };
  } catch (error) {
    const text = messageOf(error);
    if (/Please tell me who you are|unable to auto-detect email|empty ident name/i.test(text)) {
      return { ok: false, error: 'identity-missing' };
    }
    return { ok: false, error: 'commit-failed', detail: text.slice(0, 400) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
