// Node module customization hook used ONLY by
// scripts/test-disaster-recovery.mjs's section 14 regression test.
//
// disasterExport.js (and the modules it imports) pull in
// src/lib/supabaseClient.js, which reads `import.meta.env.VITE_SUPABASE_*`
// — a Vite-only feature that is simply undefined under plain Node, so
// `import()`-ing disasterExport.js directly throws immediately
// ("Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')")
// before a single line of its own logic runs. That is the exact reason
// this suite historically never imported disasterExport.js and instead
// re-implemented ("mirrored") its logic in synthetic test code — and
// why the mirrored tests could not catch a bug that only exists in the
// real module's source (see the regression test in section 14 and its
// HONESTY NOTE for the production/temporal-dead-zone bug this closes).
//
// This hook redirects ONLY the "../supabaseClient.js" specifier to an
// in-memory virtual module exporting a minimal, chainable mock
// `supabase` client (every table read returns zero rows, every RPC
// returns empty data) — just enough surface for the REAL, UNMODIFIED
// createDisasterBackup() to run its full pipeline end-to-end in Node.
// Every other specifier resolves normally, so the rest of the real
// disasterExport.js / exportContent.js / datasetFetch.js / etc. module
// graph is exercised unmodified.
const MOCK_SPECIFIER = "elab-test:mock-supabase-client";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("supabaseClient.js")) {
    return { url: MOCK_SPECIFIER, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === MOCK_SPECIFIER) {
    const source = `
      function chain(result) {
        const builder = {
          select: () => builder,
          order: () => builder,
          range: () => builder,
          eq: () => builder,
          in: () => builder,
          limit: () => builder,
          then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        };
        return builder;
      }
      export const isSupabaseConfigured = true;
      export const supabase = {
        supabaseUrl: "mock://disaster-recovery-regression-test",
        from: (_table) => chain({ data: [], error: null }),
        rpc: (_name, _args) => Promise.resolve({ data: [], error: null }),
        storage: {
          from: (_bucket) => ({
            download: () => Promise.resolve({ data: null, error: { message: "not exercised: no media referenced by the empty mock dataset" } }),
          }),
        },
      };
    `;
    return { format: "module", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
