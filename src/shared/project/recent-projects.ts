/**
 * Ostatnie projekty w palecie komend (M87). Przełączanie projektu wymagało
 * dotąd powrotu na ekran startowy albo wycieczki do Ustawień — a to jedna
 * z najczęstszych czynności przy pracy nad kilkoma repozytoriami naraz.
 *
 * Czysta logika: uporządkowanie listy i etykiety.
 */

export interface RecentProject {
  /** Ścieżka absolutna korzenia. */
  path: string;
  /** Nazwa katalogu — to po niej człowiek szuka w palecie. */
  name: string;
  /** Katalog nadrzędny, do odróżnienia dwóch projektów o tej samej nazwie. */
  parent: string;
}

function splitPath(path: string): { name: string; parent: string } {
  const parts = path.replace(/\/+$/, '').split('/');
  const name = parts[parts.length - 1] ?? path;
  const parent = parts.slice(0, -1).join('/');
  return { name, parent };
}

/**
 * Lista do palety: bez bieżącego projektu (przełączanie na siebie nic nie robi),
 * bez duplikatów, w kolejności otrzymanej z main (od ostatnio otwartego).
 */
export function recentProjectsFor(
  roots: readonly string[],
  current: string | null,
  limit = 8,
): RecentProject[] {
  const seen = new Set<string>();
  const out: RecentProject[] = [];
  for (const raw of roots) {
    const path = raw.replace(/\/+$/, '');
    if (path === '' || path === current?.replace(/\/+$/, '') || seen.has(path)) {
      continue;
    }
    seen.add(path);
    out.push({ path, ...splitPath(path) });
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

/**
 * Podpowiedź przy nazwie: katalog nadrzędny skrócony do ostatniego elementu,
 * z `~` zamiast katalogu domowego. Pełna ścieżka nie mieści się w palecie,
 * a sam „src" czy „projekt" nie wystarcza do rozróżnienia.
 */
export function projectHint(project: RecentProject, home: string): string {
  const parent = project.parent;
  if (parent === '') {
    return '/';
  }
  const short = home !== '' && parent.startsWith(home) ? `~${parent.slice(home.length)}` : parent;
  const parts = short.split('/').filter((part) => part !== '');
  const last = parts[parts.length - 1] ?? short;
  return parts.length > 1 ? `…/${last}` : short;
}
