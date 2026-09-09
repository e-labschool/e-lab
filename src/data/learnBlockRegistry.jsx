import DOMPurify from "dompurify";
import LearnMediaInput from "../components/admin/LearnMediaInput.jsx";
import {
  Type, Image as ImageIcon, Video, FlaskConical, Box, PlayCircle,
  Lightbulb, BookMarked, AlertTriangle, Globe2, ListChecks, BarChart3,
  Columns2, HelpCircle, Beaker,
} from "lucide-react";

// ============================================================
// Registry — one entry per block type. Adding a new block type later
// means adding one entry here; nothing else needs to change.
// ============================================================
export const BLOCK_CATEGORIES = [
  { id: "content", label: "Content" },
  { id: "chemistry", label: "Chemistry" },
  { id: "teaching", label: "Teaching" },
];

export const BLOCK_TYPES = {
  rich_text: { label: "Rich Text", category: "content", icon: Type, defaultContent: { title: "", titleColor: "", html: "" } },
  image: { label: "Image", category: "content", icon: ImageIcon, defaultContent: { url: "", caption: "", alt: "", alignment: "center", width: "full" } },
  video: { label: "Video", category: "content", icon: Video, defaultContent: { url: "", caption: "" } },
  equation: { label: "Chemical Equation / Chemistry", category: "chemistry", icon: FlaskConical, defaultContent: { markup: "" } },
  molecule_3d: { label: "3D Molecule", category: "chemistry", icon: Box, defaultContent: { presetId: "" } },
  simulation: { label: "e-Lab Simulation", category: "chemistry", icon: PlayCircle, defaultContent: { simulationId: "" } },
  key_idea: { label: "Key Idea", category: "teaching", icon: Lightbulb, defaultContent: { text: "" } },
  definition: { label: "Definition", category: "teaching", icon: BookMarked, defaultContent: { term: "", definition: "" } },
  common_mistake: { label: "Common Mistake", category: "teaching", icon: AlertTriangle, defaultContent: { text: "" } },
  real_life: { label: "Real-Life Connection", category: "teaching", icon: Globe2, defaultContent: { title: "", content: "", imageUrl: "" } },
  worked_example: { label: "Worked Example", category: "teaching", icon: ListChecks, defaultContent: { question: "", steps: [], finalAnswer: "" } },
  data_graph: { label: "Data / Graph", category: "teaching", icon: BarChart3, defaultContent: { title: "", rows: [], explanation: "", prompt: "" } },
  compare_contrast: { label: "Compare & Contrast", category: "teaching", icon: Columns2, defaultContent: { columns: [{ title: "", content: "" }, { title: "", content: "" }] } },
  reveal_think: { label: "Reveal / Think", category: "teaching", icon: HelpCircle, defaultContent: { prompt: "", reveal: "" } },
  practical: { label: "Practical / Experiment", category: "teaching", icon: Beaker, defaultContent: { aim: "", apparatus: "", variables: "", method: "", safety: "", observations: "", data: "", analysis: "" } },
};

// Curated presets — Admin selects, never writes raw geometry config.
export const MOLECULE_PRESETS = {
  "ch4-tetrahedral": { label: "Methane (CH\u2084) \u2014 tetrahedral", geometry: "tetrahedral", centralLabel: "C", bondLabels: ["H", "H", "H", "H"] },
  "h2o-bent": { label: "Water (H\u2082O) \u2014 bent", geometry: "bent", centralLabel: "O", bondLabels: ["H", "H"] },
  "bf3-trigonal-planar": { label: "Boron trifluoride (BF\u2083) \u2014 trigonal planar", geometry: "trigonal-planar", centralLabel: "B", bondLabels: ["F", "F", "F"] },
  "nh3-trigonal-pyramidal": { label: "Ammonia (NH\u2083) \u2014 trigonal pyramidal", geometry: "trigonal-pyramidal", centralLabel: "N", bondLabels: ["H", "H", "H"] },
};

export const SIMULATION_REGISTRY = {
  "electron-configuration": { label: "Electron Configuration Explorer" },
  "vsepr-explorer-3d": { label: "VSEPR Explorer (3D)" },
  "explore-matter-and-states": { label: "Explore Matter & States" },
};

const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";

/** Converts simple chemistry markup (H_2O, SO_4^2-) into safe HTML with
 * real <sub>/<sup> tags — avoids a heavy LaTeX/MathJax dependency while
 * still covering formulae, charges, and isotope notation. */
