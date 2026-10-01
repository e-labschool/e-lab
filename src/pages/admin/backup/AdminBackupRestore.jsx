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
  FileArchive,
  Lock,
} from "lucide-react";
import Button from "../../../components/ui/Button.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { supabase } from "../../../lib/supabaseClient.js";
import { exportElabContent, downloadBackup, backupFileName } from "../../../lib/backup/exportContent.js";
import { validateBackup } from "../../../lib/backup/validateBackup.js";
import { planRestore, restoreElabContent } from "../../../lib/backup/restoreContent.js";
import { createDisasterBackup, downloadDisasterBackup, disasterBackupFileName } from "../../../lib/backup/disasterExport.js";
import { validateDisasterBackup } from "../../../lib/backup/disasterValidate.js";
import { planDisasterRestore, restoreDisasterBackup, buildIdentityMap } from "../../../lib/backup/disasterRestore.js";

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

const LIVE_STATUS_LABEL = {
  deployed: "Deployed",
  not_deployed: "Not deployed",
  error: "Error",
  not_evaluated: "Not evaluated",
};
const BACKUP_STATUS_LABEL = {
  exported: "Exported",
  not_deployed: "Not deployed (0 rows)",
  failed: "Failed",
  not_evaluated: "Not evaluated",
};
const TIER_LABEL = {
  required_live: "Core (required)",
  feature_deployed: "Feature (required)",
  not_deployed_if_missing: "Feature (may not be deployed)",
  optional: "Optional",
};

function DatasetReportTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
        Dataset reconciliation report
      </p>
      <div className="mt-1 max-h-72 overflow-auto rounded-md border border-[var(--color-line)]">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[var(--color-paper-raised)] text-[var(--color-ink-faint)]">
            <tr>
              <th className="px-2 py-1.5 font-medium">Dataset</th>
              <th className="px-2 py-1.5 font-medium">Classification</th>
              <th className="px-2 py-1.5 font-medium">Live status</th>
              <th className="px-2 py-1.5 font-medium">Backup status</th>
              <th className="px-2 py-1.5 font-medium">Rows</th>
              <th className="px-2 py-1.5 font-medium">Warning / error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.table} className="border-t border-[var(--color-line)] align-top">
                <td className="px-2 py-1.5 font-medium text-[var(--color-ink)]">{r.table}</td>
                <td className="px-2 py-1.5 text-[var(--color-ink-soft)]">{TIER_LABEL[r.deploymentTier] || r.deploymentTier}</td>
                <td className="px-2 py-1.5">
                  <span className={r.liveStatus === "error" ? "font-medium text-[#A5362A]" : r.liveStatus === "not_deployed" ? "text-amber-700" : "text-[var(--color-ink-soft)]"}>
                    {LIVE_STATUS_LABEL[r.liveStatus] || r.liveStatus}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <span className={r.backupStatus === "failed" ? "font-medium text-[#A5362A]" : r.backupStatus === "not_deployed" ? "text-amber-700" : "text-[var(--color-ink-soft)]"}>
                    {BACKUP_STATUS_LABEL[r.backupStatus] || r.backupStatus}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[var(--color-ink-soft)]">{r.rowCount}</td>
                <td className="px-2 py-1.5 text-[var(--color-ink-faint)]">{r.warning || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StorageReportTable({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Storage report</p>
      <div className="mt-1 max-h-72 overflow-auto rounded-md border border-[var(--color-line)]">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-[var(--color-paper-raised)] text-[var(--color-ink-faint)]">
            <tr>
              <th className="px-2 py-1.5 font-medium">Bucket</th>
              <th className="px-2 py-1.5 font-medium">Discovered</th>
              <th className="px-2 py-1.5 font-medium">Packaged</th>
              <th className="px-2 py-1.5 font-medium">Bytes</th>
              <th className="px-2 py-1.5 font-medium">Failed</th>
              <th className="px-2 py-1.5 font-medium">Checksum status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bucket} className="border-t border-[var(--color-line)] align-top">
                <td className="px-2 py-1.5 font-medium text-[var(--color-ink)]">{r.bucket}</td>
                <td className="px-2 py-1.5 text-[var(--color-ink-soft)]">{r.objectsDiscovered}</td>
                <td className="px-2 py-1.5 text-[var(--color-ink-soft)]">{r.objectsPackaged}</td>
                <td className="px-2 py-1.5 text-[var(--color-ink-soft)]">{(r.bytesPackaged / 1024).toFixed(1)} KB</td>
                <td className="px-2 py-1.5">
                  <span className={r.failedObjects > 0 ? "font-medium text-[#A5362A]" : "text-[var(--color-ink-soft)]"}>{r.failedObjects}</span>
                </td>
                <td className="px-2 py-1.5 text-[var(--color-ink-faint)]">{r.checksumStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SchemaRecoveryGapSection({ gaps }) {
  if (!gaps?.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
        Schema recovery gaps (no source-controlled migration)
      </p>
      <ul className="mt-1 space-y-1.5 text-xs text-[var(--color-ink-soft)]">
        {gaps.map((g) => (
          <li key={g.table} className="rounded-md border border-amber-300/60 bg-amber-50/60 p-2">
            <p className="font-medium text-[var(--color-ink)]">
              {g.table} — {g.observedThisRun === "confirmed_absent_on_this_project" ? "not present on this project" : g.observedThisRun === "readable_on_this_project" ? "live and backed up" : g.observedThisRun}
            </p>
            <p className="mt-0.5">{g.missingArtifact}</p>
            <p className="mt-0.5 text-[var(--color-ink-faint)]">{g.recommendation}</p>
          </li>
        ))}
      </ul>
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

// ==================== COMPLETE DISASTER RECOVERY (create) ====================

const DISASTER_INCLUDES = [
  "Learn content", "Questions", "Media files", "Content ordering", "Simulation references",
  "User application data", "Learning progress", "Assessment data", "Resource library metadata", "Required metadata",
];
const DISASTER_EXCLUDES = ["Passwords", "Sessions", "API secrets", "Service credentials"];

function DisasterBackupSection() {
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { zip, manifest, integrity, verification }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const outcome = await createDisasterBackup({ includeUserData: true, onProgress: setProgress });
      setResult(outcome);
    } catch (err) {
      setError(err.message || "Disaster backup failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleDownload() {
    if (result) await downloadDisasterBackup(result.zip, result.manifest);
  }

  const v = result?.verification;

  return (
    <div className={cardClasses}>
      <h2 className="flex items-center gap-2 font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
        <FileArchive size={18} /> Complete Disaster Recovery
      </h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Create a portable recovery package containing e-Lab's educational content, media and recoverable application data — a single
        .zip, not just a JSON dump of URLs.
      </p>

      <div className="mt-3 flex items-start gap-2 rounded-md border border-[#A5362A]/40 bg-[#A5362A]/5 p-3 text-xs text-[var(--color-ink-soft)]">
        <Lock size={14} className="mt-0.5 shrink-0 text-[#A5362A]" />
        <span>This backup contains user and student data. Store it securely. Only authorized administrators may create or restore it.</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Includes</p>
          <ul className="mt-1 space-y-0.5 text-sm text-[var(--color-ink-soft)]">
            {DISASTER_INCLUDES.map((i) => (
              <li key={i} className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600" /> {i}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#A5362A]">Does not include</p>
          <ul className="mt-1 space-y-0.5 text-sm text-[var(--color-ink-soft)]">
            {DISASTER_EXCLUDES.map((i) => (
              <li key={i} className="flex items-center gap-1.5">
                <XCircle size={13} className="text-[#A5362A]" /> {i}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Button className="mt-5" onClick={handleCreate} disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileArchive size={16} />}
        {busy ? progress || "Preparing…" : "Create Disaster Backup"}
      </Button>

      {error && (
        <p className="mt-3 flex items-start gap-2 text-sm text-[#A5362A]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            Backup created {new Date(result.manifest.createdAt).toLocaleString()} · file: {disasterBackupFileName(result.manifest)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatPill label="Pages" value={result.integrity.expectedCounts.pages} />
            <StatPill label="Blocks" value={result.integrity.expectedCounts.blocks} />
            <StatPill label="Media files" value={result.manifest.mediaFileCount} />
            <StatPill label="Users" value={result.integrity.expectedCounts.profiles ?? 0} />
            <StatPill label="Progress rows" value={result.integrity.expectedCounts.learning_progress ?? 0} />
            <StatPill label="Assessments" value={result.integrity.expectedCounts.student_challenges ?? 0} />
            <StatPill label="Size" value={`${(result.manifest.mediaTotalBytes / 1024).toFixed(0)} KB media`} />
            <StatPill label="Question Bank records" value={result.manifest.questionBankReport?.totalRecords ?? 0} />
            <StatPill label="Question Papers" value={result.manifest.questionPaperReport?.papers ?? 0} />
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Verification</p>
          <ul className="mt-1 text-sm">
            <CheckRow item={{ pass: v.databaseRecordsVerified, label: "Database records verified" }} />
            <CheckRow item={{ pass: v.relationshipsVerified, label: "Relationships verified", detail: v.relationshipWarnings.slice(0, 3).join("; ") }} />
            <CheckRow item={{ pass: v.mediaVerified, label: "Media verified", detail: v.mediaFailures.length ? `${v.mediaFailures.length} file(s) could not be downloaded` : "" }} />
            <CheckRow item={{ pass: v.checksumsVerified, label: "Checksums verified", detail: v.mediaMismatches.length ? `${v.mediaMismatches.length} mismatch(es)` : "" }} />
            <CheckRow item={{ pass: v.simulationsVerified, label: "Simulation references verified", detail: v.simulationWarnings?.slice(0, 3).join("; ") }} />
          </ul>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Disaster Recovery Schema Audit</p>
          <ul className="mt-1 space-y-0.5 text-sm text-[var(--color-ink-soft)]">
            <li>
              Required datasets: {result.manifest.schemaAudit?.requiredDatasets ?? 0} · Available:{" "}
              {result.manifest.schemaAudit?.requiredAvailable ?? "—"} · Missing required:{" "}
              <span className={result.manifest.schemaAudit?.requiredMissing ? "font-medium text-[#A5362A]" : ""}>
                {result.manifest.schemaAudit?.requiredMissing ?? "—"}
              </span>
            </li>
            <li>
              Feature datasets not deployed here: {result.manifest.schemaAudit?.featureNotDeployedDatasets ?? 0} · Available:{" "}
              {result.manifest.schemaAudit?.featureNotDeployedAvailable ?? "—"} · Absent:{" "}
              <span className={result.manifest.schemaAudit?.featureNotDeployedAbsent ? "font-medium text-amber-700" : ""}>
                {result.manifest.schemaAudit?.featureNotDeployedAbsent ?? "—"}
              </span>
            </li>
            <li>
              Optional datasets: {result.manifest.schemaAudit?.optionalDatasets ?? 0} · Available:{" "}
              {result.manifest.schemaAudit?.optionalAvailable ?? "—"} · Unavailable:{" "}
              {result.manifest.schemaAudit?.optionalUnavailable ?? "—"}
            </li>
            <li>
              Storage buckets: {result.manifest.schemaAudit?.storageBuckets ?? 0} ({result.manifest.schemaAudit?.storageBucketsRequired ?? 0} required)
            </li>
            <li>
              Simulation references: {result.manifest.schemaAudit?.simulationReferences ?? 0} · Implementations verified:{" "}
              {result.manifest.schemaAudit?.simulationImplementationsVerified ?? 0}
            </li>
            {result.manifest.schemaAudit?.note && <li className="text-xs text-[var(--color-ink-faint)]">{result.manifest.schemaAudit.note}</li>}
          </ul>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Simulations</p>
          <ul className="mt-1 space-y-0.5 text-sm text-[var(--color-ink-soft)]">
            <li>Referenced simulation blocks: {result.manifest.simulations?.referencedBlocks ?? 0}</li>
            <li>Unique simulations: {result.manifest.simulations?.uniqueSimulations ?? 0}</li>
            <li>Implementations verified: {result.manifest.simulations?.verifiedImplementations ?? 0}</li>
            <li className={result.manifest.simulations?.missingImplementations ? "font-medium text-[#A5362A]" : ""}>
              Missing: {result.manifest.simulations?.missingImplementations ?? 0}
            </li>
          </ul>
          {result.manifest.simulations?.missingImplementations > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-[#A5362A]">
              {result.manifest.simulations.items
                .filter((i) => i.status === "missing")
                .map((i) => (
                  <li key={i.simulationId} className="flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    simulationId "{i.simulationId}" is referenced by {i.referencedBlocks} block(s) but has no registered implementation.
                  </li>
                ))}
            </ul>
          )}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Application source</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Protected by Git repository (not duplicated into this package).</p>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Source/build version:{" "}
            {result.manifest.applicationSource?.identifier ?? "no version identifier available"}
            {result.manifest.applicationSource?.identifierType === "package-version" ? " (package.json version — no git commit hash was available at build time)" : ""}
          </p>

          {result.manifest.tablesSkipped?.some((s) => s.deploymentTier === "not_deployed_if_missing") && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">
                Feature datasets not deployed on this project
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-[var(--color-ink-soft)]">
                {result.manifest.tablesSkipped
                  .filter((s) => s.deploymentTier === "not_deployed_if_missing")
                  .map((s) => (
                    <li key={s.table} className="flex items-start gap-1.5">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                      <span>
                        <strong>{s.table}</strong> — {s.reason}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}

          {result.manifest.tablesSkipped?.some((s) => s.deploymentTier !== "not_deployed_if_missing") && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Optional tables skipped</p>
              <ul className="mt-1 space-y-0.5 text-sm text-[var(--color-ink-soft)]">
                {result.manifest.tablesSkipped
                  .filter((s) => s.deploymentTier !== "not_deployed_if_missing")
                  .map((s) => (
                    <li key={s.table} className="flex items-start gap-1.5">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                      <span>
                        <strong>{s.table}</strong> — {s.reason}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}

          <DatasetReportTable rows={result.manifest.datasetReport} />
          <StorageReportTable rows={result.manifest.storageReport} />
          <SchemaRecoveryGapSection gaps={result.manifest.schemaRecoveryGaps} />

          {!v.mediaVerified || !v.checksumsVerified ? (
            <p className="mt-3 flex items-start gap-2 text-sm font-medium text-[#A5362A]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> Verification did not fully pass — this backup is downloadable for
              inspection, but should not be treated as a guaranteed-complete disaster-recovery package until the issues above are
              resolved.
            </p>
          ) : (
            <Button className="mt-4" onClick={handleDownload}>
              <Download size={16} /> Download Disaster Backup
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== COMPLETE DISASTER RECOVERY (restore) ====================

const DSTEP = { IDLE: "idle", VALIDATED: "validated", PLANNED: "planned", RESTORING: "restoring", DONE: "done" };
const CONFIRM_PHRASE = "RESTORE ELAB";

function DisasterRestoreSection() {
  const [step, setStep] = useState(DSTEP.IDLE);
  const [fileName, setFileName] = useState("");
  const [validated, setValidated] = useState(null);
  const [plan, setPlan] = useState(null);
  const [identityMapText, setIdentityMapText] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep(DSTEP.IDLE);
    setFileName("");
    setValidated(null);
    setPlan(null);
    setIdentityMapText("");
    setConfirmText("");
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
      const v = await validateDisasterBackup(file);
      setValidated(v);
      setStep(DSTEP.VALIDATED);
      if (v.valid) {
        const p = await planDisasterRestore(v);
        setPlan(p);
        setIdentityMapText(JSON.stringify(buildIdentityMap(p.usersData), null, 2));
        setStep(DSTEP.PLANNED);
      }
    } catch (err) {
      setError(err.message || "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    setStep(DSTEP.RESTORING);
    setError(null);
    try {
      let identityMap = {};
      try {
        identityMap = JSON.parse(identityMapText || "{}");
      } catch {
        throw new Error("Identity map is not valid JSON — see the field above.");
      }
      const outcome = await restoreDisasterBackup(validated, {
        includeUserData: validated.manifest.includesUserData,
        identityMap,
        onProgress: setProgress,
      });
      setResult(outcome);
      setStep(DSTEP.DONE);
    } catch (err) {
      setError(err.message || "Restore failed.");
      setStep(DSTEP.PLANNED);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const canRestore = step === DSTEP.PLANNED && !busy && confirmText.trim() === CONFIRM_PHRASE;

  return (
    <div className={cardClasses}>
      <h2 className="flex items-center gap-2 font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
        <FileArchive size={18} /> Restore Disaster Backup
      </h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Select → read manifest → verify package → verify checksums → validate compatibility → show restore plan → your confirmation →
        restore → post-restore verification. Nothing is written until you confirm.
      </p>

      <div className="mt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-indigo)] hover:text-[var(--color-ink)]">
          <Upload size={16} />
          {fileName || "Select an e-Lab disaster backup file (.zip)"}
          <input type="file" accept=".zip,application/zip" className="hidden" onChange={handleFile} disabled={busy} />
        </label>
        {step !== DSTEP.IDLE && (
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

      {validated && (
        <div className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <p className={`text-sm font-semibold ${validated.valid ? "text-emerald-700" : "text-[#A5362A]"}`}>
            {validated.valid ? "✓ Valid e-Lab disaster backup" : "✗ This file failed validation — nothing will be modified"}
          </p>
          <ul className="mt-2 max-h-56 overflow-y-auto">
            {validated.checks.map((c) => (
              <CheckRow key={c.id} item={c} />
            ))}
          </ul>
        </div>
      )}

      {plan && validated?.valid && (
        <div className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
          <p className="text-sm font-medium text-[var(--color-ink)]">Restore plan</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[var(--color-ink-soft)] sm:grid-cols-4">
            <span>Backup date: {new Date(validated.manifest.createdAt).toLocaleDateString()}</span>
            <span>Version: {validated.manifest.disasterBackupVersion}</span>
            <span>Pages: {validated.manifest.recordCounts?.pages}</span>
            <span>Media: {validated.manifest.mediaFileCount}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatPill label="New pages" value={plan.contentPlan.summary.newPages} />
            <StatPill label="Existing matches" value={plan.contentPlan.summary.matchingPages} />
            <StatPill label="Profiles in file" value={plan.userSummary.totalProfiles} />
            <StatPill label="Same-id matches" value={plan.userSummary.matchingSameId} />
            {plan.questionBankSummary && <StatPill label="Questions in file" value={plan.questionBankSummary.questions} />}
            {plan.questionPaperSummary && <StatPill label="Papers in file" value={plan.questionPaperSummary.papers} />}
          </div>

          <p className="mt-4 flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#A5362A]" /> Current environment contains existing data.
            Restoration may replace existing records (content is restored in Replace mode; user data is upserted by identity map below).
          </p>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">
              Identity map (old user id → target user id already present in this project's auth.users). Defaults to "same id" — only
              correct if restoring into the same/preserved auth users. Edit if you re-invited users elsewhere; see
              docs/DISASTER_RECOVERY.md.
            </label>
            <textarea
              className="h-28 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 font-mono text-xs text-[var(--color-ink)]"
              value={identityMapText}
              onChange={(e) => setIdentityMapText(e.target.value)}
            />
          </div>

          <div className="mt-4 rounded-md border border-[#A5362A]/40 bg-[#A5362A]/5 p-3">
            <p className="flex items-start gap-2 text-sm font-medium text-[#A5362A]">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" /> Destructive restore — type {CONFIRM_PHRASE} to confirm.
            </p>
            <input
              className="mt-2 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm"
              placeholder={CONFIRM_PHRASE}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>

          <Button variant="danger" className="mt-4" onClick={handleRestore} disabled={!canRestore}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? progress || "Restoring…" : "Restore e-Lab"}
          </Button>
        </div>
      )}

      {step === DSTEP.DONE && result && (
        <div className="mt-4 rounded-md border border-emerald-600/40 bg-emerald-600/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} /> Restore complete
          </p>
          <ul className="mt-2 text-sm text-[var(--color-ink-soft)]">
            <li>Pages inserted: {result.contentResult.pagesInserted}, updated: {result.contentResult.pagesUpdated}</li>
            <li>Blocks inserted: {result.contentResult.blocksInserted}</li>
            {result.userDataResult && (
              <li>
                User data: {Object.entries(result.userDataResult)
                  .map(([t, c]) => `${t}: ${c.restored} restored / ${c.skippedNoIdentity} skipped`)
                  .join(" · ")}
              </li>
            )}
            {result.questionBankResult && (
              <li>
                Question Bank / Papers: {Object.entries(result.questionBankResult)
                  .map(([t, c]) => `${t}: ${c.restored} restored${c.tableMissing ? " (table missing — schema recovery gap)" : ""}`)
                  .join(" · ")}
              </li>
            )}
            <li>
              Media: {result.mediaResults.verified} verified / {result.mediaResults.uploaded} uploaded
              {result.mediaResults.failed.length ? ` — ${result.mediaResults.failed.length} FAILED (see below)` : ""}
            </li>
          </ul>
          {result.datasetsNotDeployed?.length > 0 && (
            <div className="mt-2 rounded-md border border-amber-600/40 bg-amber-600/5 p-2 text-xs text-[var(--color-ink-soft)]">
              <p className="font-medium text-amber-700">Skipped — not deployed in the source backup (0 rows, nothing to restore):</p>
              <ul className="mt-1 space-y-0.5">
                {result.datasetsNotDeployed.map((s) => (
                  <li key={s.table}>
                    <strong>{s.table}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.mediaResults.failed.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-[#A5362A]/40 p-2 text-xs text-[#A5362A]">
              {result.mediaResults.failed.map((f) => (
                <div key={`${f.bucket}/${f.path}`}>{f.bucket}/{f.path}: {f.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "content", label: "1. Educational Content" },
  { id: "disaster", label: "2. Complete Disaster Recovery" },
  { id: "restore", label: "3. Restore" },
];

export default function AdminBackupRestore() {
  const { isConfigured } = useAuth();
  const scopeLabel = useMemo(() => "Backup & Restore", []);
  const [tab, setTab] = useState("content");

  if (!isConfigured) {
    return <p className="p-10 text-sm text-[var(--color-ink-soft)]">Backup &amp; Restore requires Supabase to be connected.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{scopeLabel}</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Protect your e-Lab educational content with portable backups, and extend to a complete disaster-recovery package when you need
        more than content alone.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-[var(--color-indigo)] text-[var(--color-ink)]"
                : "text-[var(--color-ink-faint)] hover:text-[var(--color-ink-soft)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {tab === "content" && <BackupSection />}
        {tab === "disaster" && <DisasterBackupSection />}
        {tab === "restore" && (
          <>
            <RestoreSection />
            <DisasterRestoreSection />
          </>
        )}
      </div>
    </div>
  );
}
