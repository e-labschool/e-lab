// Standalone harness for the molecular NMR components (no dependency on the studio shell):
//   npx vite --config scripts/harness-nmr-molecular/vite.config.js   ->   http://127.0.0.1:5321/
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({ root: here, plugins: [react()], server: { port: 5321, strictPort: true, host: "127.0.0.1", fs: { allow: [path.resolve(here, "../..")] } }, build: { outDir: path.resolve(here, "../../.harness-dist"), emptyOutDir: true } });
