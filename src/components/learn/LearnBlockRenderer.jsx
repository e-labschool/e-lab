import { useState, lazy, Suspense } from "react";
import { Lightbulb, BookMarked, AlertTriangle, Globe2, Beaker, Columns2 } from "lucide-react";
import { sanitizeHtml, renderChemMarkup, MOLECULE_PRESETS } from "../../data/learnBlockRegistry.jsx";
import MoleculeViewer3D from "../3d/MoleculeViewer3D.jsx";
import ELabLoader from "../ui/ELabLoader.jsx";

const SIMULATION_COMPONENTS = {
  "electron-configuration": lazy(() => import("../../engines/electron-configuration/ElectronConfigurationExplorer.jsx")),
  "vsepr-explorer-3d": lazy(() => import("../../engines/vsepr-explorer-3d/VSEPRExplorer3D.jsx")),
  "explore-matter-and-states": lazy(() => import("../../engines/explore-matter-and-states/ExploreMatterAndStates.jsx")),
  "particle-model-visualizer": lazy(() => import("../../engines/particle-model-visualizer/ParticleModelVisualizer.jsx")),
  "phase-change-heating-curve": lazy(() => import("../../engines/phase-change-heating-curve/PhaseChangeHeatingCurve.jsx")),
};

export default function LearnBlockRenderer({ block }) {
  const c = block.content ?? {};

  switch (block.block_type) {
    case "rich_text":
      return (
        <section>
          {c.title && <h2 className="mb-2 text-xl font-semibold tracking-tight" style={c.titleColor ? { color: c.titleColor } : { color: "var(--color-ink)" }}>{c.title}</h2>}
          <div className="prose-sm max-w-none text-[var(--color-ink-soft)] [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[var(--color-ink)] [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-[var(--color-ink)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[var(--color-indigo)] [&_a]:underline" dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.html) }} />
        </section>
      );

    case "image":
      return (
        <figure className={c.alignment === "left" ? "text-left" : c.alignment === "right" ? "text-right" : "text-center"}>
          <img src={c.url} alt={c.alt || ""} className={`inline-block rounded-md ${c.width === "small" ? "max-w-xs" : c.width === "medium" ? "max-w-md" : "w-full"}`} />
          {c.caption && <figcaption className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{c.caption}</figcaption>}
        </figure>
      );

    case "video": {
      const url = c.url || "";
      const isDirectVideo = /\.(mp4|webm|mov)(\?|#|$)/i.test(url) || url.includes("/storage/v1/object/public/learn-media/");
      const embedUrl = toEmbedVideoUrl(url);
      if (!url) return <PlaceholderBlock label="Video not yet configured" />;
      return (
        <figure>
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
            {isDirectVideo ? (
              <video src={url} controls preload="metadata" className="h-full w-full object-contain" aria-label={c.caption || "Lesson video"} />
            ) : (
              <iframe src={embedUrl} title={c.caption || "Lesson video"} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />
            )}
          </div>
          {c.caption && <figcaption className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{c.caption}</figcaption>}
        </figure>
      );
    }

    case "equation":
      return <p className="rounded-md bg-[var(--color-paper)] px-4 py-3 text-center font-mono text-base text-[var(--color-ink)]" dangerouslySetInnerHTML={{ __html: renderChemMarkup(c.markup) }} />;

    case "molecule_3d": {
      const preset = MOLECULE_PRESETS[c.presetId];
      if (!preset) return <PlaceholderBlock label="3D molecule not yet configured" />;
      return <MoleculeViewer3D geometry={preset.geometry} centralLabel={preset.centralLabel} bondLabels={preset.bondLabels} height={320} />;
    }

    case "simulation": {
      const Sim = SIMULATION_COMPONENTS[c.simulationId];
      if (!Sim) return <PlaceholderBlock label="Simulation not yet configured" />;
      return (
        <Suspense fallback={<div className="flex justify-center py-8"><ELabLoader /></div>}>
          <Sim compact />
        </Suspense>
      );
    }

    case "key_idea":
      return (
        <div className="rounded-md border-l-4 border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-indigo)]"><Lightbulb size={13} /> Key Idea</p>
          <p className="mt-1.5 text-sm text-[var(--color-ink)]">{c.text}</p>
        </div>
      );

    case "definition":
      return (
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]"><BookMarked size={13} /> Definition</p>
          <p className="mt-1.5 font-semibold text-[var(--color-ink)]">{c.term}</p>
          <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{c.definition}</p>
        </div>
      );

    case "common_mistake":
      return (
        <div className="rounded-md border-l-4 border-[var(--color-amber)] bg-[var(--color-amber-soft)] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-amber)]"><AlertTriangle size={13} /> Common Mistakes / Misunderstandings</p>
          <p className="mt-1.5 text-sm text-[var(--color-ink)]">{c.text}</p>
        </div>
      );

    case "real_life":
      return (
        <div className="rounded-md border border-[var(--color-teal)]/30 bg-[var(--color-teal-soft)] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-teal)]"><Globe2 size={13} /> Real-Life Connection</p>
          {c.title && <p className="mt-1.5 font-semibold text-[var(--color-ink)]">{c.title}</p>}
          <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{c.content}</p>
          {c.imageUrl && <img src={c.imageUrl} alt="" className="mt-2 max-w-sm rounded-md" />}
        </div>
      );

    case "worked_example":
      return <WorkedExampleBlock content={c} />;

    case "data_graph":
      return <DataGraphBlock content={c} />;

    case "compare_contrast":
      return <CompareContrastBlock content={c} />;

    case "reveal_think":
      return <RevealThinkBlock content={c} />;

    case "practical":
      return <PracticalBlock content={c} />;

    case "page_break":
      return (
        <div className="my-2 flex items-center gap-3" aria-label="Page break">
          <div className="h-px flex-1 bg-[var(--color-line)]" />
          <span className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Page Break</span>
          <div className="h-px flex-1 bg-[var(--color-line)]" />
        </div>
      );

    default:
      return null;
  }
}

