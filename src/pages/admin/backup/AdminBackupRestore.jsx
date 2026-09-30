import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Upload,
  ShieldAlert,
  FileJson,
} from "lucide-react";
import Button from "../../../components/ui/Button.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { supabase } from "../../../lib/supabaseClient.js";
import { exportElabContent, downloadBackup, backupFileName } from "../../../lib/backup/exportContent.js";
import { validateBackup } from "../../../lib/backup/validateBackup.js";
import { planRestore, restoreElabContent } from "../../../lib/backup/restoreContent.js";

const cardClasses = "rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5";
const selectClasses =
  "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30";

function StatPill({ label, value }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-center">
      <p className="text-lg font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</p>
    </div>
  );
}

function CheckRow({ item }) {
  return (
    <li className="flex items-start gap-2 py-1 text-sm">
      {item.pass ? (
        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
      ) : (
        <XCircle size={15} className="mt-0.5 shrink-0 text-[#A5362A]" />
      )}
      <span className={item.pass ? "text-[var(--color-ink-soft)]" : "font-medium text-[#A5362A]"}>
        {item.label}
        {!item.pass && item.detail ? <span className="block text-xs text-[var(--color-ink-faint)]">{item.detail}</span> : null}
      </span>
    </li>
  );
}

// ==================== BACKUP / EXPORT ====================

