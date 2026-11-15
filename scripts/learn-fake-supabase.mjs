// Test-only in-memory stand-in for the slice of supabase-js the Learn admin editor uses
// (learn_pages / learn_blocks / learn_check_questions / learn_manual_questions). NOT Supabase: no RLS, no PostgREST.
export function createLearnFake({ pages = [], blocks = [], user = { id: "admin-1" } } = {}) {
  const db = { learn_pages: pages.map((r) => ({ ...r })), learn_blocks: blocks.map((r) => ({ ...r, content: JSON.parse(JSON.stringify(r.content)) })), learn_check_questions: [], learn_manual_questions: [] };
  const log = [];
  let counter = 0;
  function run(q) {
    const rows = db[q.table];
    if (!rows) return { data: null, error: { message: `no table ${q.table}` } };
    const match = (r) => q.filters.every(([c, v]) => r[c] === v);
    if (q.op === "select") {
      const out = rows.filter(match).map((r) => JSON.parse(JSON.stringify(r)));
      if (q.order) out.sort((a, b) => ((a[q.order.col] > b[q.order.col]) - (a[q.order.col] < b[q.order.col])) * (q.order.asc ? 1 : -1));
      return { data: out, error: null };
    }
    log.push({ table: q.table, op: q.op, filters: q.filters, payload: q.payload });
    if (q.op === "insert") {
      const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((p) => ({ id: `new-${++counter}`, visible: true, created_at: "2026-11-15T00:00:00Z", ...JSON.parse(JSON.stringify(p)), ...(q.table === "learn_blocks" ? { page_id: p.page_id } : {}) }));
      rows.push(...list);
      return { data: list.map((r) => JSON.parse(JSON.stringify(r))), error: null };
    }
    if (q.op === "update") { const hit = rows.filter(match); hit.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(q.payload)))); return { data: hit.map((r) => JSON.parse(JSON.stringify(r))), error: null }; }
    if (q.op === "delete") { const hit = rows.filter(match); db[q.table] = rows.filter((r) => !hit.includes(r)); return { data: hit, error: null }; }
    return { data: null, error: { message: "unsupported" } };
  }
  function builder(table) {
    const q = { table, op: "select", filters: [], payload: null, order: null, single: false };
    const b = {
      select() { return b; }, insert(p) { q.op = "insert"; q.payload = p; return b; }, update(p) { q.op = "update"; q.payload = p; return b; }, delete() { q.op = "delete"; return b; },
      eq(c, v) { q.filters.push([c, v]); return b; }, order(col, o = {}) { q.order = { col, asc: o.ascending !== false }; return b; }, single() { q.single = true; return b; },
      then(res, rej) {
        let out = run(q);
        if (q.single && !out.error) out = out.data?.length ? { data: out.data[0], error: null } : { data: null, error: { message: "no rows" } };
        return Promise.resolve(out).then(res, rej);
      },
    };
    return b;
  }
  return {
    db, log, from: (t) => builder(t), rpc: async () => ({ data: [], error: null }),
    auth: { getUser: async () => ({ data: { user } }), getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "https://x/y.png" } }), remove: async () => ({ error: null }) }) },
  };
}
