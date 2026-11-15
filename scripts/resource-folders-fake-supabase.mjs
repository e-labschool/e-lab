// Test-only in-memory stand-in for the slice of supabase-js that resourceService.js and
// folderService.js use.  Models the DB rules the folders SQL draft enforces that the app
// relies on: unique (parent, audience, name), RESTRICT on delete (children / resources),
// and the "table/column does not exist" errors seen BEFORE the migration is applied.
// It is NOT Supabase: no RLS, no PostgREST, no storage.
let counter = 0;
const uid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

export function createFakeSupabase({ folders = [], resources = [], foldersTableMissing = false, folderIdColumnMissing = false, foldersError = null, user = { id: "admin-1" } } = {}) {
  const db = { resource_folders: folders.map((r) => ({ ...r })), resources: resources.map((r) => ({ ...r })) };
  const log = [];
  const missingTable = { code: "PGRST205", message: "Could not find the table 'public.resource_folders' in the schema cache" };
  const missingColumn = { code: "PGRST204", message: "Could not find the 'folder_id' column of 'resources' in the schema cache" };

  function run(q) {
    log.push({ table: q.table, op: q.op, filters: q.filters, payload: q.payload });
    if (q.table === "resource_folders") {
      if (foldersTableMissing) return { data: null, error: missingTable };
      if (foldersError) return { data: null, error: foldersError };
    }
    if (q.table === "resources" && folderIdColumnMissing && q.payload && "folder_id" in (Array.isArray(q.payload) ? q.payload[0] : q.payload)) return { data: null, error: missingColumn };
    const rows = db[q.table];
    const match = (r) => q.filters.every(([c, v]) => r[c] === v);
    if (q.op === "select") {
      let out = rows.filter(match).map((r) => ({ ...r }));
      if (q.order) out.sort((a, b) => (a[q.order.col] > b[q.order.col] ? 1 : -1) * (q.order.asc ? 1 : -1));
      return { data: out, error: null };
    }
    if (q.op === "insert") {
      const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((p) => ({ id: uid(), created_at: "2026-11-15T00:00:00Z", updated_at: "2026-11-15T00:00:00Z", ...p }));
      if (q.table === "resource_folders") {
        for (const n of list) {
          if (db.resource_folders.some((r) => (r.parent_id ?? null) === (n.parent_id ?? null) && r.audience === n.audience && r.name.toLowerCase() === n.name.toLowerCase())) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }
      }
      rows.push(...list);
      return { data: list.map((r) => ({ ...r })), error: null };
    }
    if (q.op === "update") {
      const hit = rows.filter(match);
      hit.forEach((r) => Object.assign(r, q.payload));
      return { data: hit.map((r) => ({ ...r })), error: null };
    }
    if (q.op === "delete") {
      const hit = rows.filter(match);
      if (q.table === "resource_folders") {
        for (const r of hit) {
          if (db.resource_folders.some((c) => c.parent_id === r.id) || db.resources.some((x) => x.folder_id === r.id)) return { data: null, error: { code: "23503", message: "violates foreign key constraint" } };
        }
      }
      db[q.table] = rows.filter((r) => !hit.includes(r));
      return { data: hit, error: null };
    }
    return { data: null, error: { message: `unsupported op ${q.op}` } };
  }

  function builder(table) {
    const q = { table, op: "select", filters: [], payload: null, order: null, single: false };
    const b = {
      select() { return b; }, // after insert/update: returns the written rows
      insert(p) { q.op = "insert"; q.payload = p; return b; },
      update(p) { q.op = "update"; q.payload = p; return b; },
      delete() { q.op = "delete"; return b; },
      eq(c, v) { q.filters.push([c, v]); return b; },
      order(col, o = {}) { q.order = { col, asc: o.ascending !== false }; return b; },
      single() { q.single = true; return b; },
      then(res, rej) {
        let out = run(q);
        if (q.single && !out.error) out = out.data?.length ? { data: out.data[0], error: null } : { data: null, error: { message: "no rows" } };
        return Promise.resolve(out).then(res, rej);
      },
    };
    return b;
  }

  return {
    db, log,
    from: (t) => builder(t),
    auth: { getUser: async () => ({ data: { user } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    storage: { from: () => ({ createSignedUrl: async (p, ttl, opts) => { (globalThis.__rfSigned ??= []).push({ path: p, ttl, opts }); return { data: { signedUrl: `https://signed.example/${p}${opts?.download ? `?download=${encodeURIComponent(opts.download)}` : ""}` }, error: null }; }, upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  };
}
