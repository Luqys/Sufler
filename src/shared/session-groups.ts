/**
 * Porządkowanie listy sesji (M80). Przy pięćdziesięciu rozmowach płaska lista
 * „12 min temu / 2 godz. temu / 11 godz. temu" nie mówi nic — nie da się
 * wrócić do wczorajszej pracy ani znaleźć rozmowy po temacie.
 *
 * Czysta logika: podział na dni kalendarzowe i filtrowanie tekstem.
 */

export type SessionDayKind = 'today' | 'yesterday' | 'day';

export interface SessionGroup<T> {
  kind: SessionDayKind;
  /** Data lokalna YYYY-MM-DD — klucz i podstawa etykiety w rendererze. */
  dayIso: string;
  items: T[];
}

function localDayIso(ms: number): string {
  const date = new Date(ms);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Liczba dni kalendarzowych między dwiema chwilami, lokalnie. */
function dayDistance(fromMs: number, toMs: number): number {
  const start = new Date(fromMs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toMs);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Sesje pogrupowane po dniu ostatniej aktywności, od najnowszego dnia.
 * Kolejność wewnątrz grupy zostaje taka, jaka przyszła (lista jest już
 * posortowana malejąco po czasie).
 */
export function groupSessionsByDay<T extends { mtimeMs: number }>(
  sessions: readonly T[],
  nowMs: number,
): Array<SessionGroup<T>> {
  const groups: Array<SessionGroup<T>> = [];
  const byDay = new Map<string, SessionGroup<T>>();
  for (const session of sessions) {
    const dayIso = localDayIso(session.mtimeMs);
    let group = byDay.get(dayIso);
    if (!group) {
      const distance = dayDistance(session.mtimeMs, nowMs);
      const kind: SessionDayKind = distance === 0 ? 'today' : distance === 1 ? 'yesterday' : 'day';
      group = { kind, dayIso, items: [] };
      byDay.set(dayIso, group);
      groups.push(group);
    }
    group.items.push(session);
  }
  return groups;
}

/** Bez ogonków i wielkości liter — „gałąź" ma się znaleźć po wpisaniu „galaz". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();
}

export interface SearchableSession {
  title: string;
  branch: string;
}

/**
 * Sesje pasujące do frazy. Szukamy po etykiecie (to, co widać), po surowym
 * tytule (żeby wklejona ścieżka nadal była do znalezienia) i po gałęzi.
 * Pusta fraza zwraca wszystko.
 */
export function filterSessions<T extends SearchableSession>(
  sessions: readonly T[],
  query: string,
  label: (title: string) => string,
): T[] {
  const needle = normalize(query.trim());
  if (needle === '') {
    return [...sessions];
  }
  return sessions.filter((session) => {
    const haystack = normalize(`${label(session.title)} ${session.title} ${session.branch}`);
    return haystack.includes(needle);
  });
}

/**
 * Czas trwania rozmowy w milisekundach; 0, gdy transkrypt nie zna początku
 * albo dane są niespójne (mtime starszy od pierwszego wpisu).
 */
export function sessionDurationMs(session: { startedMs: number; mtimeMs: number }): number {
  if (session.startedMs <= 0 || session.mtimeMs <= session.startedMs) {
    return 0;
  }
  return session.mtimeMs - session.startedMs;
}

/** Sesja „żywa": ostatni wpis nie starszy niż dziesięć minut. */
export function isRecentSession(session: { mtimeMs: number }, nowMs: number): boolean {
  return nowMs - session.mtimeMs < 10 * 60_000;
}
