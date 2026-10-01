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
// `supabase` client — by default every table read returns zero rows and
// every RPC returns empty data (just enough surface for the REAL,
// UNMODIFIED createDisasterBackup() to run its full pipeline end-to-end
// in Node). Every other specifier resolves normally, so the rest of the
// real disasterExport.js / exportContent.js / datasetFetch.js / etc.
// module graph is exercised unmodified.
//
// 2026-10 PAGINATION REGRESSION TESTS (section 15 in
// test-disaster-recovery.mjs) need this mock to ACTUALLY implement
// range-based pagination semantics — a mock that just returns every row
// regardless of the requested range would not prove the real pagination
// loop in readViaRpc()/fetchAllRows() works, it would just prove the
// mock itself doesn't truncate. So both `.from(table)` and `.rpc(name)`
// below honor `.range(from, to)` and slice a configurable dataset to
// EXACTLY that window, and `.rpc(name)` can be configured to return an
// error on a specific page (by `from` offset) to prove a later-page RPC
// failure propagates as a real failure rather than silently returning
// the rows collected so far.
//
// Configuration lives on `globalThis.__elabTestMock` (set by the test
// file immediately before each `createDisasterBackup()` call, and reset
// after) rather than as module state, because this source string is
// loaded as its own isolated virtual module by the loader hook — using
// the shared process-wide `globalThis` is the only way the test file and
// this virtual module can agree on what data to serve for a given run.
//   globalThis.__elabTestMock = {
//     tables: { [tableName]: rows[] },           // `.from(table)` reads
//     rpcs: { [rpcName]: { rows: [], errorOnFrom: <offset>|undefined,
//                           errorMessage: "..." } },
//   }
// Any table/rpc not present in the config behaves exactly like the old
// unconditional "returns zero rows" default.
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
      // Builder that actually RESPECTS .range(from, to) against a
      // configurable, mutable backing dataset (read fresh from
      // globalThis.__elabTestMock on every resolution, not captured at
      // builder-creation time, so a test can reconfigure data between
      // calls within the same run if it ever needs to).
      function rangeable(getPage) {
        let rangeArgs = null;
        const builder = {
          select: () => builder,
          order: () => builder,
          eq: () => builder,
          in: () => builder,
          limit: () => builder,
          range: (from, to) => { rangeArgs = [from, to]; return builder; },
          then: (resolve, reject) =>
            Promise.resolve()
              .then(() => getPage(rangeArgs))
              .then(resolve, reject),
        };
        return builder;
      }

      // Every page request (table or RPC) is logged to
      // globalThis.__elabTestMock.calls so a test can assert exactly how
      // many pages were requested and with what range, proving the real
      // pagination loop actually iterated rather than merely returning
      // whatever a single call happened to produce.
      function logCall(kind, name, rangeArgs) {
        const cfg = globalThis.__elabTestMock;
        if (!cfg) return;
        cfg.calls = cfg.calls || { table: {}, rpc: {} };
        const bucket = cfg.calls[kind];
        bucket[name] = bucket[name] || [];
        bucket[name].push(rangeArgs ? [rangeArgs[0], rangeArgs[1]] : null);
      }

      function tablePage(table, rangeArgs) {
        logCall("table", table, rangeArgs);
        const cfg = globalThis.__elabTestMock;
        const rows = cfg?.tables?.[table] || [];
        if (!rangeArgs) return { data: rows, error: null };
        const [from, to] = rangeArgs;
        return { data: rows.slice(from, to + 1), error: null };
      }

      function rpcPage(name, rangeArgs) {
        logCall("rpc", name, rangeArgs);
        const cfg = globalThis.__elabTestMock;
        const rpcCfg = cfg?.rpcs?.[name];
        if (!rpcCfg) return { data: [], error: null };
        const from = rangeArgs ? rangeArgs[0] : 0;
        const to = rangeArgs ? rangeArgs[1] : (rpcCfg.rows || []).length - 1;
        if (typeof rpcCfg.errorOnFrom === "number" && from === rpcCfg.errorOnFrom) {
          return { data: null, error: { message: rpcCfg.errorMessage || \`simulated RPC error on page starting at \${from}\` } };
        }
        const rows = rpcCfg.rows || [];
        return { data: rows.slice(from, to + 1), error: null };
      }

      export const isSupabaseConfigured = true;
      export const supabase = {
        supabaseUrl: "mock://disaster-recovery-regression-test",
        from: (table) => rangeable((rangeArgs) => tablePage(table, rangeArgs)),
        rpc: (name, _args) => rangeable((rangeArgs) => rpcPage(name, rangeArgs)),
        storage: {
          from: (_bucket) => ({
            download: () => Promise.resolve({ data: null, error: { message: "not exercised: no media referenced by the mock dataset" } }),
          }),
        },
      };
    `;
    return { format: "module", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
