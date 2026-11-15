import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Download, Lock, Loader2 } from "lucide-react";
import { lockedActionCopy, ACTIONS } from "../../lib/access/accessPolicy.js";
import {
  viewResource, downloadResource, previewKind, isDownloadable, safeExternalUrl, fileTypeLabel, MSG,
} from "../../lib/resourceActions.js";

const ALLOWED = Object.freeze({ allowed: true, reason: "ok" });

const base = "relative inline-flex shrink-0 items-center justify-center rounded-md text-[var(--color-ink)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-paper)] aria-disabled:cursor-wait aria-disabled:opacity-60";
const regular = `${base} h-11 w-11 border border-[var(--color-line)] hover:border-[var(--color-ink)] hover:bg-[var(--color-line)]/20 sm:h-10 sm:w-10`;
const compact = `${base} h-11 w-11 text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/30 hover:text-[var(--color-ink)] sm:h-8 sm:w-8`;

/** Small modal in the style of the simulation "locked" screen: shown when Download is switched to Premium-only. */
function LockedDownloadDialog({ reason, onClose }) {
  const copy = lockedActionCopy(ACTIONS.DOWNLOAD, reason);
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} data-testid="download-locked-backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="dl-locked-title" data-locked-action="download" data-reason={reason}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-6 py-7 text-center shadow-lg">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FBF0E4] text-[#8F4A12]"><Lock size={22} aria-hidden="true" /></span>
        <h2 id="dl-locked-title" className="mt-3 font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">{copy.title}</h2>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{copy.body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {copy.cta && <Link to="/auth" className="inline-flex min-h-11 items-center rounded-md bg-[#2647C4] px-4 text-sm font-semibold text-white hover:bg-[#3654D6]">{copy.cta}</Link>}
          <button ref={closeRef} type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-md border border-[var(--color-ink)]/40 bg-[var(--color-paper-raised)] px-4 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)]">Close</button>
        </div>
      </div>
    </div>
  );
}

/**
 * The two file actions, side by side:
 *   eye      = VIEW in a new tab (never forces a download)
 *   download = DOWNLOAD (forced save).  Not shown for links to other websites.
 * `download` is accessPolicy.checkAction(item, 'download', ctx): when it says not allowed the button carries a lock and
 * opens the locked prompt instead (only possible once Premium AND "Downloads are Premium-only" are switched on).
 * Renders a button group plus an optional full-width message line, so the parent must be `flex flex-wrap`.
 * `compact` = the quieter admin-list styling.
 */
