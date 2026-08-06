import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Mode Tauri : Vite sert le frontend sans backend Express.
      // Port fixe 3000 pour correspondre au devUrl de tauri.conf.json.
      // host "localhost" écoute IPv4+IPv6 (évite la webview Tauri qui
      // résout localhost en ::1 pendant que Vite n'écoute que 127.0.0.1)
      port: 3000,
      strictPort: true,
      host: "localhost",
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/test/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**', '**/tests-examples/**'],
    },
  };
});
