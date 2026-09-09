import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, AlertTriangle } from "lucide-react";
import { getQuestion, getAdminQuestionSecrets, saveQuestionWithSecrets } from "../../../lib/questionBankService.js";
import Button from "../../../components/ui/Button.jsx";

// Lazy-loaded specifically because it pulls in the real StimulusRenderer
// (and, through it, all 30+ visual sub-renderer components) — required
// for "Admin preview = Student preview", per the brief, but Admin routes
// aren't otherwise code-split, so importing this eagerly would bundle
// every visual renderer into the JS needed for every Admin page, not
// just the question editor.
const VisualEditor = lazy(() => import("./VisualEditor.jsx"));

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

export default function QuestionEditor() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const isNew = !questionId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // If the secure secrets read fails for an EXISTING question, saving is
  // blocked outright — there is no "confirm overwrite" path anymore.
  // Silently proceeding with blank secret fields risked wiping a real
  // answer key; blocking the save is the only safe response to a failed
  // read, not a workaround to route around it.
  const [secretsLoadFailed, setSecretsLoadFailed] = useState(false);

  useEffect(() => {
    if (isNew) return;
    Promise.all([getQuestion(questionId), getAdminQuestionSecrets(questionId)])
      .then(([q, secrets]) => {
        setForm({
          id: q.id, curriculumSection: q.curriculum_section, topicCode: q.topic_code, topicTitle: q.topic_title,
          unitCode: q.unit_code, unitTitle: q.unit_title, concept: q.concept, level: q.level, paper: q.paper,
          questionType: q.question_type, difficulty: q.difficulty, marks: q.marks,
          commandTerms: (q.command_terms ?? []).join(", "), tags: (q.tags ?? []).join(", "),
          questionContent: q.question_content, visualData: q.visual_data ?? null,
          parts: jsonToText(q.parts), options: jsonToText(q.options),
          estimatedMinutes: q.estimated_minutes ?? "", dataBookletRequired: q.data_booklet_required,
          calculatorRequired: q.calculator_required, status: q.status,
          correctAnswerData: jsonToText(secrets?.correct_answer_data), markscheme: jsonToText(secrets?.markscheme),
          explanation: secrets?.explanation ?? "",
        });
      })
      .catch((err) => {
        setError(err.message || "Couldn't load this question.");
        setSecretsLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [questionId, isNew]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    // Hard block, not a confirmable workaround: if this is an existing
    // question and its secrets could not be securely read, saving is
    // refused outright. There is no path that lets this proceed anyway.
    if (!isNew && secretsLoadFailed) {
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
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">{isNew ? "New Question" : `Edit ${form.id}`}</h1>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        <Section title="Identity & Classification">
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

        <Section title="Assessment Metadata">
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

        <Section title="Question Content">
          <Field label="Question Content"><textarea required rows={4} className={inputClasses} value={form.questionContent} onChange={(e) => set("questionContent", e.target.value)} /></Field>
          <Field label="Options (JSON array, MCQ only)"><textarea rows={3} className={`${inputClasses} font-mono text-xs`} value={form.options} onChange={(e) => set("options", e.target.value)} placeholder='[{"id":"A","text":"..."},{"id":"B","text":"..."}]' /></Field>
          <Field label="Parts (JSON array, multipart only)"><textarea rows={3} className={`${inputClasses} font-mono text-xs`} value={form.parts} onChange={(e) => set("parts", e.target.value)} placeholder='[{"id":"a","questionText":"...","marks":1}]' /></Field>
        </Section>

        <VisualEditor questionId={form.id || "new-question"} content={form.visualData} onChange={(v) => set("visualData", v)} />

        <Suspense fallback={<div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>}>
          <VisualEditor questionId={form.id || "new-question"} content={form.visualData} onChange={(v) => set("visualData", v)} />
        </Suspense>

        <Section title="Answer Key & Marking (secret — never shown to students before submission)">
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
        <Button type="submit" disabled={saving || (!isNew && secretsLoadFailed)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Question"}</Button>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Row({ children }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({ label, children }) {
  return <div><label className={labelClasses}>{label}</label>{children}</div>;
}
