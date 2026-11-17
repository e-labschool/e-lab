// Temporary private build config (Round 2): stubs the mixture-separation entry while another agent rebuilds it. Deleted before the final report.
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import fs from 'node:fs'
const stub = { name: 'r2-stub-missing', enforce: 'pre', resolveId(id, importer) { if (importer && importer.includes('mixture-separation-explorer') && id.endsWith('.css') && !fs.existsSync(new URL(id, 'file://' + importer))) return '\0r2css';  if (id.includes('mixture-separation-explorer/MixtureSeparationExplorer.jsx') && !fs.existsSync(new URL('./src/engines/mixture-separation-explorer/MixtureSeparationExplorer.jsx', import.meta.url))) return '\0r2stub'; return null; }, load(id) { if (id === '\0r2css') return '';  if (id === '\0r2stub') return 'export default function Stub(){return null}'; return null; } }
export default defineConfig({ plugins: [stub, react(), tailwindcss()] })
