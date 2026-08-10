/**
 * Rejestr propozycji openDiff z serwera „ide". CLI czeka (blokująco) na wynik
 * FILE_SAVED / DIFF_REJECTED — odpowiedź idzie kanałem ideBridgeRespond
 * dokładnie raz, niezależnie od tego, czy użytkownik kliknął przycisk,
 * zamknął zakładkę, czy CLI samo zamknęło diff narzędziem close_tab.
 */

export interface PendingIdeDiff {
  oldPath: string;
  newPath: string;
  /** Treść proponowana przez CLI; aktualizowana edycjami użytkownika w diffie. */
  newContents: string;
  tabName: string;
  responded: boolean;
}

const pending = new Map<number, PendingIdeDiff>();

export function registerPendingDiff(
  requestId: number,
  diff: Omit<PendingIdeDiff, 'responded'>,
): void {
  pending.set(requestId, { ...diff, responded: false });
}

export function getPendingDiff(requestId: number): PendingIdeDiff | null {
  return pending.get(requestId) ?? null;
}

/** Edycje strony „proponowanej" przeżywają przełączenie zakładki. */
export function updatePendingContents(requestId: number, contents: string): void {
  const diff = pending.get(requestId);
  if (diff) {
    diff.newContents = contents;
  }
}

export function resolvePendingDiff(requestId: number, status: 'saved' | 'rejected'): void {
  const diff = pending.get(requestId);
  if (diff && !diff.responded) {
    diff.responded = true;
    window.api.ideBridgeRespond(requestId, { status });
  }
}

export function removePendingDiff(requestId: number): void {
  pending.delete(requestId);
}
