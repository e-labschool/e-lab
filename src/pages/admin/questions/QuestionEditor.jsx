import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Loader2, AlertTriangle, Eye, Plus, Trash2, Copy } from "lucide-react";
import { getQuestion, getAdminQuestionSecrets, saveQuestionWithSecrets } from "../../../lib/questionBankService.js";
import Button from "../../../components/ui/Button.jsx";
import EquationFriendlyField from "../../../components/admin/EquationFriendlyField.jsx";
import { getStimulusPlacement, withStimulusPlacement, STEM_SIDES, STEM_SIDE_LABELS, STEM_WIDTHS, STEM_WIDTH_LABELS } from "../../../lib/questionLayout.js";

// Lazy-loaded specifically because it pulls in the real StimulusRenderer
// (and, through it, all 30+ visual sub-renderer components) — required
// for "Admin preview = Student preview", per the brief, but Admin routes
// aren't otherwise code-split, so importing this eagerly would bundle
// every visual renderer into the JS needed for every Admin page, not
// just the question editor.
const VisualEditor = lazy(() => import("./VisualEditor.jsx"));
const StudentQuestionPreviewModal = lazy(() => import("./StudentQuestionPreviewModal.jsx"));
const StemPlacementPreview = lazy(() => import("./StemPlacementPreview.jsx"));

const LEVELS = ["SL", "HL", "SL/HL"];
const PAPERS = ["Paper 1A", "Paper 1B", "Paper 2"];
const QUESTION_TYPES = ["MCQ", "Calculation", "Short Response", "Extended Response", "Data-based"];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Challenge"];
const STATUSES = ["draft", "reviewed", "published", "archived"];

const inputClasses = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";
const labelClasses = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

const EMPTY_FORM = {
  id: "", curriculumSection: "Structure", topicCode: "", topicTitle: "", unitCode: "", unitTitle: "",
  concept: "", level: "SL", paper: "Paper 1A", questionType: "MCQ", difficulty: "Medium", marks: 1,
  commandTerms: "", tags: "", questionContent: "", visualData: null, parts: "", options: "",
  estimatedMinutes: "", dataBookletRequired: false, calculatorRequired: false, status: "draft",
  correctAnswerData: "", markscheme: "", explanation: "",
};

function jsonOrEmpty(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { throw new Error("Invalid JSON in one of the structured fields (visual data / parts / options / correct answer / markscheme)."); }
}
function jsonToText(value) {
  return value ? JSON.stringify(value, null, 2) : "";
}

// MCQ options are stored (and saved) as the exact same JSON-array-of-
// {id,text} shape the rest of the app already reads (QuestionRenderer.jsx,
// canonical import, etc) -- this editor is just a friendlier UI over that
// same `form.options` JSON-text field, not a parallel data model.
function parseOptionsArray(text) {
  if (!text) return [];
  try {
    const val = JSON.parse(text);
    if (!Array.isArray(val)) return [];
    return val.map((opt, i) => {
      const fallbackId = String.fromCharCode(65 + i);
      if (typeof opt === "string") {
        const m = opt.match(/^\s*([A-Z])(?:[.)]|\s*-)?\s*(.*)$/s);
        return { id: m?.[1] || fallbackId, text: m?.[2] ?? opt };
      }
      return { id: opt?.id || fallbackId, text: opt?.text ?? "" };
    });
  } catch {
    return [];
  }
}
function optionsArrayToText(arr) {
  return arr.length ? JSON.stringify(arr, null, 2) : "";
}

