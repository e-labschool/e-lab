// Review / reuse metadata for Learn lessons and blocks, stored INSIDE existing JSON (no migration, no new table).
//
//   block:  learn_blocks.content.meta = { codes?: string[], guide?: string, review?: { needs: true, note?: string, at?: ISO } , reviewedAt?: ISO }
//   lesson: a hidden block (block_type "lesson_meta", visible=false, never sent to students: RLS only serves visible
//           blocks of published pages) whose content is { meta: { guide, codes, needsReview, reviewedAt, note, derivedFrom } }.
//           learn_pages has no JSON column, so this is the only migration-free home for lesson-level fields.
// Pure module: no React, DOM or Supabase.

export const META_BLOCK_TYPE = "lesson_meta";
export const isMetaRow = (b) => b?.block_type === META_BLOCK_TYPE;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const iso = (v) => { const s = str(v, 40); return s && !Number.isNaN(Date.parse(s)) ? s : ""; };
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9.\-_/ ]{0,23}$/;
const uniq = (a) => [...new Set(a)];

export function normalizeCodes(v) {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;\n]/) : [];
  return uniq(list.map((c) => str(c, 24).toUpperCase()).filter((c) => c && CODE_RE.test(c))).slice(0, 30);
}

/** Lesson / block metadata, coerced from untrusted JSON. */
export function normalizeMeta(raw) {
  const r = isObj(raw) ? raw : {};
  const out = { codes: normalizeCodes(r.codes), guide: str(r.guide, 24), needsReview: r.needsReview === true || r.review?.needs === true, reviewedAt: iso(r.reviewedAt), note: str(r.note ?? r.review?.note, 300) };
  if (isObj(r.derivedFrom) && typeof r.derivedFrom.id === "string") out.derivedFrom = { id: str(r.derivedFrom.id, 64), guide: str(r.derivedFrom.guide, 24), title: str(r.derivedFrom.title, 120) };
  return out;
}
const isEmptyMeta = (m) => !m.codes.length && !m.guide && !m.needsReview && !m.reviewedAt && !m.note && !m.derivedFrom;

export const getBlockMeta = (block) => normalizeMeta(block?.content?.meta);
export function setBlockMeta(block, patch) {
  const next = { ...getBlockMeta(block), ...patch };
  const norm = normalizeMeta(next);
  if (patch && "derivedFrom" in patch) { if (!patch.derivedFrom) delete norm.derivedFrom; }
  const content = isObj(block.content) ? { ...block.content } : {};
  if (isEmptyMeta(norm)) delete content.meta; else content.meta = norm;
  return { ...block, content };
}
export const todayIso = () => new Date().toISOString();
export const markReviewed = (meta, at = todayIso()) => ({ ...normalizeMeta(meta), needsReview: false, reviewedAt: at, note: "" });
export const markNeedsChange = (meta, note = "") => ({ ...normalizeMeta(meta), needsReview: true, note: str(note, 300) });

/** Splits fetched block rows into editable blocks and the hidden lesson-meta row. */
export function extractMetaRow(rows) {
  const list = rows || [];
  const metaRow = list.find(isMetaRow) ?? null;
  return { blocks: list.filter((b) => !isMetaRow(b)), metaRow, meta: normalizeMeta(metaRow?.content?.meta) };
}
export const metaContent = (meta) => ({ meta: normalizeMeta(meta) });

// ------------------------------------------------------------------ text
export function stripHtml(html) {
  return String(html ?? "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
const SKIP_KEYS = new Set(["layout", "ui", "meta", "audience", "alignment", "width", "wrap", "imageWrap", "imageWidth", "imageAlignment", "titleColor", "displayMode", "simulationId", "presetId", "url", "imageUrl", "src"]);
function collect(v, out, key = "") {
  if (typeof v === "string") { if (!SKIP_KEYS.has(key)) out.push(stripHtml(v)); }
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out, key));
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) collect(x, out, k);
}
/** Every piece of readable text in a block, in field order. */
export function blockText(block) {
  const out = [];
  collect(block?.content, out);
  return out.filter(Boolean).join(" ");
}
const TITLE_FIRST = ["title", "term", "text", "question", "prompt", "aim", "markup", "label", "html", "definition", "content"];
/** The first meaningful line of a block (title when it has one, else the start of its text). */
export function firstLine(block, max = 90) {
  const c = isObj(block?.content) ? block.content : {};
  for (const k of TITLE_FIRST) {
    const t = typeof c[k] === "string" ? stripHtml(c[k]) : "";
    if (t) return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
  }
  const all = blockText(block);
  return all.length > max ? `${all.slice(0, max - 1).trimEnd()}…` : all;
}
export const wordCount = (text) => (String(text || "").trim() ? String(text).trim().split(/\s+/).length : 0);
function countImages(block) {
  const c = isObj(block?.content) ? block.content : {};
  let n = 0;
  if (block?.block_type === "image" && c.url) n += 1;
  if (typeof c.imageUrl === "string" && c.imageUrl) n += 1;
  if (typeof c.html === "string") n += (c.html.match(/<img\b/gi) || []).length;
  if (typeof c.content === "string") n += (c.content.match(/<img\b/gi) || []).length;
  return n;
}

