// Node module hooks for scripts/test-auth-signup-confirmation.mjs: strips JSX
// from real .jsx sources (via Vite's transformWithOxc, like jsx-loader-hooks)
// and replaces src/lib/supabaseClient.js with a stub whose `supabase` object is
// read from globalThis.__authTestSupabase at call time, so each test can script
// supabase.auth.signUp / resend / signInWithPassword responses.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const MOCK = "elab-test:mock-supabase-client-for-auth-signup";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("supabaseClient.js")) return { url: MOCK, shortCircuit: true };
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === MOCK) {
    const source = `
      export const isSupabaseConfigured = true;
      const handler = { get: (_t, k) => globalThis.__authTestSupabase[k] };
      export const supabase = new Proxy({}, handler);
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