// Per-option scientific-content editor for MCQ answer choices -- reuses
// EquationFriendlyField (the exact same authoring component/toolbar/paste
// handling/live-preview the Question Content field and every Learn field
// use) instead of the previous raw-JSON textarea, so options support the
// same superscript/subscript/⟦math:...⟧/LaTeX authoring as everything
// else, with no parallel renderer or paste handler. `showToolbar={false}`
// keeps each row compact (a single small "Symbols / Equation" trigger is
// still available above the whole group) rather than four full toolbars.
function MCQOptionsEditor({ value, onChange }) {
  const options = parseOptionsArray(value);
  const rows = options.length ? options : ["A", "B", "C", "D"].map((id) => ({ id, text: "" }));

  function updateRows(nextRows) {
    onChange(optionsArrayToText(nextRows));
  }
  function updateOption(index, text) {
    const next = rows.map((opt, i) => (i === index ? { ...opt, text } : opt));
    updateRows(next);
  }
  function addOption() {
    const nextId = String.fromCharCode(65 + rows.length);
    updateRows([...rows, { id: nextId, text: "" }]);
  }
  function removeOption(index) {
    const next = rows.filter((_, i) => i !== index).map((opt, i) => ({ ...opt, id: String.fromCharCode(65 + i) }));
    updateRows(next);
  }

  return (
    <div className="space-y-2.5">
      {rows.map((opt, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 w-5 shrink-0 text-sm font-semibold text-[var(--color-ink-faint)]">{opt.id}</span>
          <div className="flex-1">
            <EquationFriendlyField
              value={opt.text}
              onChange={(next) => updateOption(i, next)}
              rows={1}
              className={`${inputClasses} min-h-[38px]`}
              aria-label={`Option ${opt.id} text`}
            />
          </div>
          {rows.length > 2 && (
            <button type="button" onClick={() => removeOption(i)} aria-label={`Remove option ${opt.id}`} className="mt-2 shrink-0 text-[var(--color-ink-faint)] hover:text-[var(--color-coral)]">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        {rows.length < 8 ? (
          <button type="button" onClick={addOption} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-indigo)] hover:underline">
            <Plus size={13} /> Add option
          </button>
        ) : <span />}
        <p className="text-[10px] text-[var(--color-ink-faint)]">Superscript/subscript, ⟦math:...⟧, \( \) and \[ \] all supported — same as Question Content. Use each option's "Symbols / Equation" button, or paste formatted text/equations directly.</p>
      </div>
    </div>
  );
}

export default function QuestionEditor() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !questionId;
  // "Duplicate question": /admin/question-bank/new?from=<id> pre-fills a NEW draft from an existing question (content and answer
  // key are read through the same secure paths as editing). Nothing is saved until the admin picks a new ID and presses Save.
  const copyFrom = isNew ? searchParams.get("from") : null;
  const sourceId = questionId ?? copyFrom;

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(Boolean(!isNew || copyFrom));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // If the secure secrets read fails for an EXISTING question, saving is
  // blocked outright — there is no "confirm overwrite" path anymore.
  // Silently proceeding with blank secret fields risked wiping a real
  // answer key; blocking the save is the only safe response to a failed
  // read, not a workaround to route around it.
  const [secretsLoadFailed, setSecretsLoadFailed] = useState(false);

  useEffect(() => {
    if (!sourceId) return;
    Promise.all([getQuestion(sourceId), getAdminQuestionSecrets(sourceId)])
      .then(([q, secrets]) => {
        setForm({
          id: copyFrom ? "" : q.id, curriculumSection: q.curriculum_section, topicCode: q.topic_code, topicTitle: q.topic_title,
          unitCode: q.unit_code, unitTitle: q.unit_title, concept: q.concept, level: q.level, paper: q.paper,
          questionType: q.question_type, difficulty: q.difficulty, marks: q.marks,
          commandTerms: (q.command_terms ?? []).join(", "), tags: (q.tags ?? []).join(", "),
          questionContent: q.question_content, visualData: q.visual_data ?? null,
          parts: jsonToText(q.parts), options: jsonToText(q.options),
          estimatedMinutes: q.estimated_minutes ?? "", dataBookletRequired: q.data_booklet_required,
          calculatorRequired: q.calculator_required, status: copyFrom ? "draft" : q.status,
          correctAnswerData: jsonToText(secrets?.correct_answer_data), markscheme: jsonToText(secrets?.markscheme),
          explanation: secrets?.explanation ?? "",
        });
      })
      .catch((err) => {
        setError(err.message || "Couldn't load this question.");
        setSecretsLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [sourceId, copyFrom]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    // Hard block, not a confirmable workaround: if this is an existing
    // question and its secrets could not be securely read, saving is
    // refused outright. There is no path that lets this proceed anyway.
    if ((!isNew || copyFrom) && secretsLoadFailed) {
      setError("Cannot save: the existing answer key could not be securely loaded, so saving is blocked to avoid overwriting it.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: form.id, curriculumSection: form.curriculumSection, topicCode: form.topicCode, topicTitle: form.topicTitle,
        unitCode: form.unitCode, unitTitle: form.unitTitle, concept: form.concept, level: form.level, paper: form.paper,
        questionType: form.questionType, difficulty: form.difficulty, marks: Number(form.marks),
        commandTerms: form.commandTerms.split(",").map((t) => t.trim()).filter(Boolean),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        questionContent: form.questionContent,
        visualData: form.visualData, parts: jsonOrEmpty(form.parts), options: jsonOrEmpty(form.options),
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
        dataBookletRequired: form.dataBookletRequired, calculatorRequired: form.calculatorRequired, status: form.status,
        correctAnswerData: jsonOrEmpty(form.correctAnswerData), markscheme: jsonOrEmpty(form.markscheme),
        explanation: form.explanation || null,
      };
      await saveQuestionWithSecrets(payload);
      navigate(`/admin/question-bank/${form.id}`);
    } catch (err) {
      setError(err.message || "Something went wrong saving this question.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <button type="button" onClick={() => navigate("/admin/question-bank")} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ChevronLeft size={15} /> Question Bank
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">{isNew ? (copyFrom ? "New Question (copy)" : "New Question") : `Edit ${form.id}`}</h1>
        {!isNew && <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/admin/question-bank/new?from=${encodeURIComponent(form.id)}`)}><Copy size={14} /> Duplicate question</Button>}
      </div>
      {copyFrom && <p role="status" className="mt-2 rounded-md bg-[var(--color-amber-soft)] px-3 py-2 text-xs text-[var(--color-ink)]">Copy of <span className="font-mono">{copyFrom}</span>. Nothing is saved yet: choose a new Question ID, review the content and answer key, then press Save. The copy starts as a draft.</p>}
      <nav aria-label="Jump to section" className="sticky top-0 z-10 -mx-1 mt-4 flex flex-wrap gap-1.5 bg-[var(--color-paper)]/95 px-1 py-2 backdrop-blur">
        {[["sec-identity", "Identity"], ["sec-metadata", "Assessment"], ["sec-content", "Question content"], ["sec-visual", "Visual & layout"], ["sec-answer", "Answer key"]].map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(id); if (el) { el.open = true; el.scrollIntoView({ block: "start" }); } }} className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-indigo)] hover:text-[var(--color-indigo)]">{label}</a>
        ))}
      </nav>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        <Section id="sec-identity" title="Identity & Classification">
          <Row>
            <Field label="Question ID"><input required disabled={!isNew} className={inputClasses} value={form.id} onChange={(e) => set("id", e.target.value)} placeholder="EL-S1-1-001" /></Field>
            <Field label="Status">
              <select className={inputClasses} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Curriculum Section">
              <select className={inputClasses} value={form.curriculumSection} onChange={(e) => set("curriculumSection", e.target.value)}>
                <option value="Structure">Structure</option>
                <option value="Reactivity">Reactivity</option>
              </select>
            </Field>
            <Field label="Concept"><input required className={inputClasses} value={form.concept} onChange={(e) => set("concept", e.target.value)} placeholder="s1-1-matter" /></Field>
          </Row>
          <Row>
            <Field label="Unit Code"><input required className={inputClasses} value={form.unitCode} onChange={(e) => set("unitCode", e.target.value)} placeholder="S1" /></Field>
            <Field label="Unit Title"><input required className={inputClasses} value={form.unitTitle} onChange={(e) => set("unitTitle", e.target.value)} placeholder="Structure 1" /></Field>
          </Row>
          <Row>
            <Field label="Topic Code"><input required className={inputClasses} value={form.topicCode} onChange={(e) => set("topicCode", e.target.value)} placeholder="S1.1" /></Field>
            <Field label="Topic Title"><input required className={inputClasses} value={form.topicTitle} onChange={(e) => set("topicTitle", e.target.value)} /></Field>
          </Row>
        </Section>

        <Section id="sec-metadata" title="Assessment Metadata">
          <Row>
            <Field label="Level">
              <select className={inputClasses} value={form.level} onChange={(e) => set("level", e.target.value)}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
            </Field>
            <Field label="Paper">
              <select className={inputClasses} value={form.paper} onChange={(e) => set("paper", e.target.value)}>{PAPERS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            </Field>
          </Row>
          <Row>
            <Field label="Question Type">
              <select className={inputClasses} value={form.questionType} onChange={(e) => set("questionType", e.target.value)}>{QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </Field>
            <Field label="Difficulty">
              <select className={inputClasses} value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            </Field>
          </Row>
          <Row>
            <Field label="Marks"><input required type="number" min={1} className={inputClasses} value={form.marks} onChange={(e) => set("marks", e.target.value)} /></Field>
            <Field label="Estimated Minutes"><input type="number" min={0} step="0.5" className={inputClasses} value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", e.target.value)} /></Field>
          </Row>
          <Row>
            <Field label="Command Terms (comma-separated)"><input className={inputClasses} value={form.commandTerms} onChange={(e) => set("commandTerms", e.target.value)} placeholder="State, Explain" /></Field>
            <Field label="Tags (comma-separated)"><input className={inputClasses} value={form.tags} onChange={(e) => set("tags", e.target.value)} /></Field>
          </Row>
          <Row>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]"><input type="checkbox" checked={form.dataBookletRequired} onChange={(e) => set("dataBookletRequired", e.target.checked)} /> Data booklet required</label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]"><input type="checkbox" checked={form.calculatorRequired} onChange={(e) => set("calculatorRequired", e.target.checked)} /> Calculator required</label>
          </Row>
        </Section>

        <Section id="sec-content" title="Question Content">
          <Field label="Question Content"><textarea required rows={4} className={inputClasses} value={form.questionContent} onChange={(e) => set("questionContent", e.target.value)} /></Field>
          {form.questionType === "MCQ" ? (
            <Field label="Answer Options (A/B/C/D)">
              <MCQOptionsEditor value={form.options} onChange={(v) => set("options", v)} />
            </Field>
          ) : (
            <Field label="Options (JSON array, MCQ only)"><textarea rows={3} className={`${inputClasses} font-mono text-xs`} value={form.options} onChange={(e) => set("options", e.target.value)} placeholder='[{"id":"A","text":"..."},{"id":"B","text":"..."}]' /></Field>
          )}
          <Field label="Parts (JSON array, multipart only)"><textarea rows={3} className={`${inputClasses} font-mono text-xs`} value={form.parts} onChange={(e) => set("parts", e.target.value)} placeholder='[{"id":"a","questionText":"...","marks":1}]' /></Field>
        </Section>

        <Suspense fallback={<div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>}>
          <div id="sec-visual" className="scroll-mt-16 space-y-6">
            {/* a visual swap rebuilds the object -- carry the saved placement over so it is never silently lost */}
            <VisualEditor questionId={form.id || "new-question"} content={form.visualData} onChange={(v) => set("visualData", v && form.visualData?.placement && !v.placement ? { ...v, placement: form.visualData.placement } : v)} />
            {form.visualData && typeof form.visualData === "object" && (
              <StemLayoutSection form={form} onChange={(v) => set("visualData", v)} />
            )}
          </div>
        </Suspense>

        <Section id="sec-answer" title="Answer Key & Marking (secret — never shown to students before submission)">
          {!isNew && secretsLoadFailed && (
            <div className="flex items-start gap-2 rounded-md bg-[var(--color-coral-soft)] p-3 text-xs text-[var(--color-coral)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">The existing answer key for this question could not be securely loaded.</p>
                <p className="mt-1">Saving this question is disabled to prevent accidentally overwriting its real answer key, markscheme, or explanation. Try reloading the page, or contact support if this persists.</p>
              </div>
            </div>
          )}
          <Field label="Correct Answer Data (JSON)"><textarea rows={3} className={`${inputClasses} font-mono text-xs`} value={form.correctAnswerData} onChange={(e) => set("correctAnswerData", e.target.value)} placeholder='{"type":"mcq","value":"B"}' /></Field>
          <Field label="Markscheme (JSON)"><textarea rows={3} className={`${inputClasses} font-mono text-xs`} value={form.markscheme} onChange={(e) => set("markscheme", e.target.value)} placeholder='{"points":[{"text":"...","marks":1}]}' /></Field>
          <Field label="Explanation"><textarea rows={3} className={inputClasses} value={form.explanation} onChange={(e) => set("explanation", e.target.value)} /></Field>
        </Section>

        {error && <p role="alert" className="text-sm text-[var(--color-coral)]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}><Eye size={15} /> Preview as Student</Button>
          <Button type="submit" disabled={saving || ((!isNew || Boolean(copyFrom)) && secretsLoadFailed)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Question"}</Button>
        </div>
      </form>

      {previewOpen && (
        <Suspense fallback={null}>
          <StudentQuestionPreviewModal question={form} onClose={() => setPreviewOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <details id={id} open className="scroll-mt-16 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
      <summary className="mb-4 cursor-pointer text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{title}</summary>
      <div className="space-y-4">{children}</div>
    </details>
  );
}

const choiceBtn = (on) => `min-h-9 rounded-md border px-3 py-1.5 text-xs font-semibold ${on ? "border-[var(--color-indigo)] bg-[var(--color-indigo)] text-white" : "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/40"}`;

/** Where the question's visual sits relative to the question text. Stored as visual_data.placement (see src/lib/questionLayout.js).
 * "Default" removes it, so the question renders exactly as before everywhere. */
function StemLayoutSection({ form, onChange }) {
  const stimulus = form.visualData;
  const placement = getStimulusPlacement(stimulus);
  const sideBySide = placement && (placement.side === "left" || placement.side === "right");
  const setPlacement = (next) => onChange(withStimulusPlacement(stimulus, next));
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" id="sec-layout" data-testid="stem-layout-section">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Visual placement</p>
      <p className="mb-3 text-xs text-[var(--color-ink-faint)]">Choose where the image or diagram sits next to the question text. Options, parts and answers always stay below. On phones a side-by-side placement stacks with the visual first. Default keeps today&apos;s layout.</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Visual position">
        <button type="button" aria-pressed={!placement} className={choiceBtn(!placement)} onClick={() => setPlacement(null)}>Default</button>
        {STEM_SIDES.map((side) => <button key={side} type="button" aria-pressed={placement?.side === side} className={choiceBtn(placement?.side === side)} onClick={() => setPlacement({ side, width: placement?.width ?? (side === "left" || side === "right" ? "half" : "full") })}>{STEM_SIDE_LABELS[side]}</button>)}
      </div>
      {sideBySide && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Visual width">
          <span className="mr-1 text-xs text-[var(--color-ink-soft)]">Visual width</span>
          {["third", "half", "twothirds"].map((w) => <button key={w} type="button" aria-pressed={placement.width === w} className={choiceBtn(placement.width === w)} onClick={() => setPlacement({ side: placement.side, width: w })}>{STEM_WIDTH_LABELS[w]} <span className="sr-only">({STEM_WIDTHS[w]} of 12 columns)</span></button>)}
        </div>
      )}
      <div className="mt-4">
        <p className="mb-1.5 text-[11px] font-medium text-[var(--color-ink-soft)]">Preview (student view)</p>
        <Suspense fallback={null}><StemPlacementPreview stimulus={stimulus} text={form.questionContent} questionId={form.id || "preview"} /></Suspense>
      </div>
    </div>
  );
}
function Row({ children }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({ label, children }) {
  return <div><label className={labelClasses}>{label}</label>{children}</div>;
}
