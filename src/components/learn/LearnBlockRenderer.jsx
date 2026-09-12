import { useState, useEffect, lazy, Suspense } from "react";
import { Lightbulb, BookMarked, AlertTriangle, Globe2, Beaker, Columns2, Link2, ArrowRight } from "lucide-react";
import { sanitizeHtml, renderChemMarkup, MOLECULE_PRESETS, getWorkedExampleSolution } from "../../data/learnBlockRegistry.jsx";
import { resolveMathAnnotationsInHtml } from "../admin/EquationFriendlyField.jsx";
import MoleculeViewer3D from "../3d/MoleculeViewer3D.jsx";
import ELabLoader from "../ui/ELabLoader.jsx";
import { findPublishedLessonBySyllabusCode } from "../../lib/learnContentService.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

const SIMULATION_COMPONENTS = {
  "electron-configuration": lazy(() => import("../../engines/electron-configuration/ElectronConfigurationExplorer.jsx")),
  "vsepr-explorer-3d": lazy(() => import("../../engines/vsepr-explorer-3d/VSEPRExplorer3D.jsx")),
  "explore-matter-and-states": lazy(() => import("../../engines/explore-matter-and-states/ExploreMatterAndStates.jsx")),
  "particle-model-visualizer": lazy(() => import("../../engines/particle-model-visualizer/ParticleModelVisualizer.jsx")),
  "phase-change-heating-curve": lazy(() => import("../../engines/phase-change-heating-curve/PhaseChangeHeatingCurve.jsx")),
  "ph-calculator-visualizer": lazy(() => import("../../engines/ph-calculator-visualizer/PHCalculatorVisualizer.jsx")),
  "h-oh-balance": lazy(() => import("../../engines/h-oh-balance/HOHBalance.jsx")),
};

export default function LearnBlockRenderer({ block }) {
  const c = block.content ?? {};

  switch (block.block_type) {
    case "rich_text": {
      const wrap = c.imageWrap || "right";
      return (
        <section className="after:block after:clear-both after:content-['']">
          {c.title && <h2 className="mb-2 text-xl font-semibold tracking-tight" style={{ color: c.titleColor || "#f08484" }}>{c.title}</h2>}
          {c.imageUrl && wrap !== "none" && <WrappedContentImage content={c} />}
          <div className="prose-sm max-w-none text-justify text-[var(--color-ink-soft)] [&_h3]:text-left [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[var(--color-ink)] [&_h4]:text-left [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-[var(--color-ink)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[var(--color-indigo)] [&_a]:underline [&_sub]:text-[0.75em] [&_sup]:text-[0.75em] [&_sub]:relative [&_sup]:relative [&_sub]:[line-height:0] [&_sup]:[line-height:0]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(resolveMathAnnotationsInHtml(c.html)) }} />
          {c.imageUrl && wrap === "none" && <WrappedContentImage content={c} />}
        </section>
      );
    }

    case "image": {
      const wrap = c.wrap || "none";
      const normalWidth = c.width === "small" ? "w-1/2" : c.width === "medium" ? "w-[70%]" : c.width === "full" ? "w-full" : "w-[85%]";
      const wrappedWidth = c.width === "small" ? "sm:w-1/3" : c.width === "medium" ? "sm:w-[42%]" : "sm:w-1/2";
      if (wrap !== "none") {
        return (
          <figure className={`mb-3 w-full sm:mb-2 ${wrappedWidth} ${wrap === "left" ? "sm:float-left sm:mr-5" : "sm:float-right sm:ml-5"}`}>
            <img src={c.url} alt={c.alt || ""} className="h-auto w-full rounded-md" />
            {c.caption && <figcaption className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{c.caption}</figcaption>}
          </figure>
        );
      }
      return (
        <figure className={c.alignment === "left" ? "text-left" : c.alignment === "right" ? "text-right" : "text-center"}>
          <img src={c.url} alt={c.alt || ""} className={`inline-block h-auto rounded-md ${normalWidth}`} />
          {c.caption && <figcaption className="mt-1.5 text-xs text-[var(--color-ink-faint)]">{c.caption}</figcaption>}
        </figure>
      );
    }

    case "video": {
      const url = c.url || "";
      const isDirectVideo = /\.(mp4|webm|mov)(\?|#|$)/i.test(url) || url.includes("/storage/v1/object/public/learn-media/");
      const embedUrl = toEmbedVideoUrl(url);
      if (!url) return <PlaceholderBlock label="Video not yet configured" />;
      const widthClass = c.width === "small" ? "w-1/2" : c.width === "medium" ? "w-[70%]" : c.width === "full" ? "w-full" : "w-[85%]";
      const alignClass = c.alignment === "left" ? "mr-auto" : c.alignment === "right" ? "ml-auto" : "mx-auto";
      return (
        <figure>
          <div className={`aspect-video overflow-hidden rounded-md bg-black ${widthClass} ${alignClass}`}>
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
      return <p className="rounded-md bg-[var(--color-paper)] px-4 py-3 text-center text-[15px] leading-relaxed text-[var(--color-ink)]" dangerouslySetInnerHTML={{ __html: renderChemMarkup(c.markup) }} />;

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
        <div className="rounded-md border-l-4 border-[#6d8cff] bg-[#6d8cff]/12 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#8da3ff]"><Lightbulb size={13} /> Key Idea</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--color-ink)]">{c.text}</p>
        </div>
      );

    case "definition":
      return (
        <div className="rounded-md border border-[#2dd4bf]/35 bg-[#2dd4bf]/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#45e0cd]"><BookMarked size={13} /> Definition</p>
          <p className="mt-1.5 font-semibold text-[var(--color-ink)]">{c.term}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-ink)]">{c.definition}</p>
        </div>
      );

    case "common_mistake":
      return (
        <div className="rounded-md border-l-4 border-[#f59e0b] bg-[#f59e0b]/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#f7b94a]"><AlertTriangle size={13} /> Common Mistakes / Misunderstandings</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--color-ink)]">{c.text}</p>
        </div>
      );

    case "real_life": {
      // Existing Real-Life images had no wrap metadata. Default them to a
      // compact right-side wrap so older lessons gain the new layout too.
      const wrap = c.imageWrap || "right";
      return (
        <div className="rounded-md border border-[#34d399]/30 bg-[#34d399]/10 p-4 after:block after:clear-both after:content-['']">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#5ee0ad]"><Globe2 size={13} /> Real-Life Connection</p>
          {c.title && <p className="mt-1.5 font-semibold text-[var(--color-ink)]">{c.title}</p>}
          {c.imageUrl && wrap !== "none" && <WrappedContentImage content={c} />}
          <p className="mt-0.5 whitespace-pre-wrap text-justify text-sm leading-relaxed text-[var(--color-ink-soft)]">{c.content}</p>
          {c.imageUrl && wrap === "none" && <WrappedContentImage content={c} />}
        </div>
      );
    }

    case "worked_example":
      return <WorkedExampleBlock content={c} />;

    case "data_graph":
      return <DataGraphBlock content={c} />;

    case "compare_contrast":
      return <CompareContrastBlock content={c} />;

    case "topic_link":
      return <TopicLinkBlock content={c} />;

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

