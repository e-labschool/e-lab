// Node module hooks for the resource-folders tests: strips JSX from .jsx sources (Vite's
// transformWithOxc), replaces src/lib/supabaseClient.js with a Proxy to globalThis.__rfSupabase
// (set per test) and src/context/AuthContext.jsx with a tiny stub (useAuth reads globalThis.__rfAuth).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const MOCK_SB = "elab-test:rf-supabase";
const MOCK_AUTH = "elab-test:rf-auth";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("supabaseClient.js")) return { url: MOCK_SB, shortCircuit: true };
  if (specifier.endsWith("context/AuthContext.jsx")) return { url: MOCK_AUTH, shortCircuit: true };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === MOCK_SB) {
    return { format: "module", shortCircuit: true, source: `
      export const isSupabaseConfigured = true;
      export const supabase = new Proxy({}, { get: (_t, k) => globalThis.__rfSupabase?.[k] });` };
  }
  if (url === MOCK_AUTH) {
    return { format: "module", shortCircuit: true, source: `
      export const useAuth = () => globalThis.__rfAuth;
      export function AuthProvider({ children }) { return children; }` };
  }
  if (url.endsWith(".jsx")) {
    const { transformWithOxc } = await import("vite");
    const source = await readFile(fileURLToPath(url), "utf8");
    const result = await transformWithOxc(source, fileURLToPath(url), { jsx: { runtime: "automatic" } });
    return { format: "module", source: result.code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
