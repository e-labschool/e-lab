import { FileText, Download, ExternalLink } from "lucide-react";
import Card from "../../../../components/ui/Card.jsx";
import Badge from "../../../../components/ui/Badge.jsx";

export default function ResourceCard({ resource }) {
  const isExternal = Boolean(resource.externalUrl);
  const href = isExternal ? resource.externalUrl : resource.filePath;

  return (
    <Card className="flex items-start gap-4 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--color-line)] text-[var(--color-ink-soft)]">
        <FileText size={18} strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">{resource.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{resource.description}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Badge tone="neutral">{resource.fileType}</Badge>
          <Badge tone="neutral">{resource.resourceType}</Badge>
          {resource.topic && <Badge tone="indigo">{resource.topic}</Badge>}
          {resource.fileSizeLabel && <Badge tone="neutral">{resource.fileSizeLabel}</Badge>}
        </div>
      </div>

      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        download={resource.downloadable && !isExternal ? true : undefined}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
        aria-label={isExternal ? `Open ${resource.title} (opens in a new tab)` : `Download ${resource.title}`}
      >
        {isExternal ? <ExternalLink size={14} /> : <Download size={14} />}
        {isExternal ? "Open" : "Download"}
      </a>
    </Card>
  );
}
