import { cp, readdir, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { planImport, type ImportSkip } from '../../shared/project/import-drop';
import type { ImportPathsResult } from '../../shared/ipc';

/**
 * Import przeciąganiem (M61): kopiuje upuszczone ścieżki do katalogu projektu.
 * Nigdy nie nadpisuje istniejących wpisów (kolizje dostają sufiks w planie,
 * a `force:false` + `errorOnExist` łapią wyścig z równoległym zapisem).
 */
export async function importDroppedPaths(
  root: string,
  destDir: string,
  sources: string[],
): Promise<ImportPathsResult> {
  const rootAbs = resolve(root);
  const destAbs = resolve(destDir);
  if (destAbs !== rootAbs && !destAbs.startsWith(rootAbs + sep)) {
    return { ok: false, error: 'dest-outside-project' };
  }
  try {
    const info = await stat(destAbs);
    if (!info.isDirectory()) {
      return { ok: false, error: 'dest-not-dir' };
    }
  } catch {
    return { ok: false, error: 'dest-missing' };
  }
  const existing = await readdir(destAbs).catch(() => [] as string[]);
  const plan = planImport(
    sources.map((source) => resolve(source)),
    rootAbs,
    existing,
  );
  const skipped: ImportSkip[] = [...plan.skipped];
  let copied = 0;
  for (const item of plan.items) {
    try {
      await cp(item.source, join(destAbs, item.targetName), {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      copied += 1;
    } catch {
      skipped.push({ name: item.targetName, reason: 'copy-failed' });
    }
  }
  return { ok: true, copied, skipped };
}
