// Renders an Admin-uploaded question image — responsive, preserves
// aspect ratio (no stretching), with a reasonable maximum size. If the
// image fails to load (broken URL, deleted storage object), falls back
// to the same "Visual unavailable" treatment as any other malformed
// visual — this component never lets a broken <img> crash or silently
// leave a blank hole.
import { useState } from "react";

export default function ImageDiagram({ src, alt, caption, credit }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-ink-faint)]">
        Visual unavailable
      </p>
    );
  }

  return (
    <figure className="flex flex-col items-center gap-1.5">
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className="max-h-[420px] w-auto max-w-full rounded-md object-contain"
      />
      {caption && <figcaption className="text-xs text-[var(--color-ink-faint)]">{caption}</figcaption>}
      {credit && <p className="text-[10px] text-[var(--color-ink-faint)]">Credit: {credit}</p>}
    </figure>
  );
}
