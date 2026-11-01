// Test-only stand-in for src/lib/supabaseClient.js, swapped in by
// scripts/harness/vite.harness.config.js. NEVER imported by the real app.
// It is an in-memory (localStorage-backed, so reload round-trips work)
// table store with the subset of the supabase-js query builder the Learn
// and admin Learn editor use, plus a controllable auth emitter
// (window.__mockAuth) so tests can fire SIGNED_IN / TOKEN_REFRESHED the
// way supabase-js does when a tab becomes visible again.
export const isSupabaseConfigured = true;

const DB_KEY = "mock-supabase-db-v1";
const para = (i) => `<p>Paragraph ${i}. Atoms combine through electrostatic attraction between nuclei and shared or transferred electrons, and the arrangement of electron domains determines molecular geometry. Select some words here to format.</p><p>Second paragraph of block ${i} with H<sub>2</sub>O and a marker ⟦math:x^2⟧ to check scientific rendering.</p>`;

function seed() {
  const blocks = [];
  for (let i = 1; i <= 14; i += 1) {
    blocks.push({ id: `b${i}`, page_id: "lesson-long", block_type: "rich_text", position: i - 1, visible: true, content: { title: `Section ${i}`, titleColor: "#3654D6", html: para(i), audience: "both" } });
  }
  blocks.push({ id: "bsim", page_id: "lesson-long", block_type: "simulation", position: 14, visible: true, content: { simulationId: "ideal-gas-simulation", audience: "both" } });
  blocks.push({ id: "bend", page_id: "lesson-long", block_type: "rich_text", position: 15, visible: true, content: { title: "After the simulation", html: "<p>End of lesson.</p>", audience: "both" } });
  return {
    learn_pages: [
      { id: "lesson-long", parent_topic: "S2.1", lesson_code: "S2.1.1", syllabus_codes: ["S2.1.1"], title: "Long Lesson", level: "SL/HL", status: "published", display_order: 1, display_order_sl: 1, display_order_hl: 1, updated_at: "2026-01-01T00:00:00Z" },
    ],
    learn_blocks: blocks,
    profiles: [
      { id: "u-student", role: "student", status: "active", level: "HL", full_name: "Test Student", email: "s@example.com" },
      { id: "u-admin", role: "admin", status: "active", level: "HL", full_name: "Test Admin", email: "a@example.com" },
    ],
  };
}

function loadDb() {
  try { const raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return seed();
}
let db = loadDb();
function persist() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* ignore */ } }
window.__mockDb = { get: () => db, reset: () => { db = seed(); persist(); }, persist };
window.__mockCalls = { select: {}, update: 0 };

const roleKey = () => { try { return localStorage.getItem("mock-role") || "student"; } catch { return "student"; } };
const userId = () => (roleKey() === "admin" ? "u-admin" : "u-student");
function makeSession() {
  const id = userId();
  return { access_token: `tok-${Math.random()}`, refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: `${id}@example.com`, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } };
}

const listeners = new Set();
window.__mockAuth = {
  emit(event) { const s = makeSession(); for (const cb of [...listeners]) cb(event, s); },
  count: () => listeners.size,
};

let uid = 0;
class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = "select"; this.payload = null; this.orders = []; this.lim = null; this.mode = "many"; }
  select() { return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
  in(c, vs) { this.filters.push((r) => vs.includes(r[c])); return this; }
  ilike(c, v) { this.filters.push((r) => String(r[c]).toLowerCase() === String(v).toLowerCase()); return this; }
  contains(c, vs) { this.filters.push((r) => Array.isArray(r[c]) && vs.every((x) => r[c].includes(x))); return this; }
  order(c, o = {}) { this.orders.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  insert(p) { this.op = "insert"; this.payload = p; return this; }
  update(p) { this.op = "update"; this.payload = p; return this; }
  upsert(p) { this.op = "insert"; this.payload = p; return this; }
  delete() { this.op = "delete"; return this; }
  async run() {
    const ms = window.__mockLatency ?? 40;
    if (ms) await new Promise((r) => setTimeout(r, ms));
    const rows = (db[this.table] = db[this.table] || []);
    const match = (r) => this.filters.every((f) => f(r));
    let out;
    if (this.op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p) => ({ id: p.id || `m${++uid}-${Date.now()}`, ...p }));
      rows.push(...items); persist(); out = items;
    } else if (this.op === "update") {
      window.__mockCalls.update += 1;
      out = rows.filter(match); out.forEach((r) => Object.assign(r, this.payload, { updated_at: new Date().toISOString() })); persist();
    } else if (this.op === "delete") {
      out = rows.filter(match); db[this.table] = rows.filter((r) => !match(r)); persist();
    } else {
      window.__mockCalls.select[this.table] = (window.__mockCalls.select[this.table] || 0) + 1;
      out = rows.filter(match);
      for (const [c, asc] of [...this.orders].reverse()) out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      if (this.lim != null) out = out.slice(0, this.lim);
    }
    out = JSON.parse(JSON.stringify(out));
    if (this.mode === "single") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: "Row not found", code: "PGRST116" } };
    if (this.mode === "maybe") return { data: out[0] ?? null, error: null };
    return { data: out, error: null };
  }
  then(res, rej) { return this.run().then(res, rej); }
}

export const supabase = {
  auth: {
    async getSession() { return { data: { session: makeSession() }, error: null }; },
    async getUser() { return { data: { user: makeSession().user }, error: null }; },
    onAuthStateChange(cb) { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
    async signOut() { return { error: null }; },
  },
  from: (table) => new Query(table),
  rpc: async (name) => (name === "get_learn_check_items" ? { data: [], error: null } : { data: null, error: { message: `rpc ${name} not mocked` } }),
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
};
