import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { validateBatch } from "../../../lib/questionImportValidator.js";
import { classifyQuestionImport, bulkImportQuestions } from "../../../lib/questionBankService.js";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";

const EXAMPLE_JSON = `[
  {
    "id": "EL-S1-1-EXAMPLE-MCQ",
    "curriculumSection": "Structure",
    "unitCode": "S1", "unitTitle": "Structure 1",
    "topicCode": "S1.1", "topicTitle": "Introduction to the particulate nature of matter",
    "concept": "s1-1-matter",
    "level": "SL", "paper": "Paper 1A", "questionType": "MCQ", "difficulty": "Easy", "marks": 1,
    "commandTerms": ["State"], "tags": ["example"],
    "questionContent": "Which of the following best describes a pure substance?",
    "options": [{"id":"A","text":"Contains only one type of atom or molecule"},{"id":"B","text":"Contains two or more elements not chemically combined"}],
    "correctAnswerData": {"type":"mcq","value":"A"},
    "markscheme": {"points":[{"text":"Identifies single-particle-type definition","marks":1}]},
    "explanation": "A pure substance contains only one type of particle throughout.",
    "status": "draft"
  },
  {
    "id": "EL-S1-1-EXAMPLE-CALC",
    "curriculumSection": "Structure",
    "unitCode": "S1", "unitTitle": "Structure 1",
    "topicCode": "S1.1", "topicTitle": "Introduction to the particulate nature of matter",
    "concept": "s1-1-states-of-matter",
    "level": "SL", "paper": "Paper 2", "questionType": "Calculation", "difficulty": "Medium", "marks": 2,
    "commandTerms": ["Calculate"], "tags": ["example"],
    "questionContent": "Calculate the number of moles in 12.0 g of carbon (Ar = 12.0).",
    "correctAnswerData": {"type":"numeric","value":1.0,"tolerance":0.02},
    "markscheme": {"points":[{"text":"Correct method: n = m/M","marks":1},{"text":"Correct final answer with units","marks":1}]},
    "explanation": "n = 12.0 g / 12.0 g mol\\u207b\\u00b9 = 1.00 mol.",
    "status": "draft"
  }
]`;