export function blockSummary(block, { checkCount = 0 } = {}) {
  const text = blockText(block);
  const meta = getBlockMeta(block);
  const c = isObj(block?.content) ? block.content : {};
  return {
    id: block.id, type: block.block_type, visible: block.visible !== false, first: firstLine(block), words: wordCount(text), images: countImages(block),
    simulation: block.block_type === "simulation" ? String(c.simulationId || "") : "", questions: block.block_type === "check_understanding" ? checkCount : 0,
    codes: meta.codes, guide: meta.guide, needsReview: meta.needsReview,
  };
}

const SKIP_TOPICS = new Set(["__library__"]);
/** One overview row per lesson. `rows` = that lesson's block rows (including the hidden meta row); */
export function lessonSummary(page, rows, { checkCount = 0 } = {}) {
  const { blocks, meta, metaRow } = extractMetaRow(rows);
  const sorted = [...blocks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const items = sorted.map((b) => blockSummary(b, { checkCount }));
  const codes = uniq([...(page.syllabus_codes ?? []), ...meta.codes, ...items.flatMap((i) => i.codes)]);
  return {
    id: page.id, title: page.title, code: page.lesson_code, topic: page.parent_topic, status: page.status, level: page.level,
    metaRowId: metaRow?.id ?? null, guide: meta.guide, needsReview: meta.needsReview || items.some((i) => i.needsReview), lessonNeedsReview: meta.needsReview, reviewedAt: meta.reviewedAt, note: meta.note,
    derivedFrom: meta.derivedFrom ?? null, codes, blocks: items,
    words: items.reduce((s, i) => s + i.words, 0), images: items.reduce((s, i) => s + i.images, 0),
    simulations: items.filter((i) => i.simulation).map((i) => i.simulation), questions: items.reduce((s, i) => s + i.questions, 0),
    text: `${page.title} ${page.lesson_code} ${sorted.map(blockText).join(" ")}`.toLowerCase(),
  };
}
export function summariseAll(pages, blockRows, checkCounts = {}) {
  const by = new Map();
  for (const r of blockRows || []) { if (!by.has(r.page_id)) by.set(r.page_id, []); by.get(r.page_id).push(r); }
  return (pages || []).filter((p) => !SKIP_TOPICS.has(p.parent_topic)).map((p) => lessonSummary(p, by.get(p.id) ?? [], { checkCount: checkCounts[p.id] ?? 0 }));
}

/** filters: { query, topic, status, code, guide ("" any, "__none__" untagged, else exact), needsReview (bool) } */
export function filterLessons(list, f = {}) {
  const q = String(f.query || "").trim().toLowerCase();
  return list.filter((l) => {
    if (f.topic && l.topic !== f.topic) return false;
    if (f.status && l.status !== f.status) return false;
    if (f.code && !l.codes.some((c) => c.toLowerCase().includes(String(f.code).toLowerCase()))) return false;
    if (f.guide === "__none__" ? l.guide : f.guide && l.guide !== f.guide) return false;
    if (f.needsReview && !l.needsReview) return false;
    if (q && !l.text.includes(q)) return false;
    return true;
  });
}
/** Search hits inside block text: [{ lessonId, blockId, snippet }]. */
export function searchBlocks(pages, blockRows, query, limit = 200) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  const byPage = new Map((pages || []).map((p) => [p.id, p]));
  const hits = [];
  for (const b of blockRows || []) {
    if (isMetaRow(b) || !byPage.has(b.page_id) || SKIP_TOPICS.has(byPage.get(b.page_id).parent_topic)) continue;
    const text = blockText(b);
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) continue;
    const from = Math.max(0, i - 40);
    hits.push({ lessonId: b.page_id, blockId: b.id, type: b.block_type, snippet: `${from > 0 ? "…" : ""}${text.slice(from, i + q.length + 60)}${i + q.length + 60 < text.length ? "…" : ""}`, position: b.position ?? 0 });
    if (hits.length >= limit) break;
  }
  return hits;
}
