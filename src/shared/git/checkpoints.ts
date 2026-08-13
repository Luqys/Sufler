/**
 * Punkty przywracania (M55): przed każdą turą pracy Claude aplikacja
 * zapisuje migawkę drzewa roboczego w osobnym refie gita. Migawka nie
 * rusza HEAD, indeksu ani gałęzi — jest wyłącznie siatką bezpieczeństwa,
 * gdy sesja pójdzie w złą stronę. Czysta logika — testowana jednostkowo.
 */

/** Ref, pod którym trzymamy łańcuch migawek (poza refs/heads). */
export const CHECKPOINT_REF = 'refs/sufler/checkpoints';

export interface Checkpoint {
  /** Pełny hash commita migawki. */
  hash: string;
  shortHash: string;
  /** ISO czasu utworzenia. */
  date: string;
  /** Opis: pierwsze słowa polecenia, które ją wywołało. */
  label: string;
  /** Liczba plików różniących się od poprzedniej migawki (−1 = nieznana). */
  changedFiles: number;
}

/** Temat commita migawki — z niego odczytujemy etykietę przy listowaniu. */
export function checkpointSubject(label: string): string {
  const clean = label.replace(/\s+/g, ' ').trim();
  const short = clean.length > 72 ? `${clean.slice(0, 71)}…` : clean;
  return `sufler-checkpoint: ${short === '' ? 'przed pracą Claude' : short}`;
}

/** Etykieta z tematu commita; null gdy to nie jest nasza migawka. */
export function labelFromSubject(subject: string): string | null {
  const match = /^sufler-checkpoint: (.*)$/.exec(subject.trim());
  return match?.[1] ?? null;
}

/** Wynik `git log` migawek (format hash\x1fISO\x1fsubject) → lista. */
export function parseCheckpointLog(stdout: string): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') {
      continue;
    }
    const [hash, date, subject] = line.split('\x1f');
    const label = labelFromSubject(subject ?? '');
    if (!hash || !date || label === null) {
      continue;
    }
    checkpoints.push({
      hash,
      shortHash: hash.slice(0, 7),
      date,
      label,
      changedFiles: -1,
    });
  }
  return checkpoints;
}
