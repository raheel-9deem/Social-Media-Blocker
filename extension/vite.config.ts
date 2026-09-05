import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
// Chrome extension popups load from chrome-extension://ID/index.html
// so all asset paths must be relative (./) not absolute (/).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  // CRITICAL: relative paths so assets load inside chrome-extension:// context
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Output to dist/, then copy-to-extension.mjs merges into extension root
    outDir: 'dist',
    emptyOutDir: true,
  },
})
