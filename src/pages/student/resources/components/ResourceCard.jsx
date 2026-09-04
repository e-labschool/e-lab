import { useState } from "react";
import { FileText, Download, ExternalLink, Lock, Loader2 } from "lucide-react";
import Card from "../../../../components/ui/Card.jsx";
import Badge from "../../../../components/ui/Badge.jsx";
import { openResource } from "../../../../lib/useVisibleResources.js";

// Extended (not replaced) to additionally support Supabase-backed
// resources, which carry `isLocked`/`needsSignedUrl` instead of a direct
// `filePath` — existing static entries (no isLocked, direct filePath or
// externalUrl) render exactly as before, unchanged.
export default function ResourceCard({ resource }) {
  const [opening, setOpening] = useState(false);
  const isExternal = Boolean(resource.externalUrl) && !resource.needsSignedUrl;
  const isLocked = Boolean(resource.isLocked);

  async function handleOpen(e) {
    if (!resource.needsSignedUrl && !isExternal) return; // plain <a href> already handles this case
    e.preventDefault();
    if (isLocked || opening) return;
    setOpening(true);
    try {
      await openResource(resource);
    } finally {
      setOpening(false);
    }
  }

  const usesAsyncOpen = resource.needsSignedUrl;
  const href = usesAsyncOpen ? "#" : (isExternal ? resource.externalUrl : resource.filePath);

  return (
    <Card className="flex items-start gap-4 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)]">
        <FileText size={18} strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--color-ink)]">
          {resource.title}
          {isLocked && <Lock size={13} className="shrink-0 text-[var(--color-amber)]" aria-label="Locked" />}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{resource.description}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Badge tone="neutral">{resource.fileType}</Badge>
          <Badge tone="neutral">{resource.resourceType}</Badge>
          {resource.topic && <Badge tone="indigo">{resource.topic}</Badge>}
          {resource.fileSizeLabel && <Badge tone="neutral">{resource.fileSizeLabel}</Badge>}
        </div>
      </div>

      {isLocked ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-faint)]">
          <Lock size={14} /> Locked
        </span>
      ) : (
        <a
          href={href}
          onClick={handleOpen}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          download={resource.downloadable && !isExternal && !usesAsyncOpen ? true : undefined}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
          aria-label={isExternal ? `Open ${resource.title} (opens in a new tab)` : `Download ${resource.title}`}
        >
          {opening ? <Loader2 size={14} className="animate-spin" /> : isExternal ? <ExternalLink size={14} /> : <Download size={14} />}
          {isExternal ? "Open" : "Download"}
        </a>
      )}
    </Card>
  );
}
