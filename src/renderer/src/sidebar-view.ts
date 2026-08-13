import { useSyncExternalStore } from 'react';

/**
 * Aktywny widok paska bocznego trzymany poza komponentem, bo od M74 zmienia
 * go nie tylko klik w ikonę, ale też paleta komend. Side effecty (np. graf
 * wiedzy w obszarze edytora) zostają po stronie wywołującego — sklep pilnuje
 * wyłącznie tego, który panel jest widoczny.
 */

export type SidebarView = 'files' | 'search' | 'git' | 'sessions' | 'knowledge' | 'skills' | 'mcp';

let current: SidebarView = 'files';
const listeners = new Set<() => void>();

export function getSidebarView(): SidebarView {
  return current;
}

export function selectSidebarView(view: SidebarView): void {
  if (view === current) {
    return;
  }
  current = view;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSidebarView(): SidebarView {
  return useSyncExternalStore(subscribe, getSidebarView, getSidebarView);
}
