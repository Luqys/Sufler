import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  hookProblem,
  readHookEntries,
  withHookAdded,
  withHookRemoved,
  type HookEntry,
} from '../shared/hooks-config';
import { skillsSettingsPaths } from './skills';
import { globalScriptPath } from './session-log-global';
import type { HookLayer, HookListEntry, HookWriteResult } from '../shared/ipc';

/**
 * Hooki z trzech warstw settings (M70). Kolejność i zasada zapisu jak przy
 * `skillOverrides`: czytamy wszystkie warstwy, a dopisujemy do
 * `.claude/settings.local.json` projektu — najmocniejszej warstwy, którą
 * aplikacja ma prawo ruszać.
 *
 * Wpisy wskazujące skrypt dziennika sesji są oznaczone jako `managed`
 * i nieusuwalne z tej listy: właścicielem jest przełącznik dziennika,
 * a skasowanie ich tutaj rozjechałoby oba miejsca.
 */

const LAYERS: HookLayer[] = ['local', 'project', 'user'];

function layerPaths(root: string): Record<HookLayer, string> {
  const [local, project, user] = skillsSettingsPaths(root);
  return { local: local ?? '', project: project ?? '', user: user ?? '' };
}

async function readSettingsFile(path: string): Promise<Record<string, unknown> | null> {
  try {
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  } catch (error) {
    // Brak pliku to poprawny stan; uszkodzonego JSON-a nie nadpisujemy.
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? {} : null;
  }
}

export async function listHooks(root: string): Promise<HookListEntry[]> {
  const paths = layerPaths(root);
  const marker = globalScriptPath();
  const entries: HookListEntry[] = [];
  for (const layer of LAYERS) {
    const settings = await readSettingsFile(paths[layer]);
    if (settings === null) {
      continue;
    }
    for (const entry of readHookEntries(settings)) {
      entries.push({ ...entry, layer, managed: entry.command.includes(marker) });
    }
  }
  return entries;
}

async function writeLayer(
  path: string,
  update: (settings: Record<string, unknown>) => Record<string, unknown>,
): Promise<HookWriteResult> {
  const settings = await readSettingsFile(path);
  if (settings === null) {
    return { ok: false, error: 'settings-unreadable' };
  }
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(update(settings), null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}

export async function addHook(root: string, entry: HookEntry): Promise<HookWriteResult> {
  if (hookProblem(entry.event, entry.command) !== null) {
    return { ok: false, error: 'invalid-hook' };
  }
  const trimmed: HookEntry = { ...entry, command: entry.command.trim(), matcher: entry.matcher.trim() };
  return writeLayer(layerPaths(root).local, (settings) => withHookAdded(settings, trimmed));
}

export async function removeHook(
  root: string,
  layer: HookLayer,
  entry: HookEntry,
): Promise<HookWriteResult> {
  if (entry.command.includes(globalScriptPath())) {
    return { ok: false, error: 'managed-hook' };
  }
  return writeLayer(layerPaths(root)[layer], (settings) => withHookRemoved(settings, entry));
}
