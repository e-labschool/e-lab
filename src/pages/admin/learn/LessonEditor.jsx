import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Plus, Loader2, GripVertical, Copy, Eye, EyeOff, Trash2, Search, X, ArrowUp, ArrowDown, Pencil,
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
import { BLOCK_TYPES, BLOCK_CATEGORIES, BlockEditor } from "../../../data/learnBlockRegistry.jsx";
import LearnBlockRenderer from "../../../components/learn/LearnBlockRenderer.jsx";
import CheckYourUnderstanding from "../../../components/learn/CheckYourUnderstanding.jsx";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";

const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

export default function LessonEditor() {
  const { pageId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !pageId;
  const parentTopics = getFlatParentTopics();

  const [form, setForm] = useState({
    parentTopic: searchParams.get("parentTopic") || parentTopics[0]?.id || "",
    lessonCode: "", title: "", level: "SL/HL", displayOrder: 0,
  });
  const [status, setStatus] = useState("draft");
  const [blocks, setBlocks] = useState([]);
  const [checkQuestions, setCheckQuestions] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [currentPageId, setCurrentPageId] = useState(pageId ?? null);

  useEffect(() => {
    if (isNew) return;
    Promise.all([getLesson(pageId), listBlocks(pageId), listCheckQuestions(pageId)])
      .then(([lesson, blockRows, checkRows]) => {
        setForm({ parentTopic: lesson.parent_topic, lessonCode: lesson.lesson_code, title: lesson.title, level: lesson.level, displayOrder: lesson.display_order });
        setStatus(lesson.status);
        setBlocks(blockRows);
        setCheckQuestions(checkRows);
      })
      .catch((err) => setError(err.message || "Couldn't load this lesson."))
      .finally(() => setLoading(false));
  }, [pageId, isNew]);

  async function ensurePageExists() {
    if (currentPageId) {
      await updateLesson(currentPageId, form);
      return currentPageId;
    }
    const created = await createLesson(form);
    setCurrentPageId(created.id);
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
    const created = await createBlock(currentPageId, { blockType, content: BLOCK_TYPES[blockType].defaultContent, position: blocks.length });
    setBlocks((prev) => [...prev, created]);
    setExpandedBlockId(created.id);
  }

  async function handleUpdateBlockContent(blockId, content) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
    await updateBlock(blockId, { content });
  }

  async function handleToggleVisible(block) {
    const visible = !block.visible;
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, visible } : b)));
    await updateBlock(block.id, { visible });
  }

  async function handleDuplicate(block) {
    const created = await createBlock(currentPageId, { blockType: block.block_type, content: block.content, position: blocks.length });
    setBlocks((prev) => [...prev, created]);
  }

  async function handleDelete(blockId) {
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
    const next = [...blocks];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setBlocks(next);
    reorderBlocks(next.map((b) => b.id));
  }

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
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button type="button" onClick={() => setPreviewing(false)} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
          <ChevronLeft size={15} /> Back to editor
        </button>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-amber)]">Preview as Student</p>
        <p className="font-mono text-xs text-[var(--color-indigo)]">{form.lessonCode}</p>
        <h1 className="mt-1 font-[var(--font-display)] text-[26px] font-bold text-[var(--color-ink)]">{form.title}</h1>
        <div className="mt-6 space-y-5">
          {blocks.filter((b) => b.visible).map((block) => <LearnBlockRenderer key={block.id} block={block} />)}
        </div>
        <CheckYourUnderstanding pageId={currentPageId} checkQuestions={checkQuestions} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <button type="button" onClick={() => navigate("/admin/learn-content")} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
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
              {parentTopics.map((t) => <option key={t.id} value={t.id}>{t.sectionLabel} \u2192 {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Syllabus / Lesson Code</label>
            <input className={inputCls} value={form.lessonCode} onChange={(e) => setForm({ ...form, lessonCode: e.target.value })} placeholder="S1.1.1" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Lesson Title</label>
            <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Level</label>
            <select className={inputCls} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="SL/HL">SL/HL</option><option value="SL">SL</option><option value="HL">HL</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Display Order</label>
            <input type="number" className={inputCls} value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
          </div>
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-[var(--color-coral)]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Draft"}</Button>
          <Button variant="secondary" onClick={() => setPreviewing(true)} disabled={!currentPageId}><Eye size={14} /> Preview as Student</Button>
          <Button onClick={handlePublish} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}</Button>
        </div>
      </div>

      {/* Block canvas */}
      {currentPageId && (
        <div className="mt-6">
          <div className="space-y-2">
            {blocks.map((block, i) => (
              <div
                key={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, i)}
                className={`rounded-md border bg-[var(--color-paper-raised)] ${block.visible ? "border-[var(--color-line)]" : "border-dashed border-[var(--color-line)] opacity-60"}`}
              >
                <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3 py-2">
                  <GripVertical size={14} className="cursor-grab text-[var(--color-ink-faint)]" />
                  <span className="text-xs font-semibold text-[var(--color-ink-soft)]">{BLOCK_TYPES[block.block_type]?.label ?? block.block_type}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => setExpandedBlockId(expandedBlockId === block.id ? null : block.id)} className="rounded px-2 py-1 text-xs text-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">{expandedBlockId === block.id ? "Close" : "Edit"}</button>
                    <button type="button" title="Duplicate" onClick={() => handleDuplicate(block)} className="rounded p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40"><Copy size={13} /></button>
                    <button type="button" title={block.visible ? "Hide" : "Show"} onClick={() => handleToggleVisible(block)} className="rounded p-1.5 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40">{block.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                    <button type="button" title="Delete" onClick={() => handleDelete(block.id)} className="rounded p-1.5 text-[var(--color-coral)] hover:bg-[var(--color-coral-soft)]"><Trash2 size={13} /></button>
                  </div>
                </div>
                {expandedBlockId === block.id && (
                  <div className="p-3">
                    <BlockEditor blockType={block.block_type} content={block.content} pageId={currentPageId} blockId={block.id} onChange={(content) => handleUpdateBlockContent(block.id, content)} />
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

          {/* Check Your Understanding config */}
          <div className="mt-8 rounded-md border border-[var(--color-indigo)]/25 bg-[var(--color-indigo-soft)] p-4">
            <p className="text-sm font-bold text-[var(--color-ink)]">💡 Check Your Understanding</p>
            <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">Mandatory system section — cannot be removed, only configured.</p>
            {error && <p role="alert" className="mt-2 text-xs text-[var(--color-coral)]">{error}</p>}
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

function ManualQuestionForm({ initial, editing, onSave, onCancel }) {
  const defaultOptions = ["A", "B", "C", "D"].map((id) => ({ id, text: "" }));
  const [questionType, setQuestionType] = useState(initial?.questionType || "mcq");
  const [questionText, setQuestionText] = useState(initial?.questionText || "");
  const [options, setOptions] = useState(initial?.options?.length ? initial.options : defaultOptions);
  const [correct, setCorrect] = useState(initial?.correctAnswerData?.value || "");
  const [alternatives, setAlternatives] = useState((initial?.correctAnswerData?.alternatives || []).join("; "));
  const [explanation, setExplanation] = useState(initial?.explanation || "");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  function updateOption(index, text) {
    setOptions((prev) => prev.map((opt, i) => i === index ? { ...opt, text } : opt));
  }

  async function submit() {
    if (!questionText.trim()) { setLocalError("Enter the question text."); return; }
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
          <textarea className={inputCls} rows={3} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Type the quick-check question" />
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
                <input className={inputCls} value={opt.text} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${opt.id}`} />
              </div>
            ))}
            <p className="text-[11px] text-[var(--color-ink-faint)]">Click A/B/C/D to mark the correct answer.</p>
          </div>
        ) : (
          <>
            <div className="sm:col-span-2"><label className={labelCls}>Accepted Answer</label><input className={inputCls} value={correct} onChange={(e) => setCorrect(e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Alternative Accepted Answers <span className="text-[var(--color-ink-faint)]">(optional, separate with ;)</span></label><input className={inputCls} value={alternatives} onChange={(e) => setAlternatives(e.target.value)} placeholder="e.g. solid; solid state" /></div>
          </>
        )}

        <div className="sm:col-span-2"><label className={labelCls}>Explanation / Feedback <span className="text-[var(--color-ink-faint)]">(optional)</span></label><textarea className={inputCls} rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} /></div>
      </div>
      {localError && <p className="mt-2 text-xs text-[var(--color-coral)]">{localError}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update Manual Question" : "Add Manual Question"}</Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