function WrappedContentImage({ content }) {
  const wrap = content.imageWrap || "right";
  const width = content.imageWidth || "medium";
  const widthClass = width === "small" ? "sm:w-[30%]" : width === "large" ? "sm:w-1/2" : "sm:w-[40%]";
  const floatClass = wrap === "left"
    ? "sm:float-left sm:mr-5"
    : wrap === "right"
      ? "sm:float-right sm:ml-5"
      : "mx-auto";

  return (
    <figure className={`my-2 w-full ${wrap === "none" ? "max-w-xl" : widthClass} ${floatClass}`}>
      <img src={content.imageUrl} alt={content.imageAlt || ""} className="h-auto w-full rounded-md" />
      {content.imageCaption && <figcaption className="mt-1 text-xs leading-snug text-[var(--color-ink-faint)]">{content.imageCaption}</figcaption>}
    </figure>
  );
}

function TopicLinkBlock({ content }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const studentLevel = profile?.level;
  const [target, setTarget] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const code = String(content.targetCode || "").trim().toUpperCase();

  useEffect(() => {
    let active = true;
    setTarget(null);
    setUnavailable(false);
    if (!code) return () => { active = false; };
    findPublishedLessonBySyllabusCode(code, studentLevel)
      .then((lesson) => { if (!active) return; if (lesson) setTarget(lesson); else setUnavailable(true); })
      .catch(() => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, [code, studentLevel]);

  if (!code) return null;
  const align = content.alignment === "left" ? "justify-start" : content.alignment === "center" ? "justify-center" : "justify-end";
  const label = content.label?.trim() || `Revisit ${code}`;
  return (
    <div className={`flex ${align}`}>
      <button
        type="button"
        disabled={!target}
        onClick={() => target && navigate(`/student/learn/${target.id}`)}
        className="inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--color-indigo)]/30 bg-[var(--color-indigo-soft)] px-3 py-2 text-left text-xs font-semibold text-[var(--color-indigo)] shadow-sm transition hover:border-[var(--color-indigo)] disabled:cursor-default disabled:opacity-60"
        title={target ? `Open ${code}: ${target.title}` : unavailable ? `No published lesson currently covers ${code}` : `Finding ${code}…`}
      >
        <Link2 size={13} className="shrink-0" />
        <span className="truncate">{label}</span>
        <span className="font-mono text-[10px] opacity-75">{code}</span>
        <ArrowRight size={12} className="shrink-0" />
      </button>
    </div>
  );
}

function PlaceholderBlock({ label }) {
  return <div className="flex items-center justify-center rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] p-8 text-xs text-[var(--color-ink-faint)]">{label}</div>;
}

function WorkedExampleBlock({ content }) {
  const [revealed, setRevealed] = useState(false);
  const solution = getWorkedExampleSolution(content);
  // Undefined (every block saved before this existed) behaves exactly
  // like "direct" — nothing already published changes appearance.
  const isReveal = content.displayMode === "reveal";

  return (
    <div className="rounded-md border border-[#fb7185]/30 bg-[#fb7185]/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#ff8fa1]">Worked Example</p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm font-medium text-[var(--color-ink)]">{content.question}</p>

      {solution && (isReveal ? (
        <>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="mt-3 rounded-md bg-[var(--color-indigo)] px-3 py-1.5 text-xs font-medium text-white"
          >
            {revealed ? "Hide Solution" : "Show Solution"}
          </button>
          {revealed && (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Solution</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">{solution}</p>
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Solution</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">{solution}</p>
        </>
      ))}
    </div>
  );
}

function DataGraphBlock({ content }) {
  const rows = (content.rows ?? []).filter((r) => r.x !== "" && r.y !== "");
  return (
    <div className="rounded-md border border-[#22d3ee]/30 bg-[#22d3ee]/10 p-4">
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
      {content.explanation && <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">{content.explanation}</p>}
      {content.prompt && <p className="mt-2 whitespace-pre-wrap text-sm italic text-[var(--color-indigo)]">{content.prompt}</p>}
    </div>
  );
}

function CompareContrastGrid({ content }) {
  const table = content.table;
  if (table?.headers?.length && table?.rows?.length) {
    return (
      <div className="overflow-x-auto rounded-md border border-[#a78bfa]/30 bg-[#a78bfa]/8">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--color-indigo-soft)] text-[var(--color-ink)]">
            <tr>
              {table.headers.map((header, i) => (
                <th key={i} scope="col" className="border-b border-r border-[var(--color-line)] px-4 py-3 font-semibold last:border-r-0">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} className="text-[var(--color-ink-soft)]">
                {table.headers.map((_, c) => (
                  <td key={c} className={`whitespace-pre-wrap border-b border-r border-[var(--color-line)] px-4 py-3 align-top last:border-r-0 ${c === 0 ? "font-medium text-[var(--color-ink)]" : ""}`}>{row[c] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 sm:grid-cols-${Math.min(content.columns?.length ?? 2, 3)}`}>
      {(content.columns ?? []).map((col, i) => (
        <div key={i} className="rounded-md border border-[#a78bfa]/30 bg-[#a78bfa]/8 p-4">
          <p className="font-semibold text-[var(--color-ink)]">{col.title}</p>
          <p className="mt-1.5 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{col.content}</p>
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
        className="flex w-full items-center gap-2 rounded-md border border-[#a78bfa]/35 bg-[#a78bfa]/10 px-4 py-3 text-left text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]"
      >
        <Columns2 size={16} className="text-[var(--color-indigo)]" /> {buttonLabel}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-[#a78bfa]/35 bg-[#a78bfa]/10 p-4">
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
    <div className="rounded-md border border-[#c084fc]/35 bg-[#c084fc]/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#d29aff]">Think</p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--color-ink)]">{content.prompt}</p>
      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} className="mt-3 rounded-md border border-[var(--color-violet)] px-3 py-1.5 text-xs font-medium text-[var(--color-violet)]">Reveal</button>
      ) : (
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-[var(--color-paper-raised)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">{content.reveal}</p>
      )}
    </div>
  );
}

function PracticalBlock({ content }) {
  const sections = ["aim", "apparatus", "variables", "method", "safety", "observations", "data", "analysis"].filter((f) => content[f]?.trim());
  if (sections.length === 0) return null;
  return (
    <div className="rounded-md border border-[#fb923c]/30 bg-[#fb923c]/10 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#f7a85d]"><Beaker size={13} /> Practical</p>
      <div className="mt-2 space-y-2.5">
        {sections.map((field) => (
          <div key={field}>
            <p className="text-xs font-semibold text-[var(--color-ink)]">{field[0].toUpperCase() + field.slice(1)}</p>
            <p className="whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">{content[field]}</p>
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
