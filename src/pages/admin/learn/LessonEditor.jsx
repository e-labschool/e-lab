import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Plus, Loader2, GripVertical, Copy, Eye, EyeOff, Trash2, Search, X, ArrowUp, ArrowDown, Pencil, Undo2, Redo2, SlidersHorizontal,
} from "lucide-react";
import { getFlatParentTopics } from "../../../data/learnCmsCurriculum.js";
import {
  getLesson, createLesson, updateLesson, publishLesson, saveLessonAsDraft,
  listBlocks, createBlock, updateBlock, deleteBlock, reorderBlocks,
  listCheckQuestions, addCheckQuestion, addManualCheckQuestion, updateManualCheckQuestion,
  removeCheckQuestion, reorderCheckQuestions, getAdminManualCheckSecret,
} from "../../../lib/learnContentService.js";
import { listQuestions } from "../../../lib/questionBankService.js";
import { resolveLatestVersionIds } from "../../../lib/canonicalQuestions.js";
import { BLOCK_TYPES, BLOCK_CATEGORIES, BlockEditor, getLearnBlockDisplayLabel } from "../../../data/learnBlockRegistry.jsx";
import LearnBlockRenderer from "../../../components/learn/LearnBlockRenderer.jsx";
import CheckYourUnderstanding from "../../../components/learn/CheckYourUnderstanding.jsx";
import Button from "../../../components/ui/Button.jsx";
import LearnMediaInput from "../../../components/admin/LearnMediaInput.jsx";
import EquationFriendlyField, { pasteEquationFriendly } from "../../../components/admin/EquationFriendlyField.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import { splitLearnBlocksIntoPages } from "../../../lib/learnPagination.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { saveLearnDraft, loadLearnDraft, clearLearnDraft } from "../../../lib/learnAdminDraft.js";
import { loadLearnAuthorDefaults, saveLearnAuthorDefaults } from "../../../lib/learnAuthorDefaults.js";
import { getSyllabusCodeOptions } from "../../../lib/learn-tree.js";
import { filterBlocksForStudent } from "../../../lib/learnLevelAccess.js";

const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

