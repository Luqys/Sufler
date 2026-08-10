import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // Moduł natywny — ładowany w runtime z node_modules, nie bundlowany.
        external: ['node-pty'],
      },
    },
  },
  preload: {},
  renderer: {
    plugins: [react()],
  },
});