function BackupSection() {
  const [topics, setTopics] = useState([]);
  const [scopeType, setScopeType] = useState("full");
  const [parentTopic, setParentTopic] = useState("");
  const [progress, setProgress] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("learn_pages")
      .select("parent_topic")
      .then(({ data }) => {
        const counts = new Map();
        for (const row of data || []) counts.set(row.parent_topic, (counts.get(row.parent_topic) || 0) + 1);
        const list = [...counts.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => a.topic.localeCompare(b.topic));
        setTopics(list);
        if (list.length) setParentTopic(list[0].topic);
      });
  }, []);

  async function handlePrepare() {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const scope = scopeType === "topic" ? { type: "topic", parentTopic } : { type: "full" };
      const backup = await exportElabContent({ scope, onProgress: setProgress });
      setPreview(backup);
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function handleDownload() {
    if (preview) downloadBackup(preview);
  }

  return (
    <div className={cardClasses}>
      <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">Backup &amp; Export</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Export a portable JSON backup of authored Learn content — pages, blocks, questions and media references. Student progress and
        accounts are never included.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Export scope</label>
          <select className={selectClasses} value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
            <option value="full">Full content backup (everything)</option>
            <option value="topic">Single topic / chapter</option>
          </select>
        </div>
        {scopeType === "topic" && (
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Topic</label>
            <select className={selectClasses} value={parentTopic} onChange={(e) => setParentTopic(e.target.value)}>
              {topics.map((t) => (
                <option key={t.topic} value={t.topic}>
                  {t.topic} ({t.count} page{t.count === 1 ? "" : "s"})
                </option>
              ))}
            </select>
          </div>
        )}
        <Button variant="secondary" onClick={handlePrepare} disabled={busy || (scopeType === "topic" && !parentTopic)}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FileJson size={16} />}
          {busy ? progress || "Preparing…" : "Prepare backup"}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-[#A5362A]">{error}</p>}

      {preview && (
        <div className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            Ready — {preview.scope.type === "full" ? "full content backup" : `topic: ${preview.scope.parentTopic}`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <StatPill label="Pages" value={preview.statistics.pages} />
            <StatPill label="Blocks" value={preview.statistics.blocks} />
            <StatPill label="Check Qs" value={preview.statistics.checkQuestions} />
            <StatPill label="Manual Qs" value={preview.statistics.manualQuestions} />
            <StatPill label="Media" value={preview.statistics.media} />
          </div>
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
            Exported {new Date(preview.exportedAt).toLocaleString()} · file: {backupFileName(preview)}
          </p>
          <Button className="mt-3" onClick={handleDownload}>
            <Download size={16} /> Download backup
          </Button>
        </div>
      )}
    </div>
  );
}

// ==================== RESTORE / IMPORT ====================

const STEP = { IDLE: "idle", VALIDATED: "validated", PREVIEWED: "previewed", RESTORING: "restoring", DONE: "done" };

function RestoreSection() {
  const [step, setStep] = useState(STEP.IDLE);
  const [fileName, setFileName] = useState("");
  const [backup, setBackup] = useState(null);
  const [validation, setValidation] = useState(null);
  const [plan, setPlan] = useState(null);
  const [mode, setMode] = useState("merge");
  const [snapshotDownloaded, setSnapshotDownloaded] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const replaceCount = plan?.matchingPages.length ?? 0;
  const needsSnapshot = mode === "replace" && replaceCount > 0;

  function reset() {
    setStep(STEP.IDLE);
    setFileName("");
    setBackup(null);
    setValidation(null);
    setPlan(null);
    setSnapshotDownloaded(false);
    setError(null);
    setResult(null);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setFileName(file.name);
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        setValidation({ valid: false, checks: [{ id: "json", label: "File parses as JSON", pass: false, detail: "This file is not valid JSON." }] });
        setStep(STEP.VALIDATED);
        return;
      }
      const v = validateBackup(parsed);
      setBackup(parsed);
      setValidation(v);
      setStep(STEP.VALIDATED);
      if (v.valid) {
        const p = await planRestore(parsed);
        setPlan(p);
        setStep(STEP.PREVIEWED);
      }
    } catch (err) {
      setError(err.message || "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadSnapshot() {
    setSnapshotBusy(true);
    setError(null);
    try {
      const pageIds = plan.matchingPages.map((m) => m.existing.id);
      const snapshot = await exportElabContent({ scope: { type: "pageIds", pageIds } });
      downloadBackup(snapshot);
      setSnapshotDownloaded(true);
    } catch (err) {
      setError(err.message || "Could not create the pre-restore snapshot.");
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    setStep(STEP.RESTORING);
    setError(null);
    try {
      const outcome = await restoreElabContent(backup, mode);
      setResult(outcome);
      setStep(STEP.DONE);
    } catch (err) {
      setError(err.message || "Restore failed. No changes were made outside this call (Postgres rolled back the whole operation).");
      setStep(STEP.PREVIEWED);
    } finally {
      setBusy(false);
    }
  }

  const canRestore = step === STEP.PREVIEWED && !busy && (!needsSnapshot || snapshotDownloaded);

  return (
    <div className={cardClasses}>
      <h2 className="font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">Restore &amp; Import</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Selecting a file never writes to the database. Every restore goes through: select → parse → validate → preview → your
        confirmation → restore.
      </p>

      <div className="mt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-indigo)] hover:text-[var(--color-ink)]">
          <Upload size={16} />
          {fileName || "Select an e-Lab backup file (.json)"}
          <input type="file" accept="application/json,.json" className="hidden" onChange={handleFile} disabled={busy} />
        </label>
        {step !== STEP.IDLE && (
          <button type="button" onClick={reset} className="ml-3 text-xs text-[var(--color-ink-faint)] underline">
            Choose a different file
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-sm text-[#A5362A]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {validation && (
        <div className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <p className={`text-sm font-semibold ${validation.valid ? "text-emerald-700" : "text-[#A5362A]"}`}>
            {validation.valid ? "✓ Valid e-Lab backup" : "✗ This file failed validation — nothing will be modified"}
          </p>
          <ul className="mt-2 max-h-56 overflow-y-auto">
            {validation.checks.map((c) => (
              <CheckRow key={c.id} item={c} />
            ))}
          </ul>
        </div>
      )}

      {plan && backup && validation?.valid && (
        <div className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <p className="text-sm font-medium text-[var(--color-ink)]">Restore preview</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[var(--color-ink-soft)] sm:grid-cols-4">
            <span>Backup version: {backup.backupVersion}</span>
            <span>Created: {new Date(backup.exportedAt).toLocaleDateString()}</span>
            <span>Scope: {backup.scope.type === "full" ? "Full" : backup.scope.parentTopic || backup.scope.type}</span>
            <span>Pages: {backup.statistics.pages}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatPill label="New pages" value={plan.summary.newPages} />
            <StatPill label="Existing matches" value={plan.summary.matchingPages} />
            <StatPill label="Blocks in file" value={backup.statistics.blocks} />
            <StatPill label="Media refs" value={backup.statistics.media} />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Restore mode</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className={`flex-1 cursor-pointer rounded-md border p-3 text-sm ${mode === "merge" ? "border-[var(--color-indigo)] bg-[var(--color-indigo)]/5" : "border-[var(--color-line)]"}`}>
                <input type="radio" name="mode" className="mr-2" checked={mode === "merge"} onChange={() => setMode("merge")} />
                <span className="font-medium text-[var(--color-ink)]">Merge</span>
                <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                  Imports the {plan.summary.newPages} page(s) in this backup that don't already exist (matched by topic + lesson code).
                  Never modifies an existing page.
                </p>
              </label>
              <label className={`flex-1 cursor-pointer rounded-md border p-3 text-sm ${mode === "replace" ? "border-[var(--color-indigo)] bg-[var(--color-indigo)]/5" : "border-[var(--color-line)]"}`}>
                <input type="radio" name="mode" className="mr-2" checked={mode === "replace"} onChange={() => setMode("replace")} />
                <span className="font-medium text-[var(--color-ink)]">Restore / Replace selected content</span>
                <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
                  Imports new pages AND replaces the {replaceCount} existing page(s) this backup also contains — their blocks and
                  questions are deleted and re-created from this file.
                </p>
              </label>
            </div>
          </div>

          {replaceCount > 0 && (
            <div className="mt-3 max-h-32 overflow-y-auto rounded-md border border-[var(--color-line)] p-2 text-xs text-[var(--color-ink-soft)]">
              {plan.matchingPages.map(({ backup: b, existing }) => (
                <div key={existing.id} className="flex justify-between py-0.5">
                  <span>{b.title}</span>
                  <span className="text-[var(--color-ink-faint)]">{existing.parent_topic} / {existing.lesson_code}</span>
                </div>
              ))}
            </div>
          )}

          {needsSnapshot && (
            <div className="mt-4 rounded-md border border-[#A5362A]/40 bg-[#A5362A]/5 p-3">
              <p className="flex items-start gap-2 text-sm font-medium text-[#A5362A]">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" /> Destructive operation — {replaceCount} existing page(s) will be
                replaced.
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                Download a pre-restore snapshot of exactly these pages before continuing, so they can be recovered if needed.
              </p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={handleDownloadSnapshot} disabled={snapshotBusy}>
                {snapshotBusy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {snapshotDownloaded ? "Snapshot downloaded ✓" : "Download pre-restore snapshot"}
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button variant={mode === "replace" ? "danger" : "primary"} onClick={handleRestore} disabled={!canRestore}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "merge" ? "Merge" : "Restore selected content"}
            </Button>
            {needsSnapshot && !snapshotDownloaded && (
              <span className="text-xs text-[var(--color-ink-faint)]">Download the snapshot above to enable this.</span>
            )}
          </div>
        </div>
      )}

      {step === STEP.DONE && result && (
        <div className="mt-4 rounded-md border border-emerald-600/40 bg-emerald-600/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} /> Restore complete
          </p>
          <ul className="mt-2 text-sm text-[var(--color-ink-soft)]">
            <li>Pages inserted: {result.pagesInserted}</li>
            <li>Pages updated (replaced): {result.pagesUpdated}</li>
            <li>Pages skipped (merge, already existed): {result.pagesSkipped}</li>
            <li>Blocks inserted: {result.blocksInserted}</li>
            <li>Check questions inserted: {result.checkQuestionsInserted} (skipped: {result.checkQuestionsSkipped})</li>
            <li>Manual questions inserted: {result.manualQuestionsInserted}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AdminBackupRestore() {
  const { isConfigured } = useAuth();
  const scopeLabel = useMemo(() => "Backup & Restore", []);

  if (!isConfigured) {
    return <p className="p-10 text-sm text-[var(--color-ink-soft)]">Backup &amp; Restore requires Supabase to be connected.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{scopeLabel}</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Protect your e-Lab educational content with portable backups.</p>

      <div className="mt-8 flex flex-col gap-6">
        <BackupSection />
        <RestoreSection />
      </div>
    </div>
  );
}
