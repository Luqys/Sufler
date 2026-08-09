import type { LayoutState } from './layout';

export const IPC = {
  LayoutGet: 'layout:get',
  LayoutSet: 'layout:set',
} as const;

/** API udostępniane rendererowi przez contextBridge (window.api). */
export interface WindowApi {
  getLayout(): Promise<LayoutState>;
  setLayout(state: LayoutState): Promise<void>;
}
