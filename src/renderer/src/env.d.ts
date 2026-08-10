import type { WindowApi } from '../../shared/ipc';

declare global {
  interface Window {
    api: WindowApi;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      /** Gość podglądu przeglądarki (webviewTag: true w BrowserWindow). */
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { src?: string; preload?: string },
        HTMLElement
      >;
    }
  }
}

export {};
