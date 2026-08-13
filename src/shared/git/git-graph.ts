/**
 * Tory gałęzi dla listy commitów (jak graf na GitHubie): każdemu commitowi
 * przypisujemy kolumnę, a kolumny „oczekujące" na rodziców ciągną pionowe
 * linie przez kolejne wiersze. Czysta logika — testowana jednostkowo.
 */

export interface CommitForLanes {
  hash: string;
  /** Hashe rodziców (pierwszy = kontynuacja gałęzi, kolejne = merge). */
  parents: string[];
}

export interface LaneRow {
  /** Kolumna kropki commita. */
  lane: number;
  /** Czego oczekiwały kolumny nad wierszem (null = pusta kolumna). */
  before: Array<string | null>;
  /** Czego oczekują kolumny pod wierszem. */
  after: Array<string | null>;
}

export function assignLanes(commits: CommitForLanes[]): LaneRow[] {
  const lanes: Array<string | null> = [];
  const rows: LaneRow[] = [];
  for (const commit of commits) {
    let lane = lanes.indexOf(commit.hash);
    if (lane === -1) {
      lane = lanes.indexOf(null);
      if (lane === -1) {
        lanes.push(null);
        lane = lanes.length - 1;
      }
    }
    const before = [...lanes];
    // Inne kolumny czekające na ten commit zwijają się do jego kropki (merge).
    for (let i = 0; i < lanes.length; i += 1) {
      if (lanes[i] === commit.hash) {
        lanes[i] = null;
      }
    }
    lanes[lane] = commit.parents[0] ?? null;
    for (const parent of commit.parents.slice(1)) {
      if (lanes.includes(parent)) {
        continue; // rodzic już śledzony w innej kolumnie
      }
      const slot = lanes.indexOf(null);
      if (slot === -1) {
        lanes.push(parent);
      } else {
        lanes[slot] = parent;
      }
    }
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
      lanes.pop();
    }
    rows.push({ lane, before, after: [...lanes] });
  }
  return rows;
}

/** Najszersza kolumna w całej historii — do stałej szerokości toru. */
export function maxLaneCount(rows: LaneRow[]): number {
  let max = 1;
  for (const row of rows) {
    max = Math.max(max, row.lane + 1, row.before.length, row.after.length);
  }
  return max;
}