export default function LessonEditor() {
  const { pageId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !pageId;
  const parentTopics = [{ id: "__welcome__", label: "Welcome Page", sectionLabel: "Learn" }, ...getFlatParentTopics()];

  const [form, setForm] = useState({
    parentTopic: searchParams.get("parentTopic") || parentTopics[0]?.id || "",
    lessonCode: "", syllabusCodes: [], title: "", level: "SL/HL", displayOrder: null, displayOrderSl: null, displayOrderHl: null,
  });
  const [status, setStatus] = useState("draft");
  const [blocks, setBlocks] = useState([]);
  const [checkQuestions, setCheckQuestions] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [formHydrated, setFormHydrated] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewLevel, setPreviewLevel] = useState("SL");
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [currentPageId, setCurrentPageId] = useState(pageId ?? null);
  const [showDesignDefaults, setShowDesignDefaults] = useState(false);
  const [authorDefaults, setAuthorDefaults] = useState(() => loadLearnAuthorDefaults(user?.id));
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const [, setHistoryTick] = useState(0);
  const suppressHistory = useRef(false);

  useEffect(() => { setAuthorDefaults(loadLearnAuthorDefaults(user?.id)); }, [user?.id]);
  function updateAuthorDefaults(patch) {
    const next = { ...authorDefaults, ...patch };
    setAuthorDefaults(next);
    saveLearnAuthorDefaults(user?.id, next);
  }
  function pushHistory(entry) {
    if (suppressHistory.current) return;
    undoStack.current = [...undoStack.current.slice(-39), entry];
    redoStack.current = [];
    setHistoryTick((n) => n + 1);
  }

  useEffect(() => {
    if (isNew) return;
    Promise.all([getLesson(pageId), listBlocks(pageId), listCheckQuestions(pageId)])
      .then(([lesson, blockRows, checkRows]) => {
        const serverForm = { parentTopic: lesson.parent_topic, lessonCode: lesson.lesson_code, syllabusCodes: lesson.syllabus_codes ?? [], title: lesson.title, level: lesson.level, displayOrder: lesson.display_order, displayOrderSl: lesson.display_order_sl, displayOrderHl: lesson.display_order_hl };
        // Resume any unsaved settings-form edits and the expanded block
        // from before a temporary trip to another Admin tab — only if
        // the remembered draft is genuinely for THIS lesson; a draft for
        // a different lesson (or a stale one from a prior session) is
        // never applied here.
        const draft = user?.id ? loadLearnDraft(user.id) : null;
        if (draft && draft.pageId === pageId && draft.formDraft) {
          setForm({ ...serverForm, ...draft.formDraft });
          if (draft.expandedBlockId) setExpandedBlockId(draft.expandedBlockId);
        } else {
          setForm(serverForm);
        }
        setStatus(lesson.status);
        setBlocks(blockRows);
        setCheckQuestions(checkRows);
        setFormHydrated(true);
      })
      .catch((err) => setError(err.message || "Couldn't load this lesson."))
      .finally(() => setLoading(false));
  }, [pageId, isNew]);

  // Persists the current lesson id, expanded block, and settings-form
  // draft to sessionStorage on every change — cheap client-side writes
  // only, never Supabase. This is what lets a temporary trip to another
  // Admin tab and back restore exactly where the admin left off.
  useEffect(() => {
    if (!user?.id || !currentPageId || !formHydrated) return;
    saveLearnDraft(user.id, { pageId: currentPageId, expandedBlockId, formDraft: form });
  }, [user?.id, currentPageId, expandedBlockId, form, formHydrated]);

  // Scrolls the restored block into view once the lesson has finished
  // loading — "practical" best-effort focus restoration, not required to
  // be pixel-perfect.
  useEffect(() => {
    if (loading || !expandedBlockId) return;
    const el = document.getElementById(`learn-block-${expandedBlockId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, expandedBlockId]);

  async function ensurePageExists() {
    if (currentPageId) {
      await updateLesson(currentPageId, form);
      return currentPageId;
    }
    const created = await createLesson(form);
    setCurrentPageId(created.id);
    setForm((prev) => ({ ...prev, displayOrder: created.display_order, displayOrderSl: created.display_order_sl, displayOrderHl: created.display_order_hl }));
    navigate(`/admin/learn-content/${created.id}`, { replace: true });
    return created.id;
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError(null);
    try {
      const id = await ensurePageExists();
      await saveLessonAsDraft(id);
      setStatus("draft");
      if (user?.id) clearLearnDraft(user.id); // now safely persisted — no unsaved draft to protect
    } catch (err) {
      setError(err.message || "Couldn't save this lesson.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    setError(null);
    try {
      const id = await ensurePageExists();
      const published = await publishLesson(id);
      setStatus(published.status);
      if (user?.id) clearLearnDraft(user.id);
    } catch (err) {
      setError(err.message || "Couldn't publish this lesson.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBlock(blockType) {
    setShowPicker(false);
    if (!currentPageId) {
      setError("Save this lesson as a draft first, then add blocks.");
      return;
    }
    if (blockType === "check_understanding" && blocks.some((b) => b.block_type === "check_understanding")) {
      setError("This lesson already has a Check Your Understanding block. Move the existing block to the position you want.");
      return;
    }
    let initialContent = { ...BLOCK_TYPES[blockType].defaultContent, audience: "both" };
    if (blockType === "image") initialContent = { ...initialContent, width: authorDefaults.imageWidth, alignment: authorDefaults.imageAlignment };
    if (blockType === "video") initialContent = { ...initialContent, width: authorDefaults.videoWidth, alignment: authorDefaults.videoAlignment };
    const created = await createBlock(currentPageId, { blockType, content: initialContent, position: blocks.length });
    pushHistory({ type: "add", block: created });
    setBlocks((prev) => [...prev, created]);
    setExpandedBlockId(created.id);
  }

  async function handleUpdateBlockContent(blockId, content) {
    const before = blocks.find((b) => b.id === blockId)?.content;
    if (before && JSON.stringify(before) !== JSON.stringify(content)) pushHistory({ type: "content", blockId, before, after: content });
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
    await updateBlock(blockId, { content });
  }

  async function handleToggleVisible(block) {
    const visible = !block.visible;
    pushHistory({ type: "visibility", blockId: block.id, before: block.visible, after: visible });
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, visible } : b)));
    await updateBlock(block.id, { visible });
  }

  async function handleDuplicate(block) {
    if (block.block_type === "check_understanding") {
      setError("A lesson can contain one Check Your Understanding block. Move the existing block instead of duplicating it.");
      return;
    }
    const created = await createBlock(currentPageId, { blockType: block.block_type, content: block.content, position: blocks.length });
    pushHistory({ type: "add", block: created });
    setBlocks((prev) => [...prev, created]);
  }

  async function handleDelete(blockId) {
    const index = blocks.findIndex((b) => b.id === blockId);
    const deleted = blocks[index];
    if (deleted) pushHistory({ type: "delete", block: deleted, index });
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    await deleteBlock(blockId);
  }

  function handleDragStart(e, index) {
    e.dataTransfer.setData("text/plain", String(index));
  }
  function handleDrop(e, targetIndex) {
    e.preventDefault();
    const sourceIndex = Number(e.dataTransfer.getData("text/plain"));
    if (sourceIndex === targetIndex) return;
    const beforeIds = blocks.map((b) => b.id);
    const next = [...blocks];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    pushHistory({ type: "reorder", beforeIds, afterIds: next.map((b) => b.id) });
    setBlocks(next);
    reorderBlocks(next.map((b) => b.id));
  }

  async function applyHistory(entry, direction) {
    suppressHistory.current = true;
    try {
      if (entry.type === "content") {
        const content = direction === "undo" ? entry.before : entry.after;
        setBlocks((prev) => prev.map((b) => b.id === entry.blockId ? { ...b, content } : b));
        await updateBlock(entry.blockId, { content });
      } else if (entry.type === "visibility") {
        const visible = direction === "undo" ? entry.before : entry.after;
        setBlocks((prev) => prev.map((b) => b.id === entry.blockId ? { ...b, visible } : b));
        await updateBlock(entry.blockId, { visible });
      } else if (entry.type === "reorder") {
        const ids = direction === "undo" ? entry.beforeIds : entry.afterIds;
        setBlocks((prev) => ids.map((id) => prev.find((b) => b.id === id)).filter(Boolean));
        await reorderBlocks(ids);
      } else if (entry.type === "add") {
        if (direction === "undo") {
          await deleteBlock(entry.block.id);
          setBlocks((prev) => prev.filter((b) => b.id !== entry.block.id));
        } else {
          const recreated = await createBlock(currentPageId, { blockType: entry.block.block_type, content: entry.block.content, position: entry.block.position ?? blocks.length });
          entry.block = recreated;
          setBlocks((prev) => [...prev, recreated]);
        }
      } else if (entry.type === "delete") {
        if (direction === "undo") {
          const recreated = await createBlock(currentPageId, { blockType: entry.block.block_type, content: entry.block.content, position: entry.index });
          entry.block = recreated;
          setBlocks((prev) => { const next=[...prev]; next.splice(Math.min(entry.index,next.length),0,recreated); return next; });
        } else {
          await deleteBlock(entry.block.id);
          setBlocks((prev) => prev.filter((b) => b.id !== entry.block.id));
        }
      }
    } finally { suppressHistory.current = false; setHistoryTick((n) => n + 1); }
  }
  async function handleUndo() { const entry = undoStack.current.pop(); if (!entry) return; await applyHistory(entry, "undo"); redoStack.current.push(entry); setHistoryTick((n)=>n+1); }
  async function handleRedo() { const entry = redoStack.current.pop(); if (!entry) return; await applyHistory(entry, "redo"); undoStack.current.push(entry); setHistoryTick((n)=>n+1); }

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) handleRedo(); else handleUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function handleAddCheckQuestion(question) {
    setError(null);
    const versionMap = await resolveLatestVersionIds([question.id]);
    const questionVersionId = versionMap[question.id];
    if (!questionVersionId) {
      // Never insert an unpinned assignment — matches the database's own
      // NOT NULL constraint on learn_check_questions.question_version_id,
      // enforced here too so the admin gets a clear, immediate reason
      // rather than a raw constraint-violation error from the insert.
      setError("Could not pin this question version. Please save/publish the canonical question first.");
      return;
    }
    const created = await addCheckQuestion(currentPageId, { questionId: question.id, questionVersionId, position: checkQuestions.length });
    setCheckQuestions((prev) => [...prev, created]);
  }

  async function handleRemoveCheckQuestion(item) {
    setCheckQuestions((prev) => prev.filter((q) => q.id !== item.id));
    await removeCheckQuestion(item);
  }

  async function handleAddManualQuestion(question) {
    setError(null);
    try {
      const created = await addManualCheckQuestion(currentPageId, question, checkQuestions.length);
      setCheckQuestions((prev) => [...prev, created]);
    } catch (err) {
      setError(err.message || "Could not add the manual question.");
      throw err;
    }
  }

  async function handleUpdateManualQuestion(item, question) {
    setError(null);
    try {
      const updated = await updateManualCheckQuestion(item.id, currentPageId, question);
      setCheckQuestions((prev) => prev.map((q) => q.id === item.id ? { ...q, ...updated } : q));
    } catch (err) {
      setError(err.message || "Could not update the manual question.");
      throw err;
    }
  }

  async function handleMoveCheckQuestion(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= checkQuestions.length) return;
    const next = [...checkQuestions];
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((item, i) => { item.position = i; });
    setCheckQuestions(next);
    try {
      await reorderCheckQuestions(next);
    } catch (err) {
      setError(err.message || "Could not reorder questions.");
    }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>;

  if (previewing) {
    const previewPages = splitLearnBlocksIntoPages(filterBlocksForStudent(blocks.filter((b) => b.visible), previewLevel));
    const safePreviewPage = Math.min(previewPage, previewPages.length - 1);
    const activePreviewPage = previewPages[safePreviewPage];
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button type="button" onClick={() => setPreviewing(false)} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
          <ChevronLeft size={15} /> Back to editor
        </button>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-amber)]">Preview as Student</p><div className="inline-flex rounded-md border border-[var(--color-line)] p-1">{["SL","HL"].map((level)=><button key={level} type="button" onClick={()=>{setPreviewLevel(level);setPreviewPage(0);}} className={`rounded px-2.5 py-1 text-xs font-semibold ${previewLevel===level?"bg-[var(--color-indigo)] text-white":"text-[var(--color-ink-soft)]"}`}>{level}</button>)}</div></div>
        <p className="font-mono text-xs text-[var(--color-indigo)]">{form.lessonCode}</p>
        <h1 className="mt-1 font-[var(--font-display)] text-[26px] font-bold text-[var(--color-ink)]">{form.title}</h1>
        {previewPages.length > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--color-line)] py-3">
            <div>
              <p className="text-xs font-semibold text-[var(--color-ink-soft)]">Page {safePreviewPage + 1} of {previewPages.length}</p>
              {activePreviewPage.label && <p className="mt-0.5 text-sm font-medium text-[var(--color-ink)]">{activePreviewPage.label}</p>}
            </div>
            <div className="flex items-center gap-1.5">
              {previewPages.map((_, index) => (
                <button key={index} type="button" onClick={() => setPreviewPage(index)} className={`h-8 min-w-8 rounded-md px-2 text-xs font-semibold ${safePreviewPage === index ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)]"}`}>{index + 1}</button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6 space-y-5">
          {activePreviewPage.blocks.map((block) =>
            block.block_type === "check_understanding" ? (
              <CheckYourUnderstanding key={block.id} pageId={currentPageId} checkQuestions={checkQuestions} />
            ) : (
              <LearnBlockRenderer key={block.id} block={block} />
            )
          )}
        </div>
        {previewPages.length > 1 && (
          <div className="mt-6 flex justify-between border-t border-[var(--color-line)] pt-4">
            <Button size="sm" variant="secondary" disabled={safePreviewPage === 0} onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}>Previous Page</Button>
            <Button size="sm" disabled={safePreviewPage === previewPages.length - 1} onClick={() => setPreviewPage((p) => Math.min(previewPages.length - 1, p + 1))}>Next Page</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <button type="button" onClick={() => { if (user?.id) clearLearnDraft(user.id); navigate("/admin/learn-content"); }} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ChevronLeft size={15} /> Learn Content
      </button>

      {/* Settings */}
      <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--color-ink)]">{isNew && !currentPageId ? "New Lesson" : "Edit Lesson"}</h1>
          <Badge tone={status === "published" ? "teal" : "neutral"}>{status}</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Parent Topic</label>
            <select className={inputCls} value={form.parentTopic} onChange={(e) => setForm({ ...form, parentTopic: e.target.value })}>
              {parentTopics.map((t) => <option key={t.id} value={t.id}>{t.sectionLabel} → {t.code ? `${t.code} — ` : ""}{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Lesson Code</label>
            <input className={inputCls} value={form.lessonCode} onChange={(e) => setForm({ ...form, lessonCode: e.target.value })} placeholder="e.g. S1.1 Matter" />
            <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Display identifier for this lesson. Progress mapping is selected separately below.</p>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Syllabus codes covered (select one or more)</label>
            <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-2">
              {getSyllabusCodeOptions(form.parentTopic).length ? getSyllabusCodeOptions(form.parentTopic).map((opt) => (
                <label key={opt.code} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-[var(--color-line)]/20">
                  <input type="checkbox" className="mt-0.5" checked={(form.syllabusCodes || []).includes(opt.code)} onChange={(e) => setForm((prev) => ({ ...prev, syllabusCodes: e.target.checked ? [...new Set([...(prev.syllabusCodes || []), opt.code])] : (prev.syllabusCodes || []).filter((c) => c !== opt.code) }))} />
                  <span className="font-mono text-xs font-semibold text-[var(--color-indigo)]">{opt.code}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${opt.level === "HL" ? "bg-[var(--color-violet-soft)] text-[var(--color-violet)]" : "bg-[var(--color-teal-soft)] text-[var(--color-teal)]"}`}>{opt.level === "HL" ? "HL" : "SL + HL"}</span>
                  <span className="text-xs text-[var(--color-ink-soft)]">{opt.title}</span>
                </label>
              )) : <p className="px-2 py-1 text-xs text-[var(--color-ink-faint)]">No mapped syllabus codes for this topic.</p>}
            </div>
            {(form.syllabusCodes || []).length > 0 && <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Progress for this lesson will update: {form.syllabusCodes.join(", ")}</p>}
            {(form.syllabusCodes || []).some((code) => getSyllabusCodeOptions(form.parentTopic).find((opt) => opt.code === code)?.level === "HL") && form.level !== "HL" && (
              <p className="mt-1 rounded bg-[var(--color-amber-soft)] px-2 py-1 text-[11px] text-[var(--color-ink)]">This lesson maps at least one HL-only syllabus point. SL progress will automatically ignore those HL-only codes. If the whole lesson is AHL, set Student Access to “HL only”.</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Lesson Title</label>
            <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Student Access</label>
            <select className={inputCls} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="SL/HL">SL + HL — shared lesson</option>
              <option value="SL">SL core — also visible to HL</option>
              <option value="HL">HL only — hidden from SL</option>
            </select>
            <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">HL students always receive the SL course plus HL-only content. Use HL only for AHL lessons.</p>
          </div>
          <div>
            <label className={labelCls}>Lesson Order</label>
            <div className={`${inputCls} flex items-center text-sm text-[var(--color-ink-faint)]`}>
              Managed by drag-and-drop on the Learn Content lesson list
            </div>
          </div>
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-[var(--color-coral)]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Draft"}</Button>
          <Button variant="secondary" onClick={() => { setPreviewPage(0); setPreviewing(true); }} disabled={!currentPageId}><Eye size={14} /> Preview as Student</Button>
          <Button onClick={handlePublish} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}</Button>
        </div>
      </div>

      {/* Block canvas */}
      {currentPageId && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Lesson Blocks</h2>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={handleUndo} disabled={!undoStack.current.length} title="Undo (Ctrl/Cmd+Z)" className="flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-ink-soft)] disabled:opacity-35"><Undo2 size={13}/> Undo</button>
              <button type="button" onClick={handleRedo} disabled={!redoStack.current.length} title="Redo (Ctrl/Cmd+Shift+Z)" className="flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-ink-soft)] disabled:opacity-35"><Redo2 size={13}/> Redo</button>
              <button type="button" onClick={() => setShowDesignDefaults((v)=>!v)} className="flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-ink-soft)]"><SlidersHorizontal size={13}/> Design Defaults</button>
            </div>
          </div>
          {showDesignDefaults && <div className="mb-3 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
            <p className="mb-2 text-xs font-semibold text-[var(--color-ink)]">Defaults for new Learn blocks</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className={labelCls}>Image size<select className={inputCls} value={authorDefaults.imageWidth} onChange={(e)=>updateAuthorDefaults({imageWidth:e.target.value})}><option value="small">50%</option><option value="medium">70%</option><option value="large">85%</option><option value="full">100%</option></select></label>
              <label className={labelCls}>Image alignment<select className={inputCls} value={authorDefaults.imageAlignment} onChange={(e)=>updateAuthorDefaults({imageAlignment:e.target.value})}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
              <label className={labelCls}>Video size<select className={inputCls} value={authorDefaults.videoWidth} onChange={(e)=>updateAuthorDefaults({videoWidth:e.target.value})}><option value="small">50%</option><option value="medium">70%</option><option value="large">85%</option><option value="full">100%</option></select></label>
              <label className={labelCls}>Video alignment<select className={inputCls} value={authorDefaults.videoAlignment} onChange={(e)=>updateAuthorDefaults({videoAlignment:e.target.value})}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">Saved for this Admin profile. New media blocks use these values; individual blocks can override them.</p>
          </div>}
          <div className="space-y-2">
            {blocks.map((block, i) => (
              <div
                key={block.id}
                id={`learn-block-${block.id}`}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, i)}
                className={`rounded-md border bg-[var(--color-paper-raised)] ${block.visible ? "border-[var(--color-line)]" : "border-dashed border-[var(--color-line)] opacity-60"}`}
              >
                <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
                  <GripVertical size={14} className="cursor-grab text-[var(--color-ink-faint)]" />
                  <span className="min-w-0 leading-tight">
                    <span className="block text-xs font-semibold text-[var(--color-ink-soft)]">{getLearnBlockDisplayLabel(block).typeLabel}</span>
                    {getLearnBlockDisplayLabel(block).preview && <span className="block truncate text-[11px] text-[var(--color-ink-faint)]">{getLearnBlockDisplayLabel(block).preview}</span>}
                  </span>
                  {block.block_type === "check_understanding" && <span className="rounded bg-[var(--color-indigo-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-indigo)]">{checkQuestions.length} question{checkQuestions.length === 1 ? "" : "s"}</span>}
                  {(block.content?.audience === "hl") && <span className="rounded bg-[var(--color-violet-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-violet)]">HL only</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => setExpandedBlockId(expandedBlockId === block.id ? null : block.id)} className="rounded px-2 py-1 text-xs text-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">{expandedBlockId === block.id ? "Close" : "Edit"}</button>
                    <button type="button" title="Duplicate" onClick={() => handleDuplicate(block)} className="rounded p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40"><Copy size={13} /></button>
                    <button type="button" title={block.visible ? "Hide" : "Show"} onClick={() => handleToggleVisible(block)} className="rounded p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40">{block.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                    <button type="button" title="Delete" onClick={() => handleDelete(block.id)} className="rounded p-1.5 text-[var(--color-coral)] hover:bg-[var(--color-coral-soft)]"><Trash2 size={13} /></button>
                  </div>
                </div>
                {expandedBlockId === block.id && (
                  <div className="p-3">
                    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-ink)]">Block access</p>
                        <p className="text-[11px] text-[var(--color-ink-faint)]">HL students always see SL content too.</p>
                      </div>
                      <select className="ml-auto rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2 py-1.5 text-xs text-[var(--color-ink)]" value={block.content?.audience || "both"} onChange={(e) => handleUpdateBlockContent(block.id, { ...(block.content || {}), audience: e.target.value })}>
                        <option value="both">SL + HL</option>
                        <option value="hl">HL only</option>
                      </select>
                    </div>
                    {block.block_type === "check_understanding" ? (
                      <div className="rounded-md border border-[var(--color-indigo)]/25 bg-[var(--color-indigo-soft)] p-4">
                        <div className="mb-3">
                          <p className="text-sm font-bold text-[var(--color-ink)]">💡 Check Your Understanding</p>
                          <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Optional block — drag it anywhere in the lesson. Add questions from the bank or create manual questions with an optional uploaded image.</p>
                        </div>
                        <CheckQuestionPicker
                          selected={checkQuestions}
                          pageId={currentPageId}
                          onAdd={handleAddCheckQuestion}
                          onAddManual={handleAddManualQuestion}
                          onUpdateManual={handleUpdateManualQuestion}
                          onRemove={handleRemoveCheckQuestion}
                          onMove={handleMoveCheckQuestion}
                        />
                      </div>
                    ) : (
                      <BlockEditor blockType={block.block_type} content={block.content} pageId={currentPageId} blockId={block.id} onChange={(content) => handleUpdateBlockContent(block.id, content)} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="relative mt-3">
            <Button variant="secondary" onClick={() => setShowPicker((v) => !v)}><Plus size={14} /> Add Block</Button>
            {showPicker && (
              <div className="absolute z-10 mt-1 w-72 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 shadow-lg">
                {BLOCK_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="mb-2 last:mb-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{cat.label}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(BLOCK_TYPES).filter(([, t]) => t.category === cat.id).map(([type, t]) => (
                        <button key={type} type="button" onClick={() => handleAddBlock(type)} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-ink-soft)] hover:bg-[var(--color-indigo-soft)] hover:text-[var(--color-indigo)]">
                          <t.icon size={13} /> {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function CheckQuestionPicker({ selected, pageId, onAdd, onAddManual, onUpdateManual, onRemove, onMove }) {
  const [mode, setMode] = useState("bank");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editingManual, setEditingManual] = useState(null);

  async function handleSearch() {
    setSearching(true);
    try {
      const { rows } = await listQuestions({ filters: { search: query, status: "published" }, pageSize: 10 });
      setResults(rows);
    } finally {
      setSearching(false);
    }
  }

  async function editManual(item) {
    try {
      const secret = await getAdminManualCheckSecret(item.id);
      setEditingManual({
        item,
        initial: {
          questionType: item.question_type,
          questionText: item.question_text,
          options: Array.isArray(item.options) ? item.options : [],
          correctAnswerData: secret?.correctAnswerData ?? (item.question_type === "mcq" ? { type: "mcq", value: "" } : { type: "text", value: "", alternatives: [] }),
          explanation: secret?.explanation ?? "",
          stimulus: item.stimulus && typeof item.stimulus === "object" ? item.stimulus : {},
        },
      });
      setMode("manual");
    } catch (err) {
      // The page-level error handler is reserved for persistence errors;
      // a missing secret is rare and the form can still be recreated safely.
      setEditingManual({ item, initial: null });
      setMode("manual");
    }
  }

  return (
    <div className="mt-3">
      {selected.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {selected.map((q, index) => (
            <div key={`${q.source_type}-${q.id}`} className="light-surface flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs text-[#12161C]">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${q.source_type === "manual" ? "bg-[#F0EAF8] text-[#6D3FA3]" : "bg-[#EAEDFB] text-[#3654D6]"}`}>{q.source_type === "manual" ? "Manual" : "Question Bank"}</span>
              <span className="min-w-0 flex-1 truncate">
                {q.source_type === "manual" ? q.question_text : <span className="font-mono">{q.question_id}</span>}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} title="Move up" className="rounded p-1 text-[#4A5160] hover:bg-[#EEF1FB] disabled:opacity-25"><ArrowUp size={12} /></button>
                <button type="button" disabled={index === selected.length - 1} onClick={() => onMove(index, 1)} title="Move down" className="rounded p-1 text-[#4A5160] hover:bg-[#EEF1FB] disabled:opacity-25"><ArrowDown size={12} /></button>
                {q.source_type === "manual" && <button type="button" onClick={() => editManual(q)} title="Edit manual question" className="rounded p-1 text-[#3654D6] hover:bg-[#EAEDFB]"><Pencil size={12} /></button>}
                <button type="button" onClick={() => onRemove(q)} title="Remove" className="rounded p-1 text-[#B85C4A] hover:bg-[#F8ECE9]"><X size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => { setMode("bank"); setEditingManual(null); }} className={`rounded-md px-3 py-2 text-xs font-semibold ${mode === "bank" ? "bg-[#3654D6] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>From Question Bank</button>
        <button type="button" onClick={() => { setMode("manual"); setEditingManual(null); }} className={`rounded-md px-3 py-2 text-xs font-semibold ${mode === "manual" ? "bg-[#3654D6] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>+ Add Manual Question</button>
      </div>

      {mode === "bank" ? (
        <>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Search question bank by ID or text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
            <Button size="sm" variant="secondary" onClick={handleSearch} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search size={14} />}</Button>
          </div>
          {results.length > 0 && (
            <div className="light-surface mt-2 divide-y divide-[#DCE1F0] rounded-md border border-[#DCE1F0] bg-white text-[#12161C]">
              {results.map((q) => (
                <button key={q.id} type="button" onClick={() => onAdd(q)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-[#12161C] hover:bg-[#EAEDFB]">
                  <span><span className="font-mono">{q.id}</span> — {q.question_content?.slice(0, 80)}</span>
                  <Plus size={13} className="text-[#3654D6]" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <ManualQuestionForm
          key={editingManual?.item?.id || "new"}
          initial={editingManual?.initial}
          editing={Boolean(editingManual?.item)}
          pageId={pageId}
          mediaKey={editingManual?.item?.id || "draft"}
          onCancel={() => { setEditingManual(null); setMode("bank"); }}
          onSave={async (question) => {
            if (editingManual?.item) await onUpdateManual(editingManual.item, question);
            else await onAddManual(question);
            setEditingManual(null);
            setMode("bank");
          }}
        />
      )}
    </div>
  );
}

function ManualQuestionForm({ initial, editing, pageId, mediaKey, onSave, onCancel }) {
  const defaultOptions = ["A", "B", "C", "D"].map((id) => ({ id, text: "" }));
  const [questionType, setQuestionType] = useState(initial?.questionType || "mcq");
  const [questionText, setQuestionText] = useState(initial?.questionText || "");
  const [options, setOptions] = useState(initial?.options?.length ? initial.options : defaultOptions);
  const [correct, setCorrect] = useState(initial?.correctAnswerData?.value || "");
  const [alternatives, setAlternatives] = useState((initial?.correctAnswerData?.alternatives || []).join("; "));
  const [explanation, setExplanation] = useState(initial?.explanation || "");
  const [stimulus, setStimulus] = useState(initial?.stimulus || {});
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  function updateOption(index, text) {
    setOptions((prev) => prev.map((opt, i) => i === index ? { ...opt, text } : opt));
  }

  async function submit() {
    if (!questionText.trim()) { setLocalError("Enter the question text."); return; }
    if (stimulus?.src && !String(stimulus.alt || "").trim()) { setLocalError("Add alt text for the question image."); return; }
    if (questionType === "mcq") {
      const validOptions = options.filter((o) => o.text.trim());
      if (validOptions.length < 2) { setLocalError("Add at least two options."); return; }
      if (!correct || !validOptions.some((o) => o.id === correct)) { setLocalError("Select the correct option."); return; }
    } else if (!correct.trim()) { setLocalError("Enter the accepted answer."); return; }

    setSaving(true); setLocalError("");
    try {
      await onSave({
        questionType,
        questionText,
        options: questionType === "mcq" ? options.filter((o) => o.text.trim()) : [],
        correctAnswerData: questionType === "mcq"
          ? { type: "mcq", value: correct }
          : { type: "text", value: correct.trim(), alternatives: alternatives.split(";").map((v) => v.trim()).filter(Boolean) },
        explanation,
        stimulus: stimulus?.src ? { type: "image", src: stimulus.src, alt: stimulus.alt || "", caption: stimulus.caption || "" } : {},
      });
    } catch (err) {
      setLocalError(err.message || "Could not save this question.");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Question Type</label>
          <select className={inputCls} value={questionType} onChange={(e) => { setQuestionType(e.target.value); setCorrect(""); }}>
            <option value="mcq">Multiple Choice</option>
            <option value="short_answer">Short Answer</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Question</label>
          <EquationFriendlyField className={inputCls} rows={3} value={questionText} onChange={setQuestionText} placeholder="Type or paste the quick-check question — subscripts/superscripts from Word are preserved where possible" />
        </div>

        <div className="sm:col-span-2 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--color-ink)]">Question Image <span className="font-normal text-[var(--color-ink-faint)]">(optional)</span></p>
          <LearnMediaInput
            kind="image"
            pageId={pageId}
            blockId={`check-${mediaKey}`}
            url={stimulus?.src || ""}
            onUrlChange={(src) => setStimulus((prev) => src ? { ...prev, type: "image", src } : {})}
            label="Add by link or upload"
          />
          {stimulus?.src && (
            <div className="mt-3 space-y-2">
              <img src={stimulus.src} alt={stimulus.alt || "Question preview"} className="max-h-52 rounded-md border border-[var(--color-line)] bg-white object-contain" />
              <div><label className={labelCls}>Alt Text</label><input className={inputCls} value={stimulus.alt || ""} onChange={(e) => setStimulus((prev) => ({ ...prev, alt: e.target.value }))} placeholder="Describe the image for accessibility" /></div>
              <div><label className={labelCls}>Caption <span className="text-[var(--color-ink-faint)]">(optional)</span></label><input className={inputCls} value={stimulus.caption || ""} onChange={(e) => setStimulus((prev) => ({ ...prev, caption: e.target.value }))} onPaste={(e) => pasteEquationFriendly(e, stimulus.caption || "", (value) => setStimulus((prev) => ({ ...prev, caption: value })))} /></div>
            </div>
          )}
        </div>

        {questionType === "mcq" ? (
          <div className="space-y-2 sm:col-span-2">
            <label className={labelCls}>Options</label>
            {options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2">
                <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] text-xs font-semibold text-[var(--color-ink)]">
                  <input type="radio" className="sr-only" name="manual-correct" checked={correct === opt.id} onChange={() => setCorrect(opt.id)} />
                  {opt.id}{correct === opt.id ? " ✓" : ""}
                </label>
                <input className={inputCls} value={opt.text} onChange={(e) => updateOption(i, e.target.value)} onPaste={(e) => pasteEquationFriendly(e, opt.text, (value) => updateOption(i, value))} placeholder={`Option ${opt.id}`} />
              </div>
            ))}
            <p className="text-[11px] text-[var(--color-ink-faint)]">Click A/B/C/D to mark the correct answer.</p>
          </div>
        ) : (
          <>
            <div className="sm:col-span-2"><label className={labelCls}>Accepted Answer</label><input className={inputCls} value={correct} onChange={(e) => setCorrect(e.target.value)} onPaste={(e) => pasteEquationFriendly(e, correct, setCorrect)} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Alternative Accepted Answers <span className="text-[var(--color-ink-faint)]">(optional, separate with ;)</span></label><input className={inputCls} value={alternatives} onChange={(e) => setAlternatives(e.target.value)} onPaste={(e) => pasteEquationFriendly(e, alternatives, setAlternatives)} placeholder="e.g. solid; solid state" /></div>
          </>
        )}

        <div className="sm:col-span-2"><label className={labelCls}>Explanation / Feedback <span className="text-[var(--color-ink-faint)]">(optional)</span></label><EquationFriendlyField className={inputCls} rows={2} value={explanation} onChange={setExplanation} /></div>
      </div>
      {localError && <p className="mt-2 text-xs text-[var(--color-coral)]">{localError}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update Manual Question" : "Add Manual Question"}</Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
