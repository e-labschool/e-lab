// DRAFT -- NOT APPLIED. Proposed /vite.config.js (current file has only plugins). Same file is applied in the scratch copy and verified: 0 .map files.
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Explicit, so a future default change or env override cannot publish source maps. NOT confidentiality: minified JS stays retrievable.
    sourcemap: false,
  },
})
