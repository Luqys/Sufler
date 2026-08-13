/**
 * Biurka projektów (M91). Do tej pory aplikacja miała jeden projekt naraz:
 * przełączenie (M87) czyściło karty edytora, ale zostawiało doki z terminalami
 * poprzedniego projektu — czyli przełączało w połowie.
 *
 * Biurko to para „projekt + jego stan roboczy". Przełączenie chowa jedno
 * i pokazuje drugie; procesy pty żyją dalej, bo odmontowanie terminala tylko
 * odpina go z widoku. Sesja Claude w schowanym biurku pracuje w tle —
 * to jest cała różnica wobec przełączania projektu.
 *
 * Czysta logika: lista biurek, wybór aktywnego, cykl.
 */

export interface Desk {
  /** Stały identyfikator biurka — klucz stanu roboczego. */
  id: string;
  /** Korzeń projektu (ścieżka absolutna, bez końcowego ukośnika). */
  root: string;
}

export interface DesksState {
  desks: Desk[];
  activeId: string;
}

/** Nazwa biurka na pasku: ostatni element ścieżki. */
export function deskName(root: string): string {
  const parts = root.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] ?? root;
}

function normalizeRoot(root: string): string {
  return root.replace(/\/+$/, '');
}

export function makeDeskId(root: string, taken: readonly Desk[]): string {
  const base = `biurko-${deskName(root)}`;
  if (!taken.some((desk) => desk.id === base)) {
    return base;
  }
  let index = 2;
  while (taken.some((desk) => desk.id === `${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

/** Stan startowy: jedno biurko z bieżącym projektem. */
export function initialDesks(root: string): DesksState {
  const desk: Desk = { id: makeDeskId(root, []), root: normalizeRoot(root) };
  return { desks: [desk], activeId: desk.id };
}

/**
 * Dodanie biurka. Projekt już otwarty nie tworzy drugiego biurka — zamiast
 * tego przełączamy się na istniejące; dwa biurka tego samego projektu miałyby
 * wspólne pliki i rozjeżdżały się nawzajem.
 */
export function addDesk(state: DesksState, root: string): DesksState {
  const path = normalizeRoot(root);
  const existing = state.desks.find((desk) => desk.root === path);
  if (existing) {
    return { ...state, activeId: existing.id };
  }
  const desk: Desk = { id: makeDeskId(path, state.desks), root: path };
  return { desks: [...state.desks, desk], activeId: desk.id };
}

/**
 * Zamknięcie biurka. Ostatniego nie da się zamknąć — aplikacja bez projektu
 * nie ma co pokazać. Po zamknięciu aktywnego przechodzimy na sąsiada z lewej.
 */
export function removeDesk(state: DesksState, id: string): DesksState {
  if (state.desks.length <= 1) {
    return state;
  }
  const index = state.desks.findIndex((desk) => desk.id === id);
  if (index === -1) {
    return state;
  }
  const desks = state.desks.filter((desk) => desk.id !== id);
  if (state.activeId !== id) {
    return { desks, activeId: state.activeId };
  }
  const nextIndex = Math.max(0, index - 1);
  return { desks, activeId: desks[nextIndex]?.id ?? desks[0]?.id ?? '' };
}

export function activeDesk(state: DesksState): Desk | null {
  return state.desks.find((desk) => desk.id === state.activeId) ?? state.desks[0] ?? null;
}

/** Biurko pod numerem (Cmd+1…9); null, gdy tyle biurek nie ma. */
export function deskAt(state: DesksState, position: number): Desk | null {
  return state.desks[position - 1] ?? null;
}

/** Następne/poprzednie biurko w cyklu — bez wypadania poza listę. */
export function cycleDesk(state: DesksState, direction: 1 | -1): string {
  const index = state.desks.findIndex((desk) => desk.id === state.activeId);
  if (index === -1 || state.desks.length === 0) {
    return state.activeId;
  }
  const next = (index + direction + state.desks.length) % state.desks.length;
  return state.desks[next]?.id ?? state.activeId;
}

/** Odtworzenie stanu z zapisu; odsiewa ścieżki puste i duplikaty. */
export function restoreDesks(roots: readonly string[], activeRoot: string | null): DesksState | null {
  const desks: Desk[] = [];
  for (const raw of roots) {
    const path = normalizeRoot(raw);
    if (path === '' || desks.some((desk) => desk.root === path)) {
      continue;
    }
    desks.push({ id: makeDeskId(path, desks), root: path });
  }
  if (desks.length === 0) {
    return null;
  }
  const active = desks.find((desk) => desk.root === normalizeRoot(activeRoot ?? '')) ?? desks[0];
  return { desks, activeId: active?.id ?? desks[0]!.id };
}
