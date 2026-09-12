import { useState, useRef } from "react";
import DOMPurify from "dompurify";
import LearnMediaInput from "../components/admin/LearnMediaInput.jsx";
import EquationFriendlyField, { pasteEquationFriendly, resolveMathAnnotationsInHtml } from "../components/admin/EquationFriendlyField.jsx";
import { getSyllabusCodeOptions } from "../lib/learn-tree.js";
import {
  Type, Image as ImageIcon, Video, FlaskConical, Box, PlayCircle,
  Lightbulb, BookMarked, AlertTriangle, Globe2, ListChecks, BarChart3,
  Columns2, HelpCircle, Beaker, Files, Link2,
  Bold, Italic, Underline, Superscript, Subscript,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Eraser,
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
  rich_text: { label: "Rich Text", category: "content", icon: Type, defaultContent: { title: "", titleColor: "#f08484", html: "" } },
  image: { label: "Image", category: "content", icon: ImageIcon, defaultContent: { url: "", caption: "", alt: "", alignment: "center", width: "large" } },
  video: { label: "Video", category: "content", icon: Video, defaultContent: { url: "", caption: "", alignment: "center", width: "large" } },
  equation: { label: "Chemical Equation / Chemistry", category: "chemistry", icon: FlaskConical, defaultContent: { markup: "" } },
  molecule_3d: { label: "3D Molecule", category: "chemistry", icon: Box, defaultContent: { presetId: "" } },
  simulation: { label: "e-Lab Simulation", category: "chemistry", icon: PlayCircle, defaultContent: { simulationId: "" } },
  key_idea: { label: "Key Idea", category: "teaching", icon: Lightbulb, defaultContent: { text: "" } },
  definition: { label: "Definition", category: "teaching", icon: BookMarked, defaultContent: { term: "", definition: "" } },
  common_mistake: { label: "Common Mistakes / Misunderstandings", category: "teaching", icon: AlertTriangle, defaultContent: { text: "" } },
  real_life: { label: "Real-Life Connection", category: "teaching", icon: Globe2, defaultContent: { title: "", content: "", imageUrl: "" } },
  worked_example: { label: "Worked Example", category: "teaching", icon: ListChecks, defaultContent: { question: "", solution: "", displayMode: "direct" } },
  data_graph: { label: "Data / Graph", category: "teaching", icon: BarChart3, defaultContent: { title: "", rows: [], explanation: "", prompt: "" } },
  compare_contrast: { label: "Compare & Contrast", category: "teaching", icon: Columns2, defaultContent: { title: "", displayMode: "inline", columns: [{ title: "", content: "" }, { title: "", content: "" }] } },
  reveal_think: { label: "Reveal / Think", category: "teaching", icon: HelpCircle, defaultContent: { prompt: "", reveal: "" } },
  practical: { label: "Practical / Experiment", category: "teaching", icon: Beaker, defaultContent: { aim: "", apparatus: "", variables: "", method: "", safety: "", observations: "", data: "", analysis: "" } },
  page_break: { label: "Page Break", category: "content", icon: Files, defaultContent: { label: "" } },
  check_understanding: { label: "Check Your Understanding", category: "teaching", icon: ListChecks, defaultContent: {} },
  topic_link: { label: "Linked Topic", category: "teaching", icon: Link2, defaultContent: { targetCode: "", label: "", alignment: "right" } },
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
  "particle-model-visualizer": { label: "Particle Model Visualizer" },
  "phase-change-heating-curve": { label: "Phase Change & Heating Curve" },
  "ph-calculator-visualizer": { label: "pH Calculator & Visualizer" },
  "h-oh-balance": { label: "H+ - OH- Balance in Water" },
};

