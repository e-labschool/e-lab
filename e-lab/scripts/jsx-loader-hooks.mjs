// Node module customization hook shared by this project's Node-level
// regression scripts (scripts/test-scientific-rendering.mjs and any
// future script that needs to `import()` a REAL .jsx source module under
// plain Node, the same way test-disaster-recovery-loader-hooks.mjs
// already does for a virtual module specifier).
//
// Why this exists: Node has no built-in JSX support, and this project's
// shared rendering pipeline (src/lib/scientificContent.jsx) is a .jsx
// file — its pure, dependency-free functions (renderCompactLatex,
// renderScientificMarkup/renderMathMarkersInHtml, renderScientificText,
// containsScientificMarkup) are exactly what a Node-level regression
// suite should exercise directly (the REAL production module, never a
// reimplementation), but the file can't even be parsed by Node without
// first stripping the one JSX expression it contains (the ScientificText
// component). Vite itself (already a project devDependency, see
// package.json) ships `transformWithOxc`, a dependency-free JSX/TS
// stripping transform — reused here instead of adding a brand-new
// dependency (esbuild/babel/swc) just for this test harness.
//
// Scope: only intercepts files whose URL ends in ".jsx" so every other
// import in the module graph (plain .js) loads completely unmodified.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// A couple of admin-side modules in learnBlockRegistry.jsx's import graph
// (LearnMediaInput.jsx, learn-tree.js) ultimately import
// src/lib/supabaseClient.js, which reads `import.meta.env.VITE_SUPABASE_*`
// -- a Vite-only feature undefined under plain Node (same root cause
// documented in test-disaster-recovery-loader-hooks.mjs). None of the
// RichTextEditor selection-preservation logic under test here calls
// Supabase at all, so this is a pure "make the module graph importable
// under Node" shim, not a mock of anything being tested.
const SUPABASE_MOCK_SPECIFIER = "elab-test:mock-supabase-client-for-rte";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("supabaseClient.js")) {
    return { url: SUPABASE_MOCK_SPECIFIER, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === SUPABASE_MOCK_SPECIFIER) {
    const source = `
      export const isSupabaseConfigured = false;
      export const supabase = {
        from: () => ({ select: () => ({ data: [], error: null }) }),
        storage: { from: () => ({}) },
      };
    `;
    return { format: "module", source, shortCircuit: true };
  }
  if (url.endsWith(".jsx")) {
    const { transformWithOxc } = await import("vite");
    const source = await readFile(fileURLToPath(url), "utf8");
    const result = await transformWithOxc(source, fileURLToPath(url), { jsx: { runtime: "automatic" } });
    return { format: "module", source: result.code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