export default function ImportQuestions() {
  const navigate = useNavigate();
  const [rawJson, setRawJson] = useState("");
  const [validated, setValidated] = useState(null); // array of { question, errors, isValid, action }
  const [confirmedIds, setConfirmedIds] = useState(new Set());
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawJson(String(reader.result));
    reader.readAsText(file);
  }

  async function handleValidate() {
    setError(null);
    setImportResult(null);
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) throw new Error("Top level JSON must be an array of question objects.");
    } catch (err) {
      setError(`Malformed JSON: ${err.message}`);
      setValidated(null);
      return;
    }

    setValidating(true);
    try {
      // Step 1: structural/schema validation only — no existing-row
      // comparison happens here at all anymore.
      const structural = validateBatch(parsed);

      // Step 2: authoritative NEW/UNCHANGED/UPDATE classification,
      // computed server-side against full content + secrets — requested
      // only for structurally valid questions, since an invalid question
      // can't be imported regardless of what it would classify as.
      const validQuestions = structural.filter((r) => r.isValid).map((r) => r.question);
      const classifications = validQuestions.length > 0 ? await classifyQuestionImport(validQuestions) : {};

      const results = structural.map((r) => ({
        ...r,
        action: r.isValid ? (classifications[r.question.id] ?? "new") : null,
      }));
      setValidated(results);
      setConfirmedIds(new Set()); // require re-confirming updates each validation pass
    } catch (err) {
      setError(err.message || "Couldn't classify questions against the existing bank.");
    } finally {
      setValidating(false);
    }
  }

  const allValid = validated?.every((r) => r.isValid) ?? false;
  const updateRows = validated?.filter((r) => r.isValid && r.action === "update") ?? [];
  const unconfirmedUpdates = updateRows.filter((r) => !confirmedIds.has(r.question.id));
  const toImport = validated?.filter((r) => r.isValid && r.action === "new") ?? [];
  const toImportWithConfirmedUpdates = [...toImport, ...updateRows.filter((r) => confirmedIds.has(r.question.id))];

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      await bulkImportQuestions(toImportWithConfirmedUpdates.map((r) => r.question));
      const newCount = validated.filter((r) => r.isValid && r.action === "new").length;
      const updatedCount = updateRows.filter((r) => confirmedIds.has(r.question.id)).length;
      const skippedCount = validated.filter((r) => r.isValid && r.action === "unchanged").length;
      setImportResult({ new: newCount, updated: updatedCount, skipped: skippedCount, failed: 0 });
      setValidated(null);
    } catch (err) {
      setError(err.message || "Import failed \u2014 no questions were changed (the whole batch rolls back together).");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <button type="button" onClick={() => navigate("/admin/question-bank")} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ChevronLeft size={15} /> Question Bank
      </button>
      <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Import Questions</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Paste or upload a JSON array of questions. Nothing is written until you review and confirm.</p>

      {importResult ? (
        <div className="mt-6 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-teal)]"><CheckCircle2 size={16} /> Import complete</p>
          <div className="mt-3 grid grid-cols-4 gap-3 text-center text-sm">
            <div><p className="font-bold text-[var(--color-ink)]">{importResult.new}</p><p className="text-xs text-[var(--color-ink-faint)]">New</p></div>
            <div><p className="font-bold text-[var(--color-ink)]">{importResult.updated}</p><p className="text-xs text-[var(--color-ink-faint)]">Updated</p></div>
            <div><p className="font-bold text-[var(--color-ink)]">{importResult.skipped}</p><p className="text-xs text-[var(--color-ink-faint)]">Unchanged/Skipped</p></div>
            <div><p className="font-bold text-[var(--color-ink)]">{importResult.failed}</p><p className="text-xs text-[var(--color-ink-faint)]">Failed</p></div>
          </div>
          <Button className="mt-5" onClick={() => navigate("/admin/question-bank")}>View Imported Questions</Button>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
            <div className="flex items-center justify-between">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--color-indigo)]">
                <Upload size={13} /> Upload JSON file
                <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
              </label>
              <button type="button" onClick={() => setRawJson(EXAMPLE_JSON)} className="text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
                Load example format (2 dummy questions \u2014 not inserted until you import)
              </button>
            </div>
            <textarea
              rows={10} value={rawJson} onChange={(e) => setRawJson(e.target.value)}
              placeholder="Paste a JSON array of questions here"
              className="mt-3 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 font-mono text-xs text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none"
            />
            <Button className="mt-3" variant="secondary" onClick={handleValidate} disabled={!rawJson.trim() || validating}>
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validate"}
            </Button>
          </div>

          {error && <p role="alert" className="mt-4 text-sm text-[var(--color-coral)]">{error}</p>}

          {validated && (
            <div className="mt-6">
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {validated.length} question{validated.length === 1 ? "" : "s"} detected \u2014 {validated.filter((r) => r.isValid).length} valid, {validated.filter((r) => !r.isValid).length} error{validated.filter((r) => !r.isValid).length === 1 ? "" : "s"}
              </p>

              <div className="mt-3 flex flex-col gap-2">
                {validated.map((r, i) => (
                  <div key={i} className={`rounded-md border p-3 text-sm ${r.isValid ? "border-[var(--color-line)]" : "border-[var(--color-coral)]/40 bg-[var(--color-coral-soft)]"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {r.isValid ? <CheckCircle2 size={14} className="text-[var(--color-teal)]" /> : <XCircle size={14} className="text-[var(--color-coral)]" />}
                        <span className="font-mono text-xs font-medium text-[var(--color-ink)]">{r.question.id || "(no id)"}</span>
                        <span className="text-xs text-[var(--color-ink-faint)]">{r.question.topicCode} \u00b7 {r.question.concept} \u00b7 {r.question.level} \u00b7 {r.question.paper} \u00b7 {r.question.questionType} \u00b7 {r.question.difficulty} \u00b7 {r.question.marks} marks \u00b7 {r.question.status}</span>
                      </div>
                      {r.isValid && (
                        <Badge tone={r.action === "new" ? "indigo" : r.action === "unchanged" ? "neutral" : "amber"}>
                          {r.action === "new" ? "NEW" : r.action === "unchanged" ? "UNCHANGED (will skip)" : "UPDATE"}
                        </Badge>
                      )}
                    </div>
                    {!r.isValid && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-[var(--color-coral)]">
                        {r.errors.map((e, j) => <li key={j}>{e}</li>)}
                      </ul>
                    )}
                    {r.isValid && r.action === "update" && (
                      <label className="mt-2 flex items-center gap-2 text-xs font-medium text-[var(--color-amber)]">
                        <input
                          type="checkbox" checked={confirmedIds.has(r.question.id)}
                          onChange={(e) => {
                            const next = new Set(confirmedIds);
                            if (e.target.checked) next.add(r.question.id); else next.delete(r.question.id);
                            setConfirmedIds(next);
                          }}
                        />
                        This will overwrite the existing published question \u2014 I confirm this update.
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {!allValid && (
                <p className="mt-4 flex items-center gap-1.5 text-sm text-[var(--color-coral)]"><AlertTriangle size={14} /> Fix all errors above before importing \u2014 a batch with any invalid question cannot be imported.</p>
              )}
              {allValid && unconfirmedUpdates.length > 0 && (
                <p className="mt-4 flex items-center gap-1.5 text-sm text-[var(--color-amber)]"><AlertTriangle size={14} /> Confirm {unconfirmedUpdates.length} update{unconfirmedUpdates.length === 1 ? "" : "s"} above before importing.</p>
              )}

              <Button className="mt-4" onClick={handleImport} disabled={!allValid || unconfirmedUpdates.length > 0 || importing || toImportWithConfirmedUpdates.length === 0}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Import ${toImportWithConfirmedUpdates.length} Question${toImportWithConfirmedUpdates.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
