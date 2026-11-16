// Export / import / duplicate-as-new-guide-version / block library for Learn lessons. Pure (no React/DOM/Supabase).
import { normalizeMeta, extractMetaRow, isMetaRow, META_BLOCK_TYPE, setBlockMeta, blockText } from "./learnMeta.js";
import { normalizeBlocks, validateLayout } from "./blockLayout.js";
import { isCanvas, validateCanvas } from "./blockCanvas.js";

export const EXPORT_FORMAT = "elab-learn-export";
export const EXPORT_VERSION = 1;
export const LIBRARY_FORMAT = "elab-block-library";
const MAX_LESSONS = 200; const MAX_BLOCKS = 500; const MAX_BYTES = 20 * 1024 * 1024;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

/** Lessons -> JSON-able export. `items` = [{ page, rows, checkCount }]. Check-your-understanding questions are NOT exported (ids/versions are database specific). */
export function buildExport(items, now = new Date().toISOString()) {
  return {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now,
    lessons: items.map(({ page, rows, checkCount = 0 }) => {
      const { blocks, meta } = extractMetaRow(rows);
      return {
        parent_topic: page.parent_topic, lesson_code: page.lesson_code, title: page.title, level: page.level, syllabus_codes: page.syllabus_codes ?? [], status: page.status,
        meta, checkQuestionsNotIncluded: checkCount,
        blocks: [...blocks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((b) => ({ block_type: b.block_type, visible: b.visible !== false, content: clone(b.content ?? {}) })),
      };
    }),
  };
}

/** Validates an untrusted parsed file. Returns { ok, errors, warnings, lessons } where each lesson has a plan
 * ("create") and a unique lesson_code. NEVER plans an overwrite: a code already in use gets a suffix. */
export function validateImport(data, { knownTypes = null, existing = [] } = {}) {
  const errors = []; const warnings = []; const lessons = [];
  if (!isObj(data)) return { ok: false, errors: ["The file is not a JSON object."], warnings, lessons };
  if (data.format !== EXPORT_FORMAT) return { ok: false, errors: [`Not an e-Lab lesson export (format must be "${EXPORT_FORMAT}").`], warnings, lessons };
  if (data.version !== EXPORT_VERSION) return { ok: false, errors: [`Unsupported export version ${JSON.stringify(data.version)} (this app reads version ${EXPORT_VERSION}).`], warnings, lessons };
  if (!Array.isArray(data.lessons) || data.lessons.length === 0) return { ok: false, errors: ["The file contains no lessons."], warnings, lessons };
  if (data.lessons.length > MAX_LESSONS) return { ok: false, errors: [`Too many lessons (${data.lessons.length}; max ${MAX_LESSONS}).`], warnings, lessons };
  if (JSON.stringify(data).length > MAX_BYTES) return { ok: false, errors: ["The file is too large."], warnings, lessons };
  const taken = new Set(existing.map((e) => `${e.parent_topic}\u0000${e.lesson_code}`));
  data.lessons.forEach((l, i) => {
    const tag = `Lesson ${i + 1}${isObj(l) && l.title ? ` ("${l.title}")` : ""}`;
    const errs = [];
    if (!isObj(l)) { errors.push(`${tag}: not an object.`); return; }
    for (const k of ["parent_topic", "lesson_code", "title"]) if (typeof l[k] !== "string" || !l[k].trim()) errs.push(`${tag}: "${k}" is missing.`);
    if (!["SL/HL", "SL", "HL"].includes(l.level)) errs.push(`${tag}: "level" must be SL/HL, SL or HL.`);
    if (l.syllabus_codes !== undefined && !(Array.isArray(l.syllabus_codes) && l.syllabus_codes.every((c) => typeof c === "string"))) errs.push(`${tag}: "syllabus_codes" must be a list of text.`);
    if (!Array.isArray(l.blocks)) errs.push(`${tag}: "blocks" must be a list.`);
    else if (l.blocks.length > MAX_BLOCKS) errs.push(`${tag}: too many blocks.`);
    else l.blocks.forEach((b, j) => {
      if (!isObj(b) || typeof b.block_type !== "string" || !isObj(b.content)) { errs.push(`${tag}, block ${j + 1}: needs "block_type" and an object "content".`); return; }
      if (b.block_type === META_BLOCK_TYPE) errs.push(`${tag}, block ${j + 1}: reserved block type.`);
      else if (knownTypes && !knownTypes.includes(b.block_type)) errs.push(`${tag}, block ${j + 1}: unknown block type "${b.block_type}".`);
      if (/<script|javascript:|\son\w+\s*=/i.test(JSON.stringify(b.content))) errs.push(`${tag}, block ${j + 1}: contains script-like content.`);
    });
    if (errs.length) { errors.push(...errs); return; }
    const blocks = normalizeBlocks(l.blocks.map((b, j) => ({ id: `imp-${j}`, block_type: b.block_type, content: clone(b.content), visible: b.visible !== false, position: j })));
    const v = isCanvas(blocks) ? validateCanvas(blocks) : validateLayout(blocks);
    if (!v.valid) warnings.push(`${tag}: layout needs repair (${v.errors[0]}); it will be repaired on import.`);
    let code = l.lesson_code.trim(); let n = 1;
    const base = code;
    while (taken.has(`${l.parent_topic}\u0000${code}`)) { n += 1; code = `${base} (import ${n})`; }
    taken.add(`${l.parent_topic}\u0000${code}`);
    if (code !== base) warnings.push(`${tag}: code "${base}" already exists, it will be imported as "${code}".`);
    if (l.checkQuestionsNotIncluded > 0) warnings.push(`${tag}: ${l.checkQuestionsNotIncluded} Check Your Understanding question(s) are not part of exports; add them again after import.`);
    lessons.push({ plan: "create", status: "draft", parent_topic: l.parent_topic, lesson_code: code, originalCode: base, title: l.title.trim(), level: l.level, syllabus_codes: l.syllabus_codes ?? [], meta: normalizeMeta(l.meta), blocks: l.blocks.map((b) => ({ block_type: b.block_type, visible: b.visible !== false, content: clone(b.content) })) });
  });
  return { ok: errors.length === 0 && lessons.length > 0, errors, warnings, lessons: errors.length ? [] : lessons };
}
export function parseImportText(text, opts) {
  if (String(text).length > MAX_BYTES) return { ok: false, errors: ["The file is too large."], warnings: [], lessons: [] };
  let data;
  try { data = JSON.parse(text); } catch (e) { return { ok: false, errors: [`Invalid JSON: ${e.message}`], warnings: [], lessons: [] }; }
  return validateImport(data, opts);
}
export const dryRunSummary = (res) => res.lessons.map((l) => `${l.plan.toUpperCase()}: ${l.parent_topic} / ${l.lesson_code} - ${l.title} (${l.blocks.length} blocks, draft)`);

/** Plan for "Duplicate lesson as new guide version". Original is untouched; copy is a draft flagged "needs review". */
export function buildDuplicate(page, rows, version, { existingCodes = [] } = {}) {
  const v = String(version ?? "").trim().slice(0, 24);
  if (!v) throw new Error("Enter the new guide version, for example 2025.");
  const { blocks, meta } = extractMetaRow(rows);
  const taken = new Set(existingCodes);
  const base = String(page.lesson_code).replace(/\s*\[[^\]]*\]\s*$/, "");
  let code = `${base} [${v}]`; let n = 1;
  while (taken.has(code)) { n += 1; code = `${base} [${v}] (${n})`; }
  return {
    page: { parent_topic: page.parent_topic, lesson_code: code, title: page.title, level: page.level, syllabus_codes: [...(page.syllabus_codes ?? [])] },
    meta: { ...meta, guide: v, needsReview: true, reviewedAt: "", note: `Copied from guide ${meta.guide || "(untagged)"}`, derivedFrom: { id: page.id, guide: meta.guide, title: page.title } },
    blocks: [...blocks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((b) => { const c = setBlockMeta({ ...b, content: clone(b.content ?? {}) }, { guide: v }); return { block_type: b.block_type, visible: b.visible !== false, content: c.content }; }),
  };
}

// ------------------------------------------------------------------ block library (templates)
const stripBlock = (b) => { const c = clone(b.content ?? {}); delete c.layout; delete c.ui; return { block_type: b.block_type, content: c }; };
export function makeTemplate(name, blocks, now = new Date().toISOString()) {
  const list = blocks.filter((b) => b.block_type !== "check_understanding" && !isMetaRow(b));
  if (!list.length) throw new Error("Check Your Understanding blocks cannot be saved to the library (their questions are lesson specific).");
  const nm = String(name ?? "").trim().slice(0, 80) || `${list.length} block${list.length > 1 ? "s" : ""}`;
  return { id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name: nm, savedAt: now, blocks: list.map(stripBlock), preview: blockText(list[0]).slice(0, 120) };
}
export function validateLibrary(data) {
  if (!isObj(data) || data.format !== LIBRARY_FORMAT || !Array.isArray(data.templates)) return { ok: false, errors: [`Not a block library file (format must be "${LIBRARY_FORMAT}").`], templates: [] };
  const errors = []; const templates = [];
  data.templates.forEach((t, i) => {
    if (!isObj(t) || typeof t.name !== "string" || !Array.isArray(t.blocks) || !t.blocks.length || t.blocks.length > 50 || !t.blocks.every((b) => isObj(b) && typeof b.block_type === "string" && isObj(b.content))) { errors.push(`Template ${i + 1} is malformed.`); return; }
    if (/<script|javascript:/i.test(JSON.stringify(t.blocks))) { errors.push(`Template ${i + 1} contains script-like content.`); return; }
    templates.push({ id: typeof t.id === "string" ? t.id : `tpl-imp-${i}`, name: t.name.slice(0, 80), savedAt: t.savedAt ?? "", blocks: t.blocks.map(stripBlock), preview: String(t.preview ?? "").slice(0, 120) });
  });
  return { ok: errors.length === 0 && templates.length > 0, errors, templates: errors.length ? [] : templates };
}
export const exportLibrary = (templates) => ({ format: LIBRARY_FORMAT, version: 1, templates });
const LIB_KEY = "elab:learn-block-library:v1";
export function loadLibrary(storage = globalThis.localStorage) {
  try { const r = validateLibrary({ format: LIBRARY_FORMAT, templates: JSON.parse(storage.getItem(LIB_KEY) || "[]") }); return r.ok ? r.templates : []; } catch { return []; }
}
export function saveLibrary(templates, storage = globalThis.localStorage) { try { storage.setItem(LIB_KEY, JSON.stringify(templates)); return true; } catch { return false; } }
