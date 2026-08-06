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
    build: {
      // Chunking manuel : React, xterm et Monaco en chunks séparés (cache
      // navigateur + parallélisme). Les vues sont déjà en lazy-load.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("xterm")) return "xterm";
              if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "monaco";
              if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) return "react";
              if (id.includes("lucide-react")) return "icons";
            }
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 700,
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