export function renderChemMarkup(markup) {
  if (!markup) return "";
  const escaped = markup.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/_\{([^}]+)\}/g, "<sub>$1</sub>").replace(/_(\S)/g, "<sub>$1</sub>")
    .replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>").replace(/\^(\S)/g, "<sup>$1</sup>");
}

/** Compact rich-text toolbar using contentEditable + execCommand — real
 * formatting without pulling in a WYSIWYG library. Output is sanitized
 * with DOMPurify (already an existing dependency) before ever being
 * rendered to a student. */
export function RichTextEditor({ value, onChange }) {
  function exec(command, arg) {
    document.execCommand(command, false, arg);
  }
  function handleLink() {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-1">
        {[["Bold", "bold", "B"], ["Italic", "italic", "I"], ["Underline", "underline", "U"]].map(([t, cmd, label]) => (
          <button key={cmd} type="button" title={t} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(cmd)} className="rounded px-2 py-1 text-xs font-semibold hover:bg-[var(--color-line)]/40">{label}</button>
        ))}
        <button type="button" title="Heading" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "h3")} className="rounded px-2 py-1 text-xs font-semibold hover:bg-[var(--color-line)]/40">H</button>
        <button type="button" title="Subheading" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "h4")} className="rounded px-2 py-1 text-xs font-semibold hover:bg-[var(--color-line)]/40">h</button>
        <button type="button" title="Paragraph" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "p")} className="rounded px-2 py-1 text-xs hover:bg-[var(--color-line)]/40">P</button>
        <button type="button" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className="rounded px-2 py-1 text-xs hover:bg-[var(--color-line)]/40">\u2022 List</button>
        <button type="button" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")} className="rounded px-2 py-1 text-xs hover:bg-[var(--color-line)]/40">1. List</button>
        <button type="button" title="Superscript" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("superscript")} className="rounded px-2 py-1 text-xs hover:bg-[var(--color-line)]/40">x\u00b2</button>
        <button type="button" title="Subscript" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("subscript")} className="rounded px-2 py-1 text-xs hover:bg-[var(--color-line)]/40">x\u2082</button>
        <button type="button" title="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyLeft")} className="rounded px-2 py-1 text-xs hover:bg-[var(--color-line)]/40">\u2261L</button>
        <button type="button" title="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyCenter")} className="rounded px-2 py-1 text-xs hover:bg-[var(--color-line)]/40">\u2261C</button>
        <button type="button" title="Link" onMouseDown={(e) => e.preventDefault()} onClick={handleLink} className="rounded px-2 py-1 text-xs hover:bg-[var(--color-line)]/40">Link</button>
        <span className="mx-1 h-5 w-px bg-[var(--color-line)]" />
        <label className="flex items-center gap-1 px-1 text-[11px] text-[var(--color-ink-soft)]" title="Text colour">
          Colour
          <input type="color" defaultValue="#12161c" onChange={(e) => exec("foreColor", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-[var(--color-line)] bg-transparent p-0.5" />
        </label>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("removeFormat")} className="rounded px-2 py-1 text-[11px] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/40">Clear style</button>
      </div>
      <div
        contentEditable
        suppressContentEditableWarning
        className="min-h-[100px] rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none [&_h3]:text-lg [&_h3]:font-bold [&_h4]:text-base [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[var(--color-indigo)] [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: value }}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
}