export default function ResourceActions({ resource, download = ALLOWED, compact: isCompact = false }) {
  const [busy, setBusyState] = useState(null); // 'view' | 'download' | null (for rendering)
  const busyRef = useRef(null); // same value, readable synchronously so a fast double-click cannot start two actions
  const setBusy = (v) => { busyRef.current = v; setBusyState(v); };
  const [message, setMessage] = useState(null); // { tone: 'error'|'info', text, offerDownload? }
  const [lockedOpen, setLockedOpen] = useState(false);
  const lockedTrigger = useRef(null);
  const cls = isCompact ? compact : regular;
  const title = resource.title;
  const kind = previewKind(resource);
  const external = kind === "external";
  const externalHref = external ? safeExternalUrl(resource.externalUrl) : null;
  const canSave = !external && isDownloadable(resource);
  const type = fileTypeLabel(resource);
  const downloadAllowed = download?.allowed !== false;

  async function onView() {
    if (busyRef.current) return;
    setMessage(null);
    if (kind === "download-only") {
      setMessage(downloadAllowed && canSave
        ? { tone: "info", text: MSG.notPreviewable, offerDownload: true }
        : { tone: "info", text: MSG.notPreviewableNoDownload });
      return;
    }
    setBusy("view");
    const res = await viewResource(resource); // opens the tab synchronously, before its first await
    setBusy(null);
    if (!res.ok) setMessage({ tone: "error", text: res.message });
  }

  async function runDownload() {
    if (busyRef.current) return;
    setMessage(null);
    setBusy("download");
    const res = await downloadResource(resource);
    setBusy(null);
    if (!res.ok) setMessage({ tone: "error", text: res.message });
  }

  const onDownload = () => {
    if (!downloadAllowed) { setLockedOpen(true); return; }
    return runDownload();
  };

  const viewLabel = kind === "download-only"
    ? `View ${title} — preview not available${type ? ` for ${type} files` : ""}, use Download`
    : `View ${title} in a new tab`;
  const viewTitle = kind === "download-only" ? `Can't be previewed in the browser${type ? ` (${type})` : ""} \u2014 use Download` : external ? "Open link in a new tab" : "View in a new tab";

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={`Actions for ${title}`} data-testid="resource-actions">
        {external ? (
          externalHref ? (
            <a href={externalHref} target="_blank" rel="noopener noreferrer" className={cls} aria-label={viewLabel} title={viewTitle} data-testid="resource-view" data-kind="external">
              <Eye size={isCompact ? 15 : 18} aria-hidden="true" />
            </a>
          ) : (
            <button type="button" aria-disabled="true" className={cls} aria-label={`View ${title} — this link isn't valid`} title="This link isn't valid"
              data-testid="resource-view" data-kind="external" onClick={() => setMessage({ tone: "error", text: MSG.badLink })}>
              <Eye size={isCompact ? 15 : 18} aria-hidden="true" />
            </button>
          )
        ) : (
          <button type="button" onClick={onView} className={`${cls} ${kind === "download-only" ? "opacity-70" : ""}`} aria-label={viewLabel} title={viewTitle}
            aria-disabled={busy === "view" ? "true" : undefined} aria-busy={busy === "view" ? "true" : undefined} data-testid="resource-view" data-kind={kind}>
            {busy === "view" ? <Loader2 size={isCompact ? 15 : 18} className="animate-spin" aria-hidden="true" /> : <Eye size={isCompact ? 15 : 18} aria-hidden="true" />}
          </button>
        )}

        {canSave && (
          <button type="button" ref={lockedTrigger} onClick={onDownload} className={cls}
            aria-label={downloadAllowed ? `Download ${title}` : `Download ${title} (Premium)`} title={downloadAllowed ? "Download" : "Download (Premium)"}
            aria-haspopup={downloadAllowed ? undefined : "dialog"}
            aria-disabled={busy === "download" ? "true" : undefined} aria-busy={busy === "download" ? "true" : undefined}
            data-testid="resource-download" data-locked={downloadAllowed ? undefined : "true"}>
            {busy === "download" ? <Loader2 size={isCompact ? 15 : 18} className="animate-spin" aria-hidden="true" /> : <Download size={isCompact ? 15 : 18} aria-hidden="true" />}
            {!downloadAllowed && <Lock size={10} aria-hidden="true" className="absolute bottom-1 right-1 rounded-full bg-[var(--color-paper-raised)] text-[var(--color-amber)]" />}
          </button>
        )}
      </div>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} data-testid="resource-action-message"
          className={`basis-full text-sm ${message.tone === "error" ? "text-[var(--color-coral)]" : "text-[var(--color-ink-soft)]"}`}>
          {message.text}
          {message.offerDownload && (
            <> <button type="button" onClick={runDownload} className="font-medium text-[var(--color-indigo)] underline underline-offset-2">Download instead</button></>
          )}
          {" "}<button type="button" onClick={() => setMessage(null)} className="text-xs text-[var(--color-ink-faint)] underline underline-offset-2" aria-label={`Dismiss message about ${title}`}>Dismiss</button>
        </p>
      )}

      {lockedOpen && <LockedDownloadDialog reason={download?.reason} onClose={() => { setLockedOpen(false); queueMicrotask(() => lockedTrigger.current?.focus()); }} />}
    </>
  );
}
