import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// WARNING: React throws this error as a warning. It can be safely ignored.
// @see https://github.com/vitejs/vite/issues/16405
// https://github.com/RJ/tachyon/issues/10

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
