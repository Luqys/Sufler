import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // Moduł natywny — ładowany w runtime z node_modules, nie bundlowany.
        external: ['node-pty'],
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
