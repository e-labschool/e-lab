// Shared "fetch every page until a short page is returned" helper — the
// ONE pagination implementation every bulk reader in the Backup/Disaster
// Recovery system is built on, so there is never a second,
// independently-written loop that can silently diverge from this one.
//
// Originally this exact loop (range-advance, push, stop-on-short-page)
// was implemented twice: once in exportContent.js's fetchAllRows() for
// `.from(table)...range()` reads, and a SECOND time — incorrectly, as a
// single unpaginated call — in disasterExport.js's readViaRpc() for the
// two bulk `SETOF`-returning admin RPCs (admin_export_question_secrets /
// admin_export_question_version_secrets). PostgREST applies the exact
// same `Range`/`Range-Unit` header handling to a `returns setof ...`
// RPC call that it does to a plain table route, so `.range(from, to)`
// works identically on `supabase.rpc(name)` as it does on
// `supabase.from(table)` — this helper is deliberately agnostic to which
// one `fetchPage` wraps.
//
// 2026-10 fix: this file is now the single shared implementation. Both
// fetchAllRows() and readViaRpc() call it — see their own headers.
export async function fetchAllPages(fetchPage, { pageSize, onProgress, label } = {}) {
  if (!pageSize || pageSize <= 0) throw new Error("fetchAllPages requires a positive pageSize.");
  const rows = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    // A failure on ANY page — including a page after the first —
    // propagates here immediately. `rows` (whatever was accumulated from
    // earlier pages) is simply discarded along with the stack unwind:
    // there is no code path that returns a partial result as if it were
    // the complete set. Callers that want a dataset's failure to be
    // recorded (not fatal to the whole backup run) are responsible for
    // catching this themselves (see datasetFetch.js) — this helper never
    // makes that decision on their behalf.
    const data = await fetchPage(from, to);
    const page = data ?? [];
    rows.push(...page);
    onProgress?.(`Reading ${label}… (${rows.length})`);
    if (page.length < pageSize) break; // short (or empty) page => exhausted
    from += pageSize;
  }
  return rows;
}
