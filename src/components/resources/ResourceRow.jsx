import { FileText, FileSpreadsheet, Presentation, Link2, File as FileIcon, Lock } from "lucide-react";
import Badge from "../ui/Badge.jsx";
import ResourceActions from "./ResourceActions.jsx";

const TYPE_ICON = { PDF: FileText, DOCX: FileText, PPTX: Presentation, XLSX: FileSpreadsheet, Link: Link2 };

function formatAdded(iso, now = new Date()) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const opts = { day: "numeric", month: "short", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) };
  return d.toLocaleDateString("en-GB", opts);
}

/**
 * One file row with two separate actions (ResourceActions): the eye VIEWS the file in a new tab, the download button
 * DOWNLOADS it.  Locked resources show only a lock indicator, exactly as before.  `tierChip` is a string from
 * accessPolicy.tierBadge (or null); `blocked` means accessPolicy said no to viewing (never true while everything is
 * free); `download` is accessPolicy.checkAction(item, 'download', ctx) (never denied while everything is free).
 */
export default function ResourceRow({ resource, folderPath, tierChip = null, blocked = false, download }) {
  const isLocked = Boolean(resource.isLocked);
  const Icon = TYPE_ICON[resource.fileType] ?? FileIcon;
  const added = formatAdded(resource.createdAt);

  return (
    <li className="flex flex-wrap items-start gap-3 border-b border-[var(--color-line)] px-3 py-3 last:border-b-0 sm:gap-4 sm:px-4" data-testid="resource-row">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]">
        <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
          <span className="min-w-0 break-words">{resource.title}</span>
          {isLocked && <Lock size={13} className="shrink-0 text-[var(--color-amber)]" aria-label="Locked" />}
        </p>
        {resource.description && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-ink-soft)]">{resource.description}</p>}
        <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
          {[resource.fileType, resource.resourceType, added && `Added ${added}`, resource.fileSizeLabel].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {folderPath && <Badge tone="neutral" className="max-w-full"><span className="truncate">{folderPath}</span></Badge>}
          {resource.topic && <Badge tone="indigo">{resource.topic}</Badge>}
        </div>
      </div>
      {tierChip === "premium" && (
        <Badge tone="amber" className="shrink-0"><Lock size={11} aria-hidden="true" /> Premium</Badge>
      )}
      {isLocked || blocked ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink-faint)]">
          <Lock size={14} aria-hidden="true" /> Locked
        </span>
      ) : (
        <ResourceActions resource={resource} download={download} />
      )}
    </li>
  );
}
