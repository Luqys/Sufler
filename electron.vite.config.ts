import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // node-pty: moduł natywny; agent-sdk: niesie własny plik CLI, którego
        // ścieżki wylicza względem siebie; ws: po zbundlowaniu gubi ramki
        // (opcjonalne natywne zależności) — wszystkie ładowane z node_modules.
        external: ['node-pty', '@anthropic-ai/claude-agent-sdk', 'ws'],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          // Preload gościa <webview> podglądu przeglądarki (picker elementów).
          webview: resolve(__dirname, 'src/preload/webview.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
});
