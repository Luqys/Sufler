import { monaco } from '../monaco-setup';

/**
 * Rejestr modeli Monaco — jeden model na otwartą zakładkę, żyje do jej zamknięcia.
 * Stan „zapisane/brudne" liczony przez alternativeVersionId modelu względem
 * wersji zapamiętanej przy ostatnim zapisie/wczytaniu.
 */

const savedVersions = new Map<string, number>();
const contentSubscriptions = new Map<string, monaco.IDisposable>();

type DirtyListener = ((path: string, dirty: boolean) => void) | null;
let dirtyListener: DirtyListener = null;

export function setDirtyListener(listener: DirtyListener): void {
  dirtyListener = listener;
}

function modelFor(path: string): monaco.editor.ITextModel | null {
  return monaco.editor.getModel(monaco.Uri.file(path));
}

export function ensureModel(path: string, content: string): void {
  if (modelFor(path)) {
    return;
  }
  // Język wyznaczany z rozszerzenia w URI (wbudowane gramatyki Monaco).
  const model = monaco.editor.createModel(content, undefined, monaco.Uri.file(path));
  savedVersions.set(path, model.getAlternativeVersionId());
  contentSubscriptions.set(
    path,
    model.onDidChangeContent(() => {
      dirtyListener?.(path, isDirty(path));
    }),
  );
}

export function disposeModel(path: string): void {
  contentSubscriptions.get(path)?.dispose();
  contentSubscriptions.delete(path);
  savedVersions.delete(path);
  modelFor(path)?.dispose();
}

export function getModel(path: string): monaco.editor.ITextModel | null {
  return modelFor(path);
}

export function getModelValue(path: string): string | null {
  return modelFor(path)?.getValue() ?? null;
}

export function isDirty(path: string): boolean {
  const model = modelFor(path);
  if (!model) {
    return false;
  }
  return model.getAlternativeVersionId() !== savedVersions.get(path);
}

export function markSaved(path: string): void {
  const model = modelFor(path);
  if (!model) {
    return;
  }
  savedVersions.set(path, model.getAlternativeVersionId());
  dirtyListener?.(path, false);
}

/** „Zachowaj moją wersję": bufor rozjechany z dyskiem — od teraz liczy się jako brudny. */
export function markKeptMine(path: string): void {
  if (!modelFor(path)) {
    return;
  }
  savedVersions.set(path, -1);
  dirtyListener?.(path, true);
}

export function reloadModel(path: string, content: string): void {
  const model = modelFor(path);
  if (!model) {
    return;
  }
  model.setValue(content);
  savedVersions.set(path, model.getAlternativeVersionId());
  dirtyListener?.(path, false);
}
