import { useSyncExternalStore } from 'react';
import type { DiagnosticsResult } from '../../shared/editor/diagnostics';

/**
 * Stan diagnostyki poza komponentem (M95). Wcześniej siedział w pasku pod
 * edytorem, więc wynik znał tylko ten pasek. Teraz wynik dzielą trzy miejsca:
 * przycisk w pasku tytułu (uruchamia i pokazuje ciężkość), karta „Problemy"
 * w obszarze edytora i automat po zapisie (M90).
 *
 * Zwykły sklep z subskrypcją — bez biblioteki, tak samo jak `sidebar-view`.
 */

export interface DiagnosticsState {
  result: DiagnosticsResult | null;
  running: boolean;
  /** Rośnie po każdym zakończonym przebiegu — animacja „zrobione" na przycisku. */
  finishedTick: number;
  /** Czas zakończenia ostatniego przebiegu; 0 = jeszcze żadnego. */
  lastFinishedMs: number;
  /** Korzeń, dla którego policzono wynik — zmiana projektu unieważnia. */
  root: string;
}

let stan: DiagnosticsState = {
  result: null,
  running: false,
  finishedTick: 0,
  lastFinishedMs: 0,
  root: '',
};

const sluchacze = new Set<() => void>();

function ustaw(zmiana: Partial<DiagnosticsState>): void {
  stan = { ...stan, ...zmiana };
  for (const sluchacz of sluchacze) {
    sluchacz();
  }
}

function subscribe(listener: () => void): () => void {
  sluchacze.add(listener);
  return () => {
    sluchacze.delete(listener);
  };
}

export function getDiagnostics(): DiagnosticsState {
  return stan;
}

export function useDiagnostics(): DiagnosticsState {
  return useSyncExternalStore(subscribe, getDiagnostics, getDiagnostics);
}

/** Zmiana projektu: stary wynik dotyczy cudzych plików i musi zniknąć. */
export function resetDiagnostics(root: string): void {
  if (stan.root !== root) {
    ustaw({ result: null, running: false, lastFinishedMs: 0, root });
  }
}

/**
 * Uruchomienie przebiegu. Drugie wywołanie w trakcie trwania jest pomijane —
 * wynik i tak będzie świeży, a dwa równoległe `tsc` tylko zabrałyby procesor.
 */
export function startDiagnostics(root: string): void {
  if (stan.running) {
    return;
  }
  ustaw({ running: true, root });
  void window.api.runDiagnostics(root).then((wynik) => {
    if (stan.root !== root) {
      return; // projekt zmieniony w trakcie — wynik jest już nieaktualny
    }
    ustaw({
      running: false,
      result: wynik,
      lastFinishedMs: Date.now(),
      finishedTick: stan.finishedTick + 1,
    });
  });
}
