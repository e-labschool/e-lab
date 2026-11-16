import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Download, Upload, CopyPlus, CheckCheck, ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import { getLearnCmsCurriculumTree } from "../../../data/learnCmsCurriculum.js";
import { BLOCK_TYPES } from "../../../data/learnBlockRegistry.jsx";
import { listAllPages, listAllBlocks, listCheckCounts, duplicateLessonAsVersion, importLessons, saveLessonMeta } from "../../../lib/learnReuseService.js";
import { summariseAll, filterLessons, searchBlocks, markReviewed, markNeedsChange, normalizeMeta, extractMetaRow } from "../../../lib/learnMeta.js";
import { buildExport, parseImportText, dryRunSummary } from "../../../lib/learnReuse.js";
import CompactLesson from "./CompactLesson.jsx";

const btn = "inline-flex min-h-9 items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-ink)]/40 disabled:opacity-40";
const field = "rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2.5 py-1.5 text-xs text-[var(--color-ink)]";
const chip = "rounded px-1.5 py-0.5 text-[10px] font-bold";
const typeLabel = (t) => BLOCK_TYPES[t]?.label ?? t;

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Admin: every lesson at a glance, search, filters, review mode, duplicate-as-version, export / import. */
export default function ContentOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState(null); // { pages, blocks, counts }
  const [error, setError] = useState("");
  const [f, setF] = useState({ query: "", topic: "", status: "", code: "", guide: "", needsReview: false });
  const [open, setOpen] = useState(() => new Set());
  const [sel, setSel] = useState(() => new Set());
  const [dup, setDup] = useState(null); // { id, version }
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [imp, setImp] = useState(null);
  const [review, setReview] = useState(null); // { ids, index }
  const file = useRef(null);
  const topics = useMemo(() => Object.fromEntries(getLearnCmsCurriculumTree().flatMap((s) => s.topics.flatMap((t) => t.subtopics.map((x) => [x.id, `${x.code} ${x.label}`])))), []);

  const load = useCallback(async () => {
    setError("");
    try { const [pages, blocks, counts] = await Promise.all([listAllPages(), listAllBlocks(), listCheckCounts()]); setData({ pages, blocks, counts }); }
    catch (e) { setError(e.message || "Could not load the lessons."); setData({ pages: [], blocks: [], counts: {} }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const summaries = useMemo(() => (data ? summariseAll(data.pages, data.blocks, data.counts) : []), [data]);
  const shown = useMemo(() => filterLessons(summaries, f), [summaries, f]);
  const guides = useMemo(() => [...new Set(summaries.map((s) => s.guide).filter(Boolean))].sort(), [summaries]);
  const topicIds = useMemo(() => [...new Set(summaries.map((s) => s.topic))].sort(), [summaries]);
  const hits = useMemo(() => (data ? searchBlocks(data.pages, data.blocks, f.query) : []), [data, f.query]);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const toggle = (setter, id) => setter((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const rowsOf = (id) => (data?.blocks ?? []).filter((b) => b.page_id === id);

  async function run(label, fn) { setBusy(label); setNotice(""); setError(""); try { await fn(); } catch (e) { setError(e.message || "That did not work."); } finally { setBusy(""); } }
  const doExport = () => {
    const list = (sel.size ? summaries.filter((s) => sel.has(s.id)) : shown);
    const items = list.map((s) => ({ page: data.pages.find((p) => p.id === s.id), rows: rowsOf(s.id), checkCount: data.counts[s.id] ?? 0 }));
    download(`elab-lessons-${new Date().toISOString().slice(0, 10)}.json`, buildExport(items));
    setNotice(`Exported ${items.length} lesson(s). Check Your Understanding questions are not included.`);
  };
  async function onFile(e) {
    const fl = e.target.files?.[0]; e.target.value = ""; if (!fl) return;
    const res = parseImportText(await fl.text(), { knownTypes: Object.keys(BLOCK_TYPES), existing: data.pages });
    setImp({ name: fl.name, res });
  }
  const confirmImport = () => run("import", async () => { const created = await importLessons(imp.res.lessons); setImp(null); setNotice(`Created ${created.length} new draft lesson(s). Nothing existing was changed.`); await load(); });
  const doDuplicate = () => run("duplicate", async () => { const r = await duplicateLessonAsVersion(dup.id, dup.version); setDup(null); setNotice(`Created draft copy "${r.page.lesson_code}" (needs review). The original is untouched.${r.questionsCopied ? ` ${r.questionsCopied} question link(s) copied.` : ""}${r.questionsSkipped ? ` ${r.questionsSkipped} manual question(s) were not copied; add them again.` : ""}`); await load(); });
  const setReviewMeta = (s, meta) => run("review", async () => { await saveLessonMeta(s.id, meta, s.metaRowId); await load(); });

  if (review) return <ReviewMode summaries={summaries} rowsOf={rowsOf} counts={data.counts} ids={review.ids} start={review.index} onSave={setReviewMeta} onExit={() => setReview(null)} />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" data-testid="content-overview">
      <button type="button" onClick={() => navigate("/admin/learn-content")} className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><ChevronLeft size={15} /> Learn Content</button>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Content overview</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Every lesson and its blocks in one list. Search text, filter by topic, guide version or review state, then review, copy or export.</p>

      <div className="mt-4 flex flex-wrap items-end gap-2" role="search" aria-label="Filter lessons">
        <label className="flex min-w-48 flex-1 flex-col text-[11px] text-[var(--color-ink-soft)]">Search all lesson text<input type="search" className={field} value={f.query} onChange={(e) => set({ query: e.target.value })} placeholder="e.g. isotope" data-testid="overview-search" /></label>
        <label className="flex flex-col text-[11px] text-[var(--color-ink-soft)]">Topic<select className={field} value={f.topic} onChange={(e) => set({ topic: e.target.value })}><option value="">All topics</option>{topicIds.map((t) => <option key={t} value={t}>{topics[t] ?? t}</option>)}</select></label>
        <label className="flex flex-col text-[11px] text-[var(--color-ink-soft)]">Status<select className={field} value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">Any</option><option value="draft">Draft</option><option value="published">Published</option></select></label>
        <label className="flex flex-col text-[11px] text-[var(--color-ink-soft)]">Syllabus code<input className={`${field} w-28`} value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="S1.2" /></label>
        <label className="flex flex-col text-[11px] text-[var(--color-ink-soft)]">Guide version<select className={field} value={f.guide} onChange={(e) => set({ guide: e.target.value })}><option value="">Any</option><option value="__none__">Not tagged</option>{guides.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
        <label className="inline-flex min-h-9 items-center gap-1.5 text-xs text-[var(--color-ink-soft)]"><input type="checkbox" checked={f.needsReview} onChange={(e) => set({ needsReview: e.target.checked })} /> Needs review</label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--color-ink-soft)]" data-testid="overview-count">{shown.length} of {summaries.length} lessons</span>
        <button type="button" className={`${btn} ml-auto`} disabled={!shown.length} onClick={() => setReview({ ids: shown.map((s) => s.id), index: 0 })} data-testid="start-review"><ListChecks size={13} /> Start review ({shown.length})</button>
        <button type="button" className={btn} disabled={!shown.length} onClick={doExport}><Download size={13} /> Export {sel.size ? `selected (${sel.size})` : "shown"}</button>
        <button type="button" className={btn} onClick={() => file.current?.click()}><Upload size={13} /> Import...</button>
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Import lessons file" onChange={onFile} />
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-[var(--color-coral)]">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-md bg-[var(--color-teal-soft)] px-3 py-2 text-xs text-[var(--color-ink)]">{notice}</p>}

      {imp && (
        <section aria-label="Import preview" data-testid="import-preview" className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Import preview: {imp.name}</h2>
          {imp.res.errors.length > 0 ? (<><p className="mt-1 text-xs font-semibold text-[var(--color-coral)]">This file cannot be imported. Nothing was written.</p><ul className="mt-1 list-disc pl-5 text-xs text-[var(--color-coral)]">{imp.res.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}</ul></>) : (<>
            <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Dry run: nothing has been written yet. Existing lessons are never overwritten; each lesson below becomes a NEW draft.</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-[var(--color-ink)]">{dryRunSummary(imp.res).map((l, i) => <li key={i}>{l}</li>)}</ul>
            {imp.res.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-[var(--color-amber)]">{imp.res.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
            <button type="button" className={`${btn} mt-3`} disabled={busy === "import"} onClick={confirmImport}>{busy === "import" ? <Loader2 size={13} className="animate-spin" /> : null} Create {imp.res.lessons.length} draft lesson(s)</button>
          </>)}
          <button type="button" className={`${btn} ml-2 mt-3`} onClick={() => setImp(null)}>Cancel</button>
        </section>
      )}

      {f.query.trim().length >= 2 && (
        <section aria-label="Text matches" className="mt-4" data-testid="overview-hits">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{hits.length} block match{hits.length === 1 ? "" : "es"}</h2>
          <ul className="mt-1 divide-y divide-[var(--color-line)] rounded-md border border-[var(--color-line)]">
            {hits.slice(0, 40).map((h) => { const l = summaries.find((s) => s.id === h.lessonId); return (
              <li key={h.blockId} className="flex items-center gap-2 px-3 py-1.5 text-xs"><span className="shrink-0 font-semibold text-[var(--color-ink)]">{l?.code}</span><span className="min-w-0 flex-1 truncate text-[var(--color-ink-soft)]">{typeLabel(h.type)}: {h.snippet}</span><Link className="shrink-0 font-semibold text-[var(--color-indigo)]" to={`/admin/learn-content/${h.lessonId}?block=${h.blockId}`}>Open</Link></li>); })}
          </ul>
        </section>
      )}

      {data === null ? <div className="mt-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div> : (
        <ul className="mt-4 space-y-2" data-testid="overview-list">
          {shown.length === 0 && <li className="rounded-md border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-ink-faint)]">No lessons match these filters.</li>}
          {shown.map((s) => (
            <li key={s.id} data-lesson={s.id} className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <input type="checkbox" aria-label={`Select ${s.title}`} checked={sel.has(s.id)} onChange={() => toggle(setSel, s.id)} />
                <button type="button" aria-expanded={open.has(s.id)} aria-label={`${open.has(s.id) ? "Hide" : "Show"} blocks of ${s.title}`} onClick={() => toggle(setOpen, s.id)} className="rounded p-1 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40">{open.has(s.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--color-ink)]"><span className="mr-2 font-mono text-xs text-[var(--color-ink-faint)]">{s.code}</span>{s.title}</p>
                  <p className="truncate text-[11px] text-[var(--color-ink-faint)]">{topics[s.topic] ?? s.topic} - {s.blocks.length} blocks, {s.words} words, {s.images} images, {s.simulations.length} simulations, {s.questions} questions{s.codes.length ? ` - ${s.codes.slice(0, 5).join(", ")}${s.codes.length > 5 ? "..." : ""}` : ""}</p></div>
                <span className={`${chip} ${s.status === "published" ? "bg-[var(--color-teal-soft)] text-[var(--color-teal)]" : "bg-[var(--color-line)]/50 text-[var(--color-ink-soft)]"}`}>{s.status}</span>
                {s.guide && <span className={`${chip} bg-[var(--color-line)]/50 text-[var(--color-ink-soft)]`}>guide {s.guide}</span>}
                {s.needsReview && <span className={`${chip} bg-[var(--color-amber-soft)] text-[var(--color-amber)]`}>Needs review</span>}
                {!s.needsReview && s.reviewedAt && <span className={`${chip} bg-[var(--color-teal-soft)] text-[var(--color-teal)]`}>Reviewed {s.reviewedAt.slice(0, 10)}</span>}
                <Link className={btn} to={`/admin/learn-content/${s.id}`}>Open</Link>
                <button type="button" className={btn} onClick={() => setDup({ id: s.id, version: "" })}><CopyPlus size={13} /> New guide version</button>
                <button type="button" className={btn} disabled={busy === "review"} onClick={() => setReviewMeta(s, markReviewed(normalizeMeta({ ...(extractMetaRow(rowsOf(s.id)).meta) })))}><CheckCheck size={13} /> Reviewed</button>
              </div>
              {dup?.id === s.id && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-xs" data-testid="dup-form">
                  <label className="text-[var(--color-ink-soft)]">New guide version <input className={`${field} ml-1 w-28`} value={dup.version} placeholder="2025" onChange={(e) => setDup({ ...dup, version: e.target.value })} autoFocus /></label>
                  <button type="button" className={btn} disabled={!dup.version.trim() || busy === "duplicate"} onClick={doDuplicate}>Create draft copy</button>
                  <button type="button" className={btn} onClick={() => setDup(null)}>Cancel</button>
                  <span className="text-[var(--color-ink-faint)]">Copies all blocks into a new draft flagged "needs review". The original is not changed.</span>
                </div>
              )}
              {open.has(s.id) && (
                <table className="w-full border-t border-[var(--color-line)] text-left text-[11px]"><thead className="text-[var(--color-ink-faint)]"><tr><th className="px-3 py-1">Type</th><th className="px-2">First line</th><th className="px-2">Words</th><th className="px-2">Img</th><th className="px-2">Linked</th><th className="px-2">Tags</th></tr></thead>
                  <tbody>{s.blocks.map((b) => (
                    <tr key={b.id} className="border-t border-[var(--color-line)]/60"><td className="px-3 py-1 font-semibold text-[var(--color-ink)]">{typeLabel(b.type)}{!b.visible && " (hidden)"}</td><td className="max-w-md truncate px-2 text-[var(--color-ink-soft)]">{b.first}</td><td className="px-2">{b.words}</td><td className="px-2">{b.images}</td>
                      <td className="px-2">{b.simulation ? `sim: ${b.simulation}` : b.questions ? `${b.questions} questions` : ""}</td><td className="px-2">{[...b.codes, b.guide && `v${b.guide}`, b.needsReview && "review"].filter(Boolean).join(" ")}</td></tr>))}</tbody></table>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Steps through lessons one at a time showing the compact view with Approve / Needs change. */
function ReviewMode({ summaries, rowsOf, counts, ids, start, onSave, onExit }) {
  const [i, setI] = useState(start);
  const [notes, setNotes] = useState({});
  const s = summaries.find((x) => x.id === ids[i]);
  const rows = s ? extractMetaRow(rowsOf(s.id)).blocks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : [];
  const meta = s ? normalizeMeta({ guide: s.guide, codes: [], needsReview: s.lessonNeedsReview, reviewedAt: s.reviewedAt, note: s.note, derivedFrom: s.derivedFrom }) : null;
  const note = notes[s?.id] ?? s?.note ?? "";
  const setNote = (v) => setNotes((m) => ({ ...m, [s.id]: v }));
  if (!s) return <div className="p-8 text-sm">Review finished. <button type="button" className={btn} onClick={onExit}>Back to overview</button></div>;
  const go = (d) => setI((x) => Math.min(ids.length, Math.max(0, x + d)));
  const approve = async () => { await onSave(s, markReviewed(meta)); go(1); };
  const change = async () => { await onSave(s, markNeedsChange(meta, note)); go(1); };
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6" data-testid="review-mode">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={onExit}><ChevronLeft size={13} /> Overview</button>
        <p className="text-sm font-semibold text-[var(--color-ink)]" data-testid="review-progress">Lesson {i + 1} of {ids.length}</p>
        <button type="button" className={`${btn} ml-auto`} onClick={() => go(-1)} disabled={i === 0}>Previous</button>
        <button type="button" className={btn} onClick={() => go(1)}>Skip</button>
      </div>
      <h1 className="mt-3 text-lg font-semibold text-[var(--color-ink)]"><span className="mr-2 font-mono text-sm text-[var(--color-ink-faint)]">{s.code}</span>{s.title}</h1>
      <p className="text-xs text-[var(--color-ink-faint)]">{s.guide ? `Guide ${s.guide}. ` : "No guide version. "}{s.reviewedAt ? `Last reviewed ${s.reviewedAt.slice(0, 10)}.` : "Never reviewed."} {s.note && `Note: ${s.note}`}</p>
      <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3"><CompactLesson blocks={rows} checkCount={counts[s.id] ?? 0} /></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} !bg-[var(--color-teal)] !text-white`} onClick={approve} data-testid="review-approve"><CheckCheck size={13} /> Approve</button>
        <input className={`${field} min-w-48 flex-1`} aria-label="What needs to change" placeholder="What needs to change (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" className={`${btn} !border-[var(--color-amber)] !text-[var(--color-amber)]`} onClick={change} data-testid="review-change">Needs change</button>
        <Link className={btn} to={`/admin/learn-content/${s.id}`}>Open in editor</Link>
      </div>
    </div>
  );
}
