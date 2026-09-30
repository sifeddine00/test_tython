import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Le proxy évite toute question de CORS pendant le développement :
    // le navigateur ne voit qu'une seule origine, celle de Vite.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // Les tests vivent dans la même config que le build pour ne pas dupliquer
    // l'alias `@`, qui diverge sinon silencieusement.
    //
    // happy-dom et non jsdom : ce dernier exige une dépendance ESM depuis son
    // build CommonJS, ce que Node 20.17 ne sait pas faire (`require()` d'un
    // module ESM n'est supporté qu'à partir de 20.19).
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Un test qui n'a pas fini est un test cassé, pas un test lent.
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});