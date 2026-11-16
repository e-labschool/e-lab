// Readings table model: pure (no React, no DOM) so it is unit-tested in Node (scripts/test-readings.mjs).
// A "reading" is one row of numbers a student recorded from a simulation. Columns describe name, unit and decimals;
// `values` always keeps full precision (the table only rounds for display; CSV writes the displayed precision + the
// real value is never altered).

export const MAX_READINGS = 60;

/** column = { key, label, unit, decimals, symbol?, scale? }
 *  Rows store RAW values (the engine's internal units). `scale` (default 1) converts a raw value to the column's DISPLAY unit
 *  (for example kPa -> atm), so switching the unit setting re-labels the whole table, graph and CSV without touching the data. */
export const shown = (c, raw) => (Number.isFinite(raw) ? raw * (c.scale ?? 1) : NaN);
export function createReadings() { return { rows: [], nextId: 1 }; }

const same = (a, b, cols) => cols.every((c) => Math.abs((a[c.key] ?? NaN) - (b[c.key] ?? NaN)) <= 1e-9 * Math.max(1, Math.abs(a[c.key] ?? 0)));

/** Add a reading. Returns { state, ok, reason } -- never throws, never mutates.
 *  reason: "full" | "duplicate" | "invalid". A repeat of the previous row is refused (it would add no information
 *  and clutters a graph); the UI says why. */
export function addReading(state, values, columns) {
  if (!values || columns.some((c) => !Number.isFinite(values[c.key]))) return { state, ok: false, reason: "invalid" };
  if (state.rows.length >= MAX_READINGS) return { state, ok: false, reason: "full" };
  const last = state.rows[state.rows.length - 1];
  if (last && same(last.values, values, columns)) return { state, ok: false, reason: "duplicate" };
  const row = { id: state.nextId, values: { ...values } };
  return { state: { rows: [...state.rows, row], nextId: state.nextId + 1 }, ok: true, reason: null };
}
export function removeReading(state, id) { return { ...state, rows: state.rows.filter((r) => r.id !== id) }; }
export function clearReadings(state) { return { rows: [], nextId: 1 }; }

export const REASON_TEXT = Object.freeze({
  full: `The table is full (${MAX_READINGS} readings). Delete some rows or clear the table first.`,
  duplicate: "That is the same as the last reading. Change a variable first, then record again.",
  invalid: "That reading has a missing or invalid number, so it was not recorded.",
});

const fmt = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : "");
export const headerOf = (c) => (c.unit ? `${c.label} (${c.unit})` : c.label);

function csvCell(s) {
  const t = String(s);
  return /[",\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
}

/** CSV text (RFC 4180, CRLF). Header row has units. `meta` lines (strings) go first as "# ..." comment rows, which
 *  spreadsheet programs show as text; they hold the simulation name, the unit system and the constants used.
 *  Values are written at their DISPLAY precision plus nothing else: no hidden digits. */
export function toCSV(columns, rows, meta = []) {
  const lines = [];
  for (const m of meta) lines.push(csvCell(`# ${m}`));
  lines.push(["Reading", ...columns.map(headerOf)].map(csvCell).join(","));
  rows.forEach((r, i) => { lines.push([i + 1, ...columns.map((c) => fmt(shown(c, r.values[c.key]), c.decimals ?? 3))].map(csvCell).join(",")); });
  return lines.join("\r\n") + "\r\n";
}

/** Least-squares line y = slope x + intercept; null with < 2 points or no spread in x. */
export function linearFit(points) {
  const p = points.filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
  const n = p.length;
  if (n < 2) return null;
  const mx = p.reduce((s, q) => s + q.x, 0) / n;
  const my = p.reduce((s, q) => s + q.y, 0) / n;
  let sxx = 0; let sxy = 0; let syy = 0;
  for (const q of p) { sxx += (q.x - mx) ** 2; sxy += (q.x - mx) * (q.y - my); syy += (q.y - my) ** 2; }
  if (sxx <= 1e-300) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy <= 1e-300 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}

/** Nice axis scale {min, max, ticks}. */
export function niceScale(lo, hi, target = 5) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (!(hi > lo)) { const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.1 : 1; lo -= pad; hi += pad; }
  const raw = (hi - lo) / Math.max(1, target - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1.5 ? 1 : f <= 3.2 ? 2 : f <= 7 ? 5 : 10) * mag;
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let t = min; t <= max + step * 1e-6; t += step) ticks.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toPrecision(12)));
  return { min, max, ticks };
}

/** Everything the plot needs. points: [{id,x,y}] from the rows (columns xKey / yKey); theory: optional [{x,y}] polyline.
 *  includeOrigin forces 0 into both ranges (for direct proportion). */
export function buildPlot(rows, xKey, yKey, { theory = null, includeOrigin = false, fit = false, columns = [] } = {}) {
  const sc = (k) => columns.find((c) => c.key === k)?.scale ?? 1;
  const points = rows.map((r) => ({ id: r.id, x: r.values[xKey] * sc(xKey), y: r.values[yKey] * sc(yKey) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xs = points.map((p) => p.x).concat(theory ? theory.map((p) => p.x) : []);
  const ys = points.map((p) => p.y).concat(theory ? theory.map((p) => p.y) : []);
  let xlo = xs.length ? Math.min(...xs) : 0; let xhi = xs.length ? Math.max(...xs) : 1;
  let ylo = ys.length ? Math.min(...ys) : 0; let yhi = ys.length ? Math.max(...ys) : 1;
  if (includeOrigin) { xlo = Math.min(xlo, 0); ylo = Math.min(ylo, 0); xhi = Math.max(xhi, 0); yhi = Math.max(yhi, 0); }
  const xr = niceScale(xlo, xhi); const yr = niceScale(ylo, yhi);
  const line = fit ? linearFit(points) : null;
  return { points, xRange: [xr.min, xr.max], yRange: [yr.min, yr.max], xTicks: xr.ticks, yTicks: yr.ticks, fit: line, theory };
}

/** True when the table has enough distinct points to draw a meaningful best-fit line. */
export const canFit = (points) => linearFit(points) !== null && points.length >= 3;

/** Safe file name stem: letters, digits, dash. */
export function fileStem(...parts) {
  const s = parts.filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "readings";
}
