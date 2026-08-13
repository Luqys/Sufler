import { baseName } from '../editor/paths';

/**
 * Import przeciąganiem (M61): plan kopiowania ścieżek upuszczonych z systemu
 * do katalogu projektu. Czysta logika — rozstrzyganie kolizji nazw i odsiew
 * źródeł, których kopiować nie wolno. Wykonanie (fs.cp) żyje w main.
 */

export type ImportSkipReason = 'inside-project' | 'contains-project' | 'copy-failed';

export interface ImportSkip {
  /** Nazwa bazowa źródła — do komunikatu w UI. */
  name: string;
  reason: ImportSkipReason;
}

export interface ImportPlanItem {
  /** Ścieżka absolutna źródła. */
  source: string;
  /** Nazwa w katalogu docelowym (po rozwiązaniu kolizji). */
  targetName: string;
}

export interface ImportPlan {
  items: ImportPlanItem[];
  skipped: ImportSkip[];
}

/** „raport.pdf" + 2 → „raport-2.pdf"; dotfile i katalog dostają sufiks na końcu. */
export function nameWithSuffix(name: string, n: number): string {
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    return `${name.slice(0, dot)}-${n}${name.slice(dot)}`;
  }
  return `${name}-${n}`;
}

/** Pierwsza wolna nazwa: bez zmian, a przy kolizji sufiksy -2, -3, … */
export function resolveCollision(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) {
    return name;
  }
  for (let n = 2; ; n += 1) {
    const candidate = nameWithSuffix(name, n);
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

/**
 * Układa plan importu. Ścieżki wejściowe muszą być absolutne i znormalizowane
 * (bez końcowych ukośników). Odrzuca źródła już leżące w projekcie oraz takie,
 * które projekt zawierają (kopiowanie rodzica projektu = nieskończona rekursja).
 */
export function planImport(
  sources: readonly string[],
  root: string,
  existing: Iterable<string>,
): ImportPlan {
  const taken = new Set(existing);
  const seen = new Set<string>();
  const items: ImportPlanItem[] = [];
  const skipped: ImportSkip[] = [];
  for (const source of sources) {
    if (seen.has(source)) {
      continue;
    }
    seen.add(source);
    const name = baseName(source);
    const sourcePrefix = source.endsWith('/') ? source : `${source}/`;
    if (source === root || root.startsWith(sourcePrefix)) {
      skipped.push({ name, reason: 'contains-project' });
      continue;
    }
    if (source.startsWith(`${root}/`)) {
      skipped.push({ name, reason: 'inside-project' });
      continue;
    }
    const targetName = resolveCollision(name, taken);
    taken.add(targetName);
    items.push({ source, targetName });
  }
  return { items, skipped };
}