// Strips HTML tags for a safe plain-text preview — never renders HTML
// inside an Admin list card, and never mutates the actual stored content.
function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text, max = 65) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}\u2026` : text;
}

/** Admin-only block card label — the block TYPE label always stays
 * visible; this derives a short, content-based preview underneath it so
 * multiple blocks of the same type are distinguishable at a glance.
 * Never alters the stored block content, purely a display derivation.
 * Uses the current block schema (BLOCK_TYPES content shape) as source of
 * truth — one field lookup per type, easy to extend alongside it. */
export function getLearnBlockDisplayLabel(block) {
  const typeLabel = BLOCK_TYPES[block.block_type]?.label ?? block.block_type;
  const c = block.content ?? {};
  let preview = "";

  switch (block.block_type) {
    case "rich_text":
      preview = c.title || stripHtml(c.html);
      break;
    case "image":
    case "video":
      preview = c.caption || "";
      break;
    case "key_idea":
    case "common_mistake":
      preview = c.text || "";
      break;
    case "definition":
      preview = c.term || "";
      break;
    case "real_life":
    case "data_graph":
    case "compare_contrast":
      preview = c.title || "";
      break;
    case "worked_example":
      preview = c.question || "";
      break;
    case "reveal_think":
      preview = c.prompt || "";
      break;
    case "practical":
      preview = c.aim || "";
      break;
    case "equation":
      preview = c.markup || "";
      break;
    case "molecule_3d":
      preview = MOLECULE_PRESETS[c.presetId]?.label || "";
      break;
    case "simulation":
      preview = SIMULATION_REGISTRY[c.simulationId]?.label || "";
      break;
    case "page_break":
      preview = c.label || "";
      break;
    case "topic_link":
      preview = c.label || c.targetCode || "";
      break;
    default:
      preview = "";
  }

  return { typeLabel, preview: truncate(preview) };
}

const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";
const equationInputPaste = (value, setter) => (e) => pasteEquationFriendly(e, value, setter);

/** Worked Example used to store { question, steps: [...], finalAnswer } —
 * now it's just { question, solution }. Old blocks are never rewritten in
 * place; this combines them into one solution string on the fly, both for
 * showing existing content in the (now single-field) editor and for
 * rendering it to students, so nothing old ever disappears. */
export function getWorkedExampleSolution(content) {
  if (content?.solution) return content.solution;
  const stepLines = (content?.steps ?? []).filter(Boolean);
  const parts = [...stepLines];
  if (content?.finalAnswer) parts.push(`Final answer: ${content.finalAnswer}`);
  return parts.join("\n");
}

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
const FORMAT_BLOCKS = [
  { label: "Paragraph", value: "p" },
  { label: "Heading", value: "h3" },
  { label: "Subheading", value: "h4" },
];
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];
const FONT_FAMILIES = [
  { label: "Default", value: "inherit" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
];
const QUICK_COLOURS = [
  ["#12161c", "Dark"], ["#3654D6", "Indigo"], ["#2B7A6E", "Teal"],
  ["#B7791F", "Amber"], ["#B85C4A", "Coral"], ["#6D3FA3", "Violet"],
];

/** An icon toolbar button with a real, human-readable tooltip (native
 * title attribute) — never a raw label like "\u2022 List" or "x\u00b2".
 * onMouseDown both prevents the default focus-steal AND saves the
 * current selection, so the click that follows always has something
 * valid to act on. */
function ToolbarButton({ label, icon: Icon, onClick, active = false, saveSelection }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => { e.preventDefault(); saveSelection?.(); }}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--color-line)]/40 ${active ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "text-[var(--color-ink-soft)]"}`}
    >
      <Icon size={15} />
    </button>
  );
}

/** The old implementation called document.execCommand("foreColor"/etc)
 * directly from a native <input type="color">'s onChange. That's the bug:
 * opening the native colour picker (or any <select>) steals focus from
 * the contentEditable, and by the time onChange fires the browser has
 * already collapsed/lost the text selection that was supposed to be
 * coloured — execCommand then has nothing to apply to, or applies to
 * whatever the caret happens to be sitting at instead. The fix is to
 * capture (clone) the Range the moment the toolbar control is about to
 * steal focus (onMouseDown, which fires before that happens), then
 * restore it right before running the actual command. Font size/family
 * apply via a real inline-styled <span> instead of execCommand, since
 * execCommand("fontSize") only understands the legacy 1-7 HTML sizes, not
 * arbitrary px values.
 */
