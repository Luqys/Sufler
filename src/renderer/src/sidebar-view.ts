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

/**
 * Panel gita rozpada się na trzy widoki (M102): zmiany robocze, historia
 * commitów i punkty przywracania z worktree'ami. Wcześniej wszystko trzy
 * leżało jedno pod drugim i przewijało się nawzajem poza ekran.
 */
export type GitTab = 'changes' | 'history' | 'points';

export const GIT_TABS: GitTab[] = ['changes', 'history', 'points'];

let currentGitTab: GitTab = 'changes';
const gitListeners = new Set<() => void>();

export function getGitTab(): GitTab {
  return currentGitTab;
}

export function selectGitTab(tab: GitTab): void {
  if (tab === currentGitTab) {
    return;
  }
  currentGitTab = tab;
  for (const listener of gitListeners) {
    listener();
  }
}

function subscribeGitTab(listener: () => void): () => void {
  gitListeners.add(listener);
  return () => {
    gitListeners.delete(listener);
  };
}

export function useGitTab(): GitTab {
  return useSyncExternalStore(subscribeGitTab, getGitTab, getGitTab);
}