function PlaceholderBlock({ label }) {
  return <div className="flex items-center justify-center rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] p-8 text-xs text-[var(--color-ink-faint)]">{label}</div>;
}

function WorkedExampleBlock({ content }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const steps = content.steps ?? [];
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Worked Example</p>
      <p className="mt-1.5 text-sm font-medium text-[var(--color-ink)]">{content.question}</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[var(--color-ink-soft)]">
        {steps.slice(0, revealedCount).map((step, i) => <li key={i}>{step}</li>)}
      </ol>
      {revealedCount < steps.length ? (
        <button type="button" onClick={() => setRevealedCount((n) => n + 1)} className="mt-3 rounded-md bg-[var(--color-indigo)] px-3 py-1.5 text-xs font-medium text-white">Show Next Step</button>
      ) : content.finalAnswer && (
        <p className="mt-3 rounded-md bg-[var(--color-teal-soft)] px-3 py-2 text-sm font-medium text-[var(--color-teal)]">Final Answer: {content.finalAnswer}</p>
      )}
    </div>
  );
}

function DataGraphBlock({ content }) {
  const rows = (content.rows ?? []).filter((r) => r.x !== "" && r.y !== "");
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
      {content.title && <p className="font-semibold text-[var(--color-ink)]">{content.title}</p>}
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="text-sm">
            <tbody>
              <tr>{rows.map((r, i) => <td key={i} className="border border-[var(--color-line)] px-2 py-1 font-medium">{r.x}</td>)}</tr>
              <tr>{rows.map((r, i) => <td key={i} className="border border-[var(--color-line)] px-2 py-1">{r.y}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
      {content.explanation && <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{content.explanation}</p>}
      {content.prompt && <p className="mt-2 text-sm italic text-[var(--color-indigo)]">{content.prompt}</p>}
    </div>
  );
}

function CompareContrastGrid({ content }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-${Math.min(content.columns?.length ?? 2, 3)}`}>
      {(content.columns ?? []).map((col, i) => (
        <div key={i} className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
          <p className="font-semibold text-[var(--color-ink)]">{col.title}</p>
          <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">{col.content}</p>
        </div>
      ))}
    </div>
  );
}

function CompareContrastBlock({ content }) {
  const [open, setOpen] = useState(false);
  // Existing blocks saved before displayMode existed have no such key at
  // all — undefined must behave exactly like "inline" so nothing already
  // published silently changes appearance.
  const isReveal = content.displayMode === "reveal";

  if (!isReveal) return <CompareContrastGrid content={content} />;

  const buttonLabel = content.title ? `${content.title} \u2014 Compare & Contrast` : "Compare & Contrast";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-4 py-3 text-left text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]"
      >
        <Columns2 size={16} className="text-[var(--color-indigo)]" /> {buttonLabel}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-[var(--color-indigo)]/25 bg-[var(--color-indigo-soft)] p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]"><Columns2 size={15} className="text-[var(--color-indigo)]" /> {buttonLabel}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-[var(--color-indigo)]">Close</button>
      </div>
      <div className="mt-3">
        <CompareContrastGrid content={content} />
      </div>
    </div>
  );
}

function RevealThinkBlock({ content }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rounded-md border border-[var(--color-violet)]/30 bg-[var(--color-violet-soft)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-violet)]">Think</p>
      <p className="mt-1.5 text-sm text-[var(--color-ink)]">{content.prompt}</p>
      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} className="mt-3 rounded-md border border-[var(--color-violet)] px-3 py-1.5 text-xs font-medium text-[var(--color-violet)]">Reveal</button>
      ) : (
        <p className="mt-3 rounded-md bg-[var(--color-paper-raised)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">{content.reveal}</p>
      )}
    </div>
  );
}

function PracticalBlock({ content }) {
  const sections = ["aim", "apparatus", "variables", "method", "safety", "observations", "data", "analysis"].filter((f) => content[f]?.trim());
  if (sections.length === 0) return null;
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]"><Beaker size={13} /> Practical</p>
      <div className="mt-2 space-y-2.5">
        {sections.map((field) => (
          <div key={field}>
            <p className="text-xs font-semibold text-[var(--color-ink)]">{field[0].toUpperCase() + field.slice(1)}</p>
            <p className="text-sm text-[var(--color-ink-soft)]">{content[field]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


function toEmbedVideoUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) return url;
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (parsed.hostname === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("vimeo.com") && !parsed.hostname.includes("player.")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return url;
  }
  return url;
}