/** Word/Google Docs paste into the rich-text editor often carries a lot of
 * MSO-specific markup bloat alongside the actual formatting. Rather than
 * letting the browser insert that raw, or stripping it down to plain text
 * (which would lose real <sub>/<sup> subscripts/superscripts — those
 * render natively fine in a contentEditable, unlike the plain-textarea
 * EquationFriendlyField fields elsewhere), any KaTeX/MathML equations are
 * first resolved to plain editable Unicode text (same pass used by the
 * plain-text fields — see EquationFriendlyField.jsx) so a pasted formula
 * becomes ordinary characters the admin can click into and edit, not a
 * rendered KaTeX DOM tree. What's left is then sanitized through the
 * exact same DOMPurify pass used for final student rendering and
 * inserted. Plain-text paste (no HTML on the clipboard) is left to the
 * browser's normal behaviour, which already preserves unicode characters
 * correctly. */
function richTextPaste(event) {
  const html = event.clipboardData?.getData("text/html");
  if (!html) return;
  event.preventDefault();
  const mathResolved = resolveMathAnnotationsInHtml(html);
  document.execCommand("insertHTML", false, sanitizeHtml(mathResolved));
}

export function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  function saveSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    if (!savedRangeRef.current || !editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  }

  function exec(command, arg) {
    restoreSelection();
    document.execCommand(command, false, arg);
    saveSelection();
  }

  function handleLink() {
    restoreSelection();
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }

  function applyInlineStyle(styleProp, styleValue) {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    const span = document.createElement("span");
    span.style[styleProp] = styleValue;

    if (range.collapsed) {
      // Nothing highlighted — apply to a zero-width marker so whatever is
      // typed next inherits it, per "current typing position".
      span.appendChild(document.createTextNode("\u200B"));
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(span.firstChild, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    } else {
      try {
        range.surroundContents(span);
      } catch {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    }
    editorRef.current.focus();
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-1">
        <select
          title="Paragraph style"
          aria-label="Paragraph style"
          defaultValue="p"
          onMouseDown={saveSelection}
          onChange={(e) => exec("formatBlock", e.target.value)}
          className="rounded border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-1 py-1 text-[11px] text-[var(--color-ink-soft)]"
        >
          {FORMAT_BLOCKS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        <select
          title="Font family"
          aria-label="Font family"
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => { if (e.target.value) applyInlineStyle("fontFamily", e.target.value); }}
          className="max-w-[7.5rem] rounded border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-1 py-1 text-[11px] text-[var(--color-ink-soft)]"
        >
          <option value="">Font</option>
          {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>

        <select
          title="Font size"
          aria-label="Font size"
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => { if (e.target.value) applyInlineStyle("fontSize", `${e.target.value}px`); }}
          className="rounded border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-1 py-1 text-[11px] text-[var(--color-ink-soft)]"
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <span className="mx-0.5 h-5 w-px bg-[var(--color-line)]" />

        <ToolbarButton label="Bold" icon={Bold} saveSelection={saveSelection} onClick={() => exec("bold")} />
        <ToolbarButton label="Italic" icon={Italic} saveSelection={saveSelection} onClick={() => exec("italic")} />
        <ToolbarButton label="Underline" icon={Underline} saveSelection={saveSelection} onClick={() => exec("underline")} />
        <ToolbarButton label="Superscript" icon={Superscript} saveSelection={saveSelection} onClick={() => exec("superscript")} />
        <ToolbarButton label="Subscript" icon={Subscript} saveSelection={saveSelection} onClick={() => exec("subscript")} />

        <span className="mx-0.5 h-5 w-px bg-[var(--color-line)]" />

        <span className="px-1 text-[11px] text-[var(--color-ink-soft)]">Text Colour</span>
        {QUICK_COLOURS.map(([colour, name]) => (
          <button key={colour} type="button" title={`Text colour: ${name}`} aria-label={`Text colour ${name}`} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => applyInlineStyle("color", colour)} className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: colour }} />
        ))}
        <label className="flex items-center gap-1 px-1 text-[11px] text-[var(--color-ink-soft)]" title="Custom text colour">
          Custom
          <input type="color" defaultValue="#12161c" onMouseDown={saveSelection} onChange={(e) => applyInlineStyle("color", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-[var(--color-line)] bg-transparent p-0.5" />
        </label>

        <span className="mx-0.5 h-5 w-px bg-[var(--color-line)]" />

        <ToolbarButton label="Bullets" icon={List} saveSelection={saveSelection} onClick={() => exec("insertUnorderedList")} />
        <ToolbarButton label="Numbered List" icon={ListOrdered} saveSelection={saveSelection} onClick={() => exec("insertOrderedList")} />

        <span className="mx-0.5 h-5 w-px bg-[var(--color-line)]" />

        <ToolbarButton label="Align Left" icon={AlignLeft} saveSelection={saveSelection} onClick={() => exec("justifyLeft")} />
        <ToolbarButton label="Align Center" icon={AlignCenter} saveSelection={saveSelection} onClick={() => exec("justifyCenter")} />
        <ToolbarButton label="Align Right" icon={AlignRight} saveSelection={saveSelection} onClick={() => exec("justifyRight")} />

        <span className="mx-0.5 h-5 w-px bg-[var(--color-line)]" />

        <ToolbarButton label="Link" icon={Link2} saveSelection={saveSelection} onClick={handleLink} />
        <ToolbarButton label="Clear Formatting" icon={Eraser} saveSelection={saveSelection} onClick={() => exec("removeFormat")} />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onPaste={richTextPaste}
        className="min-h-[100px] rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none [&_h3]:text-lg [&_h3]:font-bold [&_h4]:text-base [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[var(--color-indigo)] [&_a]:underline [&_sub]:text-[0.75em] [&_sup]:text-[0.75em] [&_sub]:relative [&_sup]:relative [&_sub]:[line-height:0] [&_sup]:[line-height:0]"
        dangerouslySetInnerHTML={{ __html: resolveMathAnnotationsInHtml(value) }}
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
              <input className={inputCls} value={content.title ?? ""} onChange={(e) => set("title", e.target.value)} onPaste={equationInputPaste(content.title ?? "", (value) => set("title", value))} placeholder="Section title" />
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
          <div><label className={labelCls}>Caption</label><input className={inputCls} value={content.caption} onChange={(e) => set("caption", e.target.value)} onPaste={equationInputPaste(content.caption ?? "", (value) => set("caption", value))} /></div>
          <div><label className={labelCls}>Alt text</label><input className={inputCls} value={content.alt} onChange={(e) => set("alt", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Alignment</label><select className={inputCls} value={content.alignment} onChange={(e) => set("alignment", e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
            <div><label className={labelCls}>Width</label><select className={inputCls} value={content.width || "large"} onChange={(e) => set("width", e.target.value)}><option value="small">50%</option><option value="medium">70%</option><option value="large">85%</option><option value="full">100%</option></select></div>
          </div>
        </div>
      );

    case "video":
      return (
        <div className="space-y-2">
          <LearnMediaInput kind="video" pageId={pageId} blockId={blockId} url={content.url ?? ""} onUrlChange={(url) => set("url", url)} label="Video" />
          <div><label className={labelCls}>Caption</label><input className={inputCls} value={content.caption} onChange={(e) => set("caption", e.target.value)} onPaste={equationInputPaste(content.caption ?? "", (value) => set("caption", value))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Alignment</label><select className={inputCls} value={content.alignment || "center"} onChange={(e) => set("alignment", e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
            <div><label className={labelCls}>Width</label><select className={inputCls} value={content.width || "large"} onChange={(e) => set("width", e.target.value)}><option value="small">50%</option><option value="medium">70%</option><option value="large">85%</option><option value="full">100%</option></select></div>
          </div>
        </div>
      );

    case "equation":
      return (
        <div>
          <label className={labelCls}>Markup — use _2 for subscript, ^2- for superscript (e.g. SO_4^2-)</label>
          <input className={`${inputCls} font-mono`} value={content.markup} onChange={(e) => set("markup", e.target.value)} onPaste={equationInputPaste(content.markup, (value) => set("markup", value))} placeholder="H_2O + CO_2 -> H_2CO_3" />
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
      return <EquationFriendlyField className={inputCls} rows={3} value={content.text} onChange={(value) => set("text", value)} placeholder={blockType === "common_mistake" ? "Add a common mistake, misconception or misunderstanding students may have…" : "Add the key idea…"} />;

    case "page_break":
      return (
        <div className="rounded-md border border-dashed border-[var(--color-indigo)]/40 bg-[var(--color-indigo-soft)] p-3">
          <p className="text-xs font-semibold text-[var(--color-indigo)]">Starts a new student page</p>
          <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Students will see page numbers (1, 2, 3…) and Previous/Next Page controls. Add content blocks after this break to continue on the new page.</p>
          <div className="mt-2"><label className={labelCls}>Optional page label</label><input className={inputCls} value={content.label ?? ""} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Classification of matter" /></div>
        </div>
      );

    case "check_understanding":
      return (
        <div className="rounded-md border border-dashed border-[var(--color-amber)]/40 bg-[var(--color-amber-soft)] p-3">
          <p className="text-xs font-semibold text-[var(--color-amber)]">Optional quick check</p>
          <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Configure Question Bank or manual questions in this block. Drag this block anywhere in the lesson, including between Page Breaks.</p>
        </div>
      );

    case "topic_link": {
      const options = getSyllabusCodeOptions();
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Linked syllabus understanding</label>
            <select className={inputCls} value={content.targetCode || ""} onChange={(e) => set("targetCode", e.target.value)}>
              <option value="">Select a syllabus code…</option>
              {options.map((opt) => <option key={opt.code} value={opt.code}>{opt.code} — {opt.title}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Button label <span className="text-[var(--color-ink-faint)]">(optional)</span></label><input className={inputCls} value={content.label || ""} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Revisit metallic bonding" /></div>
          <div>
            <label className={labelCls}>Alignment</label>
            <select className={inputCls} value={content.alignment || "right"} onChange={(e) => set("alignment", e.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
          </div>
          <p className="text-[11px] text-[var(--color-ink-faint)]">Students see a small contextual button at this exact point in the lesson. It opens the first published lesson mapped to the selected syllabus code.</p>
        </div>
      );
    }

    case "definition":
      return (
        <div className="space-y-2">
          <div><label className={labelCls}>Term</label><input className={inputCls} value={content.term} onChange={(e) => set("term", e.target.value)} onPaste={equationInputPaste(content.term ?? "", (value) => set("term", value))} /></div>
          <div><label className={labelCls}>Definition</label><EquationFriendlyField className={inputCls} rows={2} value={content.definition} onChange={(value) => set("definition", value)} /></div>
        </div>
      );

    case "real_life":
      return (
        <div className="space-y-2">
          <div><label className={labelCls}>Title</label><input className={inputCls} value={content.title} onChange={(e) => set("title", e.target.value)} onPaste={equationInputPaste(content.title ?? "", (value) => set("title", value))} /></div>
          <div><label className={labelCls}>Content</label><EquationFriendlyField className={inputCls} rows={3} value={content.content} onChange={(value) => set("content", value)} /></div>
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
          <div><label className={labelCls}>Prompt (Think)</label><EquationFriendlyField className={inputCls} rows={2} value={content.prompt} onChange={(value) => set("prompt", value)} /></div>
          <div><label className={labelCls}>Reveal content</label><EquationFriendlyField className={inputCls} rows={2} value={content.reveal} onChange={(value) => set("reveal", value)} /></div>
        </div>
      );

    case "practical":
      return (
        <div className="space-y-2">
          {["aim", "apparatus", "variables", "method", "safety", "observations", "data", "analysis"].map((field) => (
            <div key={field}>
              <label className={labelCls}>{field[0].toUpperCase() + field.slice(1)} <span className="text-[var(--color-ink-faint)]">(leave blank to omit)</span></label>
              <EquationFriendlyField className={inputCls} rows={2} value={content[field]} onChange={(value) => set(field, value)} />
            </div>
          ))}
        </div>
      );

    default:
      return <p className="text-xs text-[var(--color-ink-faint)]">Unknown block type.</p>;
  }
}

function WorkedExampleEditor({ content, set }) {
  // Migration is a read-time concern, not a write-time one — we never
  // silently rewrite an old block's stored shape just by opening the
  // editor. The Solution field shows the combined text (old steps +
  // final answer, if that's what this block still has); once the admin
  // edits it, it's saved into the new `solution` field going forward.
  // The old `steps`/`finalAnswer` values, if any, are simply left alone
  // in the stored content — harmless, and no longer read once `solution`
  // has a value.
  const solutionValue = content.solution ?? getWorkedExampleSolution(content);
  // Existing blocks saved before displayMode existed have no such key at
  // all — undefined must behave exactly like "direct" so nothing already
  // published silently changes appearance (same convention as
  // Compare & Contrast's displayMode).
  const displayMode = content.displayMode ?? "direct";
  return (
    <div className="space-y-2">
      <div><label className={labelCls}>Question / Problem</label><EquationFriendlyField className={inputCls} rows={2} value={content.question} onChange={(value) => set("question", value)} /></div>
      <div>
        <label className={labelCls}>Solution</label>
        <EquationFriendlyField className={inputCls} rows={6} value={solutionValue} onChange={(value) => set("solution", value)} placeholder={"Paste or type the full worked solution, with line breaks preserved — e.g.\npH = \u2212log\u2081\u2080[H\u2083O\u207A]\npH = \u2212log\u2081\u2080(2.5 \u00d7 10\u207B\u00b3)\npH = 2.60"} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Display Mode</label>
        <div className="flex flex-col gap-1.5 text-sm text-[var(--color-ink-soft)]">
          <label className="flex items-center gap-2">
            <input type="radio" name="worked-example-display-mode" checked={displayMode === "direct"} onChange={() => set("displayMode", "direct")} />
            Show directly in lesson flow
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="worked-example-display-mode" checked={displayMode === "reveal"} onChange={() => set("displayMode", "reveal")} />
            Show as button / reveal
          </label>
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Reveal mode shows the question immediately, with a "Show Solution" button students click to reveal the solution.</p>
      </div>
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
      <div><label className={labelCls}>Explanation</label><EquationFriendlyField className={inputCls} rows={2} value={content.explanation} onChange={(value) => set("explanation", value)} /></div>
      <div><label className={labelCls}>Optional student prompt</label><input className={inputCls} value={content.prompt} onChange={(e) => set("prompt", e.target.value)} /></div>
    </div>
  );
}

function parsePastedCompareTable({ html = "", text = "" }) {
  let matrix = [];

  // Word/Google Docs commonly place a real HTML <table> on the clipboard.
  // Prefer it because it preserves cell boundaries even when cell text contains spaces.
  if (html && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const table = doc.querySelector("table");
      if (table) {
        matrix = Array.from(table.querySelectorAll("tr")).map((row) =>
          Array.from(row.querySelectorAll("th,td")).map((cell) => (cell.innerText || cell.textContent || "").trim())
        );
      }
    } catch {
      matrix = [];
    }
  }

  // Excel/Google Sheets copy cells as tab-separated rows. Also accept CSV-ish
  // pasted text as a convenience, without trying to be a full CSV importer.
  if (!matrix.length && text) {
    const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim().length);
    const delimiter = lines.some((line) => line.includes("\t")) ? "\t" : (lines.some((line) => line.includes(",")) ? "," : null);
    if (delimiter) matrix = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()));
  }

  matrix = matrix
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some(Boolean));

  if (matrix.length < 2) return null;
  const width = Math.max(...matrix.map((row) => row.length));
  if (width < 2) return null;
  const normalized = matrix.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ""));

  // First row is the header row. This maps naturally to the common comparison
  // table copied from Word/Excel: Property | A | B | ...
  return { headers: normalized[0], rows: normalized.slice(1) };
}

function CompareTablePreview({ table }) {
  if (!table?.headers?.length) return null;
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-line)]">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-[var(--color-paper-raised)] text-[var(--color-ink)]">
          <tr>{table.headers.map((h, i) => <th key={i} className="border-b border-r border-[var(--color-line)] px-2.5 py-2 font-semibold last:border-r-0">{h || `Column ${i + 1}`}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} className="text-[var(--color-ink-soft)]">
              {table.headers.map((_, c) => <td key={c} className="border-b border-r border-[var(--color-line)] px-2.5 py-2 align-top last:border-r-0 last:border-b">{row[c]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareContrastEditor({ content, set }) {
  const [pastePreview, setPastePreview] = useState(null);
  const [pasteError, setPasteError] = useState("");

  function updateColumn(i, key, value) {
    const columns = (content.columns ?? []).map((c, j) => (j === i ? { ...c, [key]: value } : c));
    set("columns", columns);
  }

  function handleTablePaste(event) {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    event.preventDefault();
    const parsed = parsePastedCompareTable({
      html: clipboard.getData("text/html"),
      text: clipboard.getData("text/plain"),
    });
    if (!parsed) {
      setPastePreview(null);
      setPasteError("Could not detect a table. Copy at least 2 columns and 2 rows from Word, Excel or Google Sheets.");
      return;
    }
    setPasteError("");
    setPastePreview(parsed);
  }

  function applyPastedTable() {
    if (!pastePreview) return;
    set("table", pastePreview);
    setPastePreview(null);
    setPasteError("");
  }

  const hasTable = Boolean(content.table?.headers?.length && content.table?.rows?.length);

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Title (optional — also used as the reveal button label)</label>
        <input className={inputCls} placeholder="e.g. Colloids & Suspensions" value={content.title ?? ""} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Display Mode</label>
        <div className="flex flex-col gap-1.5 text-sm text-[var(--color-ink-soft)]">
          <label className="flex items-center gap-2">
            <input type="radio" name={`display-mode-${content.title ?? "cc"}`} checked={(content.displayMode ?? "inline") === "inline"} onChange={() => set("displayMode", "inline")} />
            Show directly in lesson flow
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name={`display-mode-${content.title ?? "cc"}`} checked={content.displayMode === "reveal"} onChange={() => set("displayMode", "reveal")} />
            Show as button / reveal
          </label>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-[var(--color-indigo)]/35 bg-[var(--color-indigo-soft)]/35 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--color-ink)]">Paste a comparison table</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">Copy a table from Word, Excel or Google Sheets, then click below and paste. The first row becomes the header.</p>
          </div>
          {hasTable && <button type="button" onClick={() => set("table", null)} className="text-[11px] font-medium text-[var(--color-coral)]">Remove pasted table</button>}
        </div>
        <textarea
          className={`${inputCls} mt-2 min-h-16`}
          value=""
          readOnly
          onPaste={handleTablePaste}
          placeholder="Click here, then Ctrl+V / Cmd+V to paste your table…"
          aria-label="Paste comparison table from Word or spreadsheet"
        />
        {pasteError && <p className="mt-2 text-xs text-[var(--color-coral)]">{pasteError}</p>}
        {pastePreview && (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Preview before applying</p>
            <CompareTablePreview table={pastePreview} />
            <div className="flex gap-2">
              <button type="button" onClick={applyPastedTable} className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-white">Use this table</button>
              <button type="button" onClick={() => { setPastePreview(null); setPasteError(""); }} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">Cancel</button>
            </div>
          </div>
        )}
        {hasTable && !pastePreview && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Current pasted table</p>
            <CompareTablePreview table={content.table} />
            <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">Paste another table above to replace it. Undo restores the previous block state.</p>
          </div>
        )}
      </div>

      {!hasTable && <>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Or build comparison cards manually</p>
        {(content.columns ?? []).map((col, i) => (
          <div key={i} className="rounded-md border border-[var(--color-line)] p-2">
            <input className={`${inputCls} mb-1.5 font-medium`} placeholder="Column title" value={col.title} onChange={(e) => updateColumn(i, "title", e.target.value)} onPaste={equationInputPaste(col.title ?? "", (value) => updateColumn(i, "title", value))} />
            <EquationFriendlyField className={inputCls} rows={2} placeholder="Content" value={col.content} onChange={(value) => updateColumn(i, "content", value)} />
            {(content.columns ?? []).length > 2 && <button type="button" onClick={() => set("columns", content.columns.filter((_, j) => j !== i))} className="mt-1 text-xs text-[var(--color-coral)]">Remove column</button>}
          </div>
        ))}
        <button type="button" onClick={() => set("columns", [...(content.columns ?? []), { title: "", content: "" }])} className="text-xs font-medium text-[var(--color-indigo)]">+ Add column</button>
      </>}
    </div>
  );
}

export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || "", { ADD_ATTR: ["style", "color"] });
}