// ============================================================
// Per-type editors — compact forms, not elaborate. Given `content` and
// `onChange(nextContent)`.
// ============================================================
export function BlockEditor({ blockType, content, onChange, pageId, blockId }) {
  const set = (key, value) => onChange({ ...content, [key]: value });

  switch (blockType) {
    case "rich_text":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Title <span className="text-[var(--color-ink-faint)]">(optional)</span></label>
            <div className="flex gap-2">
              <input className={inputCls} value={content.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Section title" />
              <label className="flex shrink-0 items-center gap-1 text-xs text-[var(--color-ink-soft)]">Colour <input type="color" value={content.titleColor || "#12161c"} onChange={(e) => set("titleColor", e.target.value)} className="h-9 w-10 rounded border border-[var(--color-line)] bg-transparent p-1" /></label>
            </div>
          </div>
          <div>
            <label className={labelCls}>Text</label>
            <RichTextEditor value={content.html ?? ""} onChange={(html) => set("html", html)} />
          </div>
        </div>
      );

    case "image":
      return (
        <div className="space-y-2">
          <LearnMediaInput kind="image" pageId={pageId} blockId={blockId} url={content.url ?? ""} onUrlChange={(url) => set("url", url)} label="Image" />
          <div><label className={labelCls}>Caption</label><input className={inputCls} value={content.caption} onChange={(e) => set("caption", e.target.value)} /></div>
          <div><label className={labelCls}>Alt text</label><input className={inputCls} value={content.alt} onChange={(e) => set("alt", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Alignment</label><select className={inputCls} value={content.alignment} onChange={(e) => set("alignment", e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
            <div><label className={labelCls}>Width</label><select className={inputCls} value={content.width} onChange={(e) => set("width", e.target.value)}><option value="small">Small</option><option value="medium">Medium</option><option value="full">Full</option></select></div>
          </div>
        </div>
      );

    case "video":
      return (
        <div className="space-y-2">
          <LearnMediaInput kind="video" pageId={pageId} blockId={blockId} url={content.url ?? ""} onUrlChange={(url) => set("url", url)} label="Video" />
          <div><label className={labelCls}>Caption</label><input className={inputCls} value={content.caption} onChange={(e) => set("caption", e.target.value)} /></div>
        </div>
      );

    case "equation":
      return (
        <div>
          <label className={labelCls}>Markup — use _2 for subscript, ^2- for superscript (e.g. SO_4^2-)</label>
          <input className={`${inputCls} font-mono`} value={content.markup} onChange={(e) => set("markup", e.target.value)} placeholder="H_2O + CO_2 -> H_2CO_3" />
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]" dangerouslySetInnerHTML={{ __html: renderChemMarkup(content.markup) }} />
        </div>
      );

    case "molecule_3d":
      return (
        <div>
          <label className={labelCls}>Molecule</label>
          <select className={inputCls} value={content.presetId} onChange={(e) => set("presetId", e.target.value)}>
            <option value="">Select a molecule</option>
            {Object.entries(MOLECULE_PRESETS).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
          </select>
        </div>
      );

    case "simulation":
      return (
        <div>
          <label className={labelCls}>Simulation</label>
          <select className={inputCls} value={content.simulationId} onChange={(e) => set("simulationId", e.target.value)}>
            <option value="">Select a simulation</option>
            {Object.entries(SIMULATION_REGISTRY).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
          </select>
        </div>
      );

    case "key_idea":
    case "common_mistake":
      return <textarea className={inputCls} rows={3} value={content.text} onChange={(e) => set("text", e.target.value)} />;

    case "definition":
      return (
        <div className="space-y-2">
          <div><label className={labelCls}>Term</label><input className={inputCls} value={content.term} onChange={(e) => set("term", e.target.value)} /></div>
          <div><label className={labelCls}>Definition</label><textarea className={inputCls} rows={2} value={content.definition} onChange={(e) => set("definition", e.target.value)} /></div>
        </div>
      );

    case "real_life":
      return (
        <div className="space-y-2">
          <div><label className={labelCls}>Title</label><input className={inputCls} value={content.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div><label className={labelCls}>Content</label><textarea className={inputCls} rows={3} value={content.content} onChange={(e) => set("content", e.target.value)} /></div>
          <LearnMediaInput kind="image" pageId={pageId} blockId={blockId} url={content.imageUrl ?? ""} onUrlChange={(url) => set("imageUrl", url)} label="Optional image" />
        </div>
      );

    case "worked_example":
      return <WorkedExampleEditor content={content} set={set} />;

    case "data_graph":
      return <DataGraphEditor content={content} set={set} />;

    case "compare_contrast":
      return <CompareContrastEditor content={content} set={set} />;

    case "reveal_think":
      return (
        <div className="space-y-2">
          <div><label className={labelCls}>Prompt (Think)</label><textarea className={inputCls} rows={2} value={content.prompt} onChange={(e) => set("prompt", e.target.value)} /></div>
          <div><label className={labelCls}>Reveal content</label><textarea className={inputCls} rows={2} value={content.reveal} onChange={(e) => set("reveal", e.target.value)} /></div>
        </div>
      );

    case "practical":
      return (
        <div className="space-y-2">
          {["aim", "apparatus", "variables", "method", "safety", "observations", "data", "analysis"].map((field) => (
            <div key={field}>
              <label className={labelCls}>{field[0].toUpperCase() + field.slice(1)} <span className="text-[var(--color-ink-faint)]">(leave blank to omit)</span></label>
              <textarea className={inputCls} rows={2} value={content[field]} onChange={(e) => set(field, e.target.value)} />
            </div>
          ))}
        </div>
      );

    default:
      return <p className="text-xs text-[var(--color-ink-faint)]">Unknown block type.</p>;
  }
}

function WorkedExampleEditor({ content, set }) {
  function updateStep(i, value) {
    const steps = [...content.steps];
    steps[i] = value;
    set("steps", steps);
  }
  return (
    <div className="space-y-2">
      <div><label className={labelCls}>Question / Problem</label><textarea className={inputCls} rows={2} value={content.question} onChange={(e) => set("question", e.target.value)} /></div>
      <div>
        <label className={labelCls}>Steps</label>
        {content.steps.map((step, i) => (
          <div key={i} className="mb-1.5 flex gap-2">
            <span className="mt-2 text-xs text-[var(--color-ink-faint)]">{i + 1}.</span>
            <textarea className={inputCls} rows={1} value={step} onChange={(e) => updateStep(i, e.target.value)} />
            <button type="button" onClick={() => set("steps", content.steps.filter((_, j) => j !== i))} className="text-xs text-[var(--color-coral)]">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => set("steps", [...content.steps, ""])} className="text-xs font-medium text-[var(--color-indigo)]">+ Add step</button>
      </div>
      <div><label className={labelCls}>Final Answer</label><input className={inputCls} value={content.finalAnswer} onChange={(e) => set("finalAnswer", e.target.value)} /></div>
    </div>
  );
}

function DataGraphEditor({ content, set }) {
  function updateRow(i, key, value) {
    const rows = content.rows.map((r, j) => (j === i ? { ...r, [key]: value } : r));
    set("rows", rows);
  }
  return (
    <div className="space-y-2">
      <div><label className={labelCls}>Title</label><input className={inputCls} value={content.title} onChange={(e) => set("title", e.target.value)} /></div>
      <div>
        <label className={labelCls}>Data (x, y pairs)</label>
        {content.rows.map((row, i) => (
          <div key={i} className="mb-1.5 flex gap-2">
            <input className={inputCls} placeholder="x" value={row.x ?? ""} onChange={(e) => updateRow(i, "x", e.target.value)} />
            <input className={inputCls} placeholder="y" value={row.y ?? ""} onChange={(e) => updateRow(i, "y", e.target.value)} />
            <button type="button" onClick={() => set("rows", content.rows.filter((_, j) => j !== i))} className="text-xs text-[var(--color-coral)]">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => set("rows", [...content.rows, { x: "", y: "" }])} className="text-xs font-medium text-[var(--color-indigo)]">+ Add data point</button>
      </div>
      <div><label className={labelCls}>Explanation</label><textarea className={inputCls} rows={2} value={content.explanation} onChange={(e) => set("explanation", e.target.value)} /></div>
      <div><label className={labelCls}>Optional student prompt</label><input className={inputCls} value={content.prompt} onChange={(e) => set("prompt", e.target.value)} /></div>
    </div>
  );
}

function CompareContrastEditor({ content, set }) {
  function updateColumn(i, key, value) {
    const columns = content.columns.map((c, j) => (j === i ? { ...c, [key]: value } : c));
    set("columns", columns);
  }
  return (
    <div className="space-y-2">
      {content.columns.map((col, i) => (
        <div key={i} className="rounded-md border border-[var(--color-line)] p-2">
          <input className={`${inputCls} mb-1.5 font-medium`} placeholder="Column title" value={col.title} onChange={(e) => updateColumn(i, "title", e.target.value)} />
          <textarea className={inputCls} rows={2} placeholder="Content" value={col.content} onChange={(e) => updateColumn(i, "content", e.target.value)} />
          {content.columns.length > 2 && <button type="button" onClick={() => set("columns", content.columns.filter((_, j) => j !== i))} className="mt-1 text-xs text-[var(--color-coral)]">Remove column</button>}
        </div>
      ))}
      <button type="button" onClick={() => set("columns", [...content.columns, { title: "", content: "" }])} className="text-xs font-medium text-[var(--color-indigo)]">+ Add column</button>
    </div>
  );
}

export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || "", { ADD_ATTR: ["style", "color"] });
}
