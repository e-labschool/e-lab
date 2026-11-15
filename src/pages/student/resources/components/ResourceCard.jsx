import { FileText, Lock } from "lucide-react";
import Card from "../../../../components/ui/Card.jsx";
import Badge from "../../../../components/ui/Badge.jsx";
import ResourceActions from "../../../../components/resources/ResourceActions.jsx";

// Same two actions as ResourceRow (eye = View in a new tab, download button = Download); `download` is
// accessPolicy.checkAction(item, "download", ctx).  Locked resources keep the "Locked" indicator.
export default function ResourceCard({ resource, download }) {
  const isLocked = Boolean(resource.isLocked);

  return (
    <Card className="flex flex-wrap items-start gap-4 p-5">
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
          <Lock size={14} aria-hidden="true" /> Locked
        </span>
      ) : (
        <ResourceActions resource={resource} download={download} />
      )}
    </Card>
  );
}
