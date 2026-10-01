import { useState, useRef, useEffect } from "react";
import DOMPurify from "dompurify";
import LearnMediaInput from "../components/admin/LearnMediaInput.jsx";
import EquationFriendlyField, { pasteEquationFriendly, resolveMathAnnotationsInHtml } from "../components/admin/EquationFriendlyField.jsx";
import TableEditor from "../components/admin/learn/TableEditor.jsx";
import { parseTabularPaste, createEmptyTable } from "../lib/tableParsing.js";
import { getSyllabusCodeOptions } from "../lib/learn-tree.js";
import {
  Type, Image as ImageIcon, Video, FlaskConical, Box, PlayCircle,
  Lightbulb, BookMarked, AlertTriangle, Globe2, ListChecks, BarChart3,
  Columns2, HelpCircle, Beaker, Files, Link2, Table2,
  Bold, Italic, Underline, Superscript, Subscript,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Eraser,
  Plus, Trash2, ChevronUp, ChevronDown, Heading, Sigma, MessageSquareQuote,
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
  rich_text: { label: "Rich Text", category: "content", icon: Type, defaultContent: { title: "", titleColor: "#f08484", html: "", imageUrl: "", imageAlt: "", imageCaption: "", imageWrap: "right", imageWidth: "medium" } },
  image: { label: "Image", category: "content", icon: ImageIcon, defaultContent: { url: "", caption: "", alt: "", alignment: "center", width: "large", wrap: "none" } },
  video: { label: "Video", category: "content", icon: Video, defaultContent: { url: "", caption: "", alignment: "center", width: "large" } },
  equation: { label: "Chemical Equation / Chemistry", category: "chemistry", icon: FlaskConical, defaultContent: { markup: "" } },
  molecule_3d: { label: "3D Molecule", category: "chemistry", icon: Box, defaultContent: { presetId: "" } },
  simulation: { label: "e-Lab Simulation", category: "chemistry", icon: PlayCircle, defaultContent: { simulationId: "" } },
  key_idea: { label: "Key Idea", category: "teaching", icon: Lightbulb, defaultContent: { text: "" } },
  definition: { label: "Definition", category: "teaching", icon: BookMarked, defaultContent: { term: "", definition: "" } },
  common_mistake: { label: "Common Mistakes / Misunderstandings", category: "teaching", icon: AlertTriangle, defaultContent: { text: "" } },
  real_life: { label: "Real-Life Connection", category: "teaching", icon: Globe2, defaultContent: { title: "", content: "", imageUrl: "", imageAlt: "", imageCaption: "", imageWrap: "right", imageWidth: "medium" } },
  worked_example: { label: "Worked Example", category: "teaching", icon: ListChecks, defaultContent: { question: "", solution: "", questionItems: [], items: [], displayMode: "direct" } },
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

// Moved to its own module (simulationRegistry.js) so the shared
// simulation chrome (InteractiveFrame, the /simulation/:simulationId
// standalone route) can read it without pulling in this whole
// admin-editor file's dependencies. Imported (and re-exported below) so
// both this file's own internal uses AND every existing
// `import { SIMULATION_REGISTRY } from "./learnBlockRegistry.jsx"` keep
// working unchanged.
import { SIMULATION_REGISTRY } from "./simulationRegistry.js";
export { SIMULATION_REGISTRY };

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

export const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none";
export const labelCls = "mb-1 block text-xs font-medium text-[var(--color-ink-soft)]";
export const equationInputPaste = (value, setter) => (e) => pasteEquationFriendly(e, value, setter);

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

// ============================================================
// Worked Example — reusable mixed-content items.
//
// Worked Example used to store a solution as one restricted string
// (`solution`, or before that `steps`/`finalAnswer` — see above). That
// can't hold a real worked solution: a table of ionization energies
// alongside step-by-step text and a highlighted final answer. `items` is
// the new, additive field: an ordered sequence of small content pieces —
// { type: "text" | "subheading" | "equation" | "answer", value } for
// scientific text (all four share the same EquationFriendlyField
// authoring surface and the same ScientificText rendering pipeline, and
// differ only in visual treatment), or { type: "table", headers, rows,
// hasHeaderRow, hasHeaderColumn } for the reusable Table content element
// (see src/lib/tableParsing.js, TableEditor.jsx, TableView.jsx).
//
// Nothing is migrated in storage. getWorkedExampleItems() is the single
// place (used by both the editor and the student renderer) that decides
// what to show: a real `items` array if the block already has one,
// otherwise the old solution text (via getWorkedExampleSolution, which
// itself already handles the even older steps/finalAnswer shape) wrapped
// as a single { type: "text" } item — so an old block renders/edits
// exactly as it always has, in the very same items-sequence UI, without
// ever touching what's stored in Supabase. The moment an admin edits
// that item (or adds another one), the block starts saving `items` going
// forward; the old `solution`/`steps`/`finalAnswer` fields are simply
// left alone in the stored row, unread from then on — same convention
// already used for the solution/steps migration above. */
export function getWorkedExampleItems(content) {
  if (Array.isArray(content?.items) && content.items.length) return content.items;
  const solution = getWorkedExampleSolution(content);
  return solution ? [{ type: "text", value: solution }] : [];
}

/** Same additive-items convention as getWorkedExampleItems() above, for
 * the Question side. Old blocks only ever had a single plain `question`
 * string (no tables, no mixed content) — that keeps working forever,
 * unread and unmigrated in storage, wrapped as one { type: "text" } item
 * so it shows/edits in the exact same items-sequence UI as Solution. The
 * moment an admin edits/adds a question item, the block starts saving
 * `questionItems` going forward; `question` is simply left alone. */
export function getWorkedExampleQuestionItems(content) {
  if (Array.isArray(content?.questionItems) && content.questionItems.length) return content.questionItems;
  return content?.question ? [{ type: "text", value: content.question }] : [];
}

export const WORKED_EXAMPLE_ITEM_TYPES = [
  { type: "text", label: "Text", icon: Type },
  { type: "subheading", label: "Subheading", icon: Heading },
  { type: "equation", label: "Equation", icon: Sigma },
  { type: "table", label: "Table", icon: Table2 },
  { type: "answer", label: "Answer", icon: MessageSquareQuote },
];

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
// Highlight (background colour) was missing entirely from this toolbar --
// issue 2 names it explicitly ("colour/highlight pickers" must preserve
// selection) but there was no highlight control to even test. Uses the
// exact same quick-swatches + native colour-input pattern as Text
// Colour, through the same applyInlineStyle()/selection-preservation
// path, rather than a one-off implementation.
const QUICK_HIGHLIGHTS = [
  ["#fef08a", "Yellow"], ["#bbf7d0", "Green"], ["#bfdbfe", "Blue"],
  ["#fecaca", "Red"], ["#e9d5ff", "Purple"],
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

  // CENTRAL selection-preservation mechanism (issue 2). This is the one
  // thing every toolbar control relies on -- mouse clicks, keyboard
  // selection, and (critically) the multi-step colour/highlight picker
  // interaction (open picker -> hover/click swatches -> pick a value) --
  // instead of each control re-implementing its own save/restore timing.
  //
  // Previously, the ONLY place a selection got saved was each control's
  // own onMouseDown (plus onMouseUp/onKeyUp on the editor itself). That
  // is exactly the single-mousedown-save pattern that is fragile for a
  // popover: a native <input type="color">'s OS-level picker dialog, or
  // any custom popover rendered outside the toolbar button itself, can
  // go through intermediate focus/blur cycles that a single mousedown
  // handler never sees.
  //
  // document-level `selectionchange` fires for every selection change
  // anywhere in the document (mouse, keyboard, drag, triple-click --
  // every input method), so listening to it directly keeps
  // savedRangeRef continuously in sync with "the last real selection the
  // user made inside this editor", with ZERO per-control wiring. Once
  // focus/selection leaves the editor (e.g. into a colour swatch, a
  // native <select>, or a popover), `selectionchange` simply stops
  // firing for a selection inside the editor, so savedRangeRef correctly
  // keeps the last valid in-editor selection throughout that whole
  // interaction -- exactly what every toolbar control (including a
  // multi-step picker) needs restored right before it runs its format
  // command.
  useEffect(() => {
    document.addEventListener("selectionchange", saveSelection);
    return () => document.removeEventListener("selectionchange", saveSelection);
  }, []);

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

        <span className="px-1 text-[11px] text-[var(--color-ink-soft)]">Highlight</span>
        {QUICK_HIGHLIGHTS.map(([colour, name]) => (
          <button key={colour} type="button" title={`Highlight: ${name}`} aria-label={`Highlight ${name}`} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => applyInlineStyle("backgroundColor", colour)} className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: colour }} />
        ))}
        <label className="flex items-center gap-1 px-1 text-[11px] text-[var(--color-ink-soft)]" title="Custom highlight colour">
          Custom
          <input type="color" defaultValue="#fef08a" onMouseDown={saveSelection} onChange={(e) => applyInlineStyle("backgroundColor", e.target.value)} className="h-6 w-7 cursor-pointer rounded border border-[var(--color-line)] bg-transparent p-0.5" />
        </label>
        <ToolbarButton label="Remove Highlight" icon={Eraser} saveSelection={saveSelection} onClick={() => applyInlineStyle("backgroundColor", "transparent")} />

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
          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)]/45 p-3">
            <p className="mb-2 text-xs font-semibold text-[var(--color-ink)]">Optional image inside this text block</p>
            <LearnMediaInput kind="image" pageId={pageId} blockId={blockId} url={content.imageUrl ?? ""} onUrlChange={(url) => set("imageUrl", url)} label="Image" />
            {content.imageUrl && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelCls}>Text wrapping</label><select className={inputCls} value={content.imageWrap || "right"} onChange={(e) => set("imageWrap", e.target.value)}><option value="right">Image right · text wraps left</option><option value="left">Image left · text wraps right</option><option value="none">No wrap · image below text</option></select></div>
                  <div><label className={labelCls}>Image size</label><select className={inputCls} value={content.imageWidth || "medium"} onChange={(e) => set("imageWidth", e.target.value)}><option value="small">Small · 30%</option><option value="medium">Medium · 40%</option><option value="large">Large · 50%</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={labelCls}>Alt text</label><input className={inputCls} value={content.imageAlt ?? ""} onChange={(e) => set("imageAlt", e.target.value)} placeholder="Describe the image" /></div>
                  <div><label className={labelCls}>Caption <span className="text-[var(--color-ink-faint)]">(optional)</span></label><input className={inputCls} value={content.imageCaption ?? ""} onChange={(e) => set("imageCaption", e.target.value)} /></div>
                </div>
              </div>
            )}
          </div>
        </div>
      );

    case "image":
      return (
        <div className="space-y-2">
          <LearnMediaInput kind="image" pageId={pageId} blockId={blockId} url={content.url ?? ""} onUrlChange={(url) => set("url", url)} label="Image" />
          <div><label className={labelCls}>Caption</label><input className={inputCls} value={content.caption} onChange={(e) => set("caption", e.target.value)} onPaste={equationInputPaste(content.caption ?? "", (value) => set("caption", value))} /></div>
          <div><label className={labelCls}>Alt text</label><input className={inputCls} value={content.alt} onChange={(e) => set("alt", e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelCls}>Text wrapping</label><select className={inputCls} value={content.wrap || "none"} onChange={(e) => set("wrap", e.target.value)}><option value="none">No wrap</option><option value="left">Wrap · image left</option><option value="right">Wrap · image right</option></select></div>
            <div><label className={labelCls}>Alignment</label><select className={inputCls} value={content.alignment} onChange={(e) => set("alignment", e.target.value)} disabled={(content.wrap || "none") !== "none"}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
            <div><label className={labelCls}>Width</label><select className={inputCls} value={content.width || "large"} onChange={(e) => set("width", e.target.value)}><option value="small">50%</option><option value="medium">70%</option><option value="large">85%</option><option value="full">100%</option></select></div>
          </div>
          {(content.wrap || "none") !== "none" && <p className="text-[11px] text-[var(--color-ink-faint)]">Wrapping lets the lesson content that follows flow beside this image until the image ends. On small screens it stacks automatically.</p>}
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
      return (
        <div className="space-y-2">
          <EquationFriendlyField className={inputCls} rows={3} value={content.text} onChange={(value) => set("text", value)} placeholder={blockType === "common_mistake" ? "Add a common mistake, misconception or misunderstanding students may have…" : "Add the key idea…"} />
          <OptionalTableField table={content.table} onChange={(table) => set("table", table)} />
        </div>
      );

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
          <div><label className={labelCls}>Content</label><EquationFriendlyField className={inputCls} rows={5} value={content.content} onChange={(value) => set("content", value)} /></div>
          <OptionalTableField table={content.table} onChange={(table) => set("table", table)} />
          <LearnMediaInput kind="image" pageId={pageId} blockId={blockId} url={content.imageUrl ?? ""} onUrlChange={(url) => set("imageUrl", url)} label="Optional image" />
          {content.imageUrl && (
            <div className="space-y-2 rounded-md border border-[#34d399]/20 bg-[#34d399]/5 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>Text wrapping</label><select className={inputCls} value={content.imageWrap || "right"} onChange={(e) => set("imageWrap", e.target.value)}><option value="right">Image right · text wraps left</option><option value="left">Image left · text wraps right</option><option value="none">No wrap · image below text</option></select></div>
                <div><label className={labelCls}>Image size</label><select className={inputCls} value={content.imageWidth || "medium"} onChange={(e) => set("imageWidth", e.target.value)}><option value="small">Small · 30%</option><option value="medium">Medium · 40%</option><option value="large">Large · 50%</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>Alt text</label><input className={inputCls} value={content.imageAlt ?? ""} onChange={(e) => set("imageAlt", e.target.value)} placeholder="Describe the image" /></div>
                <div><label className={labelCls}>Caption <span className="text-[var(--color-ink-faint)]">(optional)</span></label><input className={inputCls} value={content.imageCaption ?? ""} onChange={(e) => set("imageCaption", e.target.value)} /></div>
              </div>
            </div>
          )}
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
          <OptionalTableField table={content.table} onChange={(table) => set("table", table)} />
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

/** A single optional table attached to an otherwise plain-text block (Key
 * Idea, Common Mistakes, Real-Life Connection, Reveal/Think's reveal
 * side). Reuses the exact same TableEditor as Worked Example's table
 * content-item — same behaviour and appearance everywhere a table can
 * appear — just without the full mixed-content-sequence UI those simpler
 * blocks don't otherwise need. Additive and optional: `content.table` is
 * undefined for every block saved before this existed, so nothing
 * already published changes appearance. */
function OptionalTableField({ table, onChange }) {
  if (!table) {
    return (
      <button type="button" onClick={() => onChange(createEmptyTable())} className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-indigo)]">
        <Table2 size={12} /> + Add table
      </button>
    );
  }
  return <TableEditor table={table} onChange={onChange} onRemove={() => onChange(null)} />;
}

function newWorkedExampleItem(type) {
  if (type === "table") return { type: "table", ...createEmptyTable() };
  return { type, value: "" };
}

const WORKED_EXAMPLE_ITEM_STYLE = {
  text: { label: "Text", rows: 2, placeholder: "Paragraph text\u2026" },
  subheading: { label: "Subheading", rows: 1, placeholder: "e.g. Step 1 \u2014 Find the largest jump" },
  equation: { label: "Equation", rows: 1, placeholder: "e.g. 578 \u2192 1817 \u2192 2745 \u2192 11577 \u2192 14842" },
  answer: { label: "Answer / Callout", rows: 3, placeholder: "The final answer, highlighted for the student\u2026" },
};

/** One item in the Worked Example content sequence \u2014 a compact card with
 * a type label, reorder/remove controls, and the type-specific editor.
 * Text/subheading/equation/answer all share EquationFriendlyField (the
 * same scientific-text authoring surface used everywhere else in Admin
 * Learn) and differ only in rows/placeholder/visual role; table uses the
 * shared, reusable TableEditor so its behaviour matches every other
 * block that can contain a table. */
function WorkedExampleItemEditor({ item, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const meta = WORKED_EXAMPLE_ITEM_TYPES.find((t) => t.type === item.type) ?? WORKED_EXAMPLE_ITEM_TYPES[0];
  const Icon = meta.icon;
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)]/50 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]"><Icon size={12} /> {meta.label}</span>
        <div className="flex items-center gap-1">
          <button type="button" title="Move up" disabled={isFirst} onClick={onMoveUp} className="text-[var(--color-ink-faint)] hover:text-[var(--color-indigo)] disabled:opacity-25"><ChevronUp size={14} /></button>
          <button type="button" title="Move down" disabled={isLast} onClick={onMoveDown} className="text-[var(--color-ink-faint)] hover:text-[var(--color-indigo)] disabled:opacity-25"><ChevronDown size={14} /></button>
          <button type="button" title="Remove" onClick={onRemove} className="text-[var(--color-ink-faint)] hover:text-[var(--color-coral)]"><Trash2 size={14} /></button>
        </div>
      </div>
      {item.type === "table" ? (
        <TableEditor table={item} onChange={(table) => onChange({ type: "table", ...table })} />
      ) : (
        <EquationFriendlyField
          className={inputCls}
          rows={WORKED_EXAMPLE_ITEM_STYLE[item.type]?.rows ?? 2}
          value={item.value ?? ""}
          onChange={(value) => onChange({ ...item, value })}
          placeholder={WORKED_EXAMPLE_ITEM_STYLE[item.type]?.placeholder}
          showToolbar={item.type !== "subheading"}
        />
      )}
    </div>
  );
}

/** Shared add/update/remove/move logic for an items-sequence editor —
 * used identically by both the Question and the Solution sides of a
 * Worked Example, so there is exactly one implementation of "edit an
 * ordered list of mixed content items", not two. */
function itemsController(items, setItems) {
  return {
    items,
    update: (i, next) => setItems(items.map((it, idx) => (idx === i ? next : it))),
    remove: (i) => setItems(items.filter((_, idx) => idx !== i)),
    move: (i, dir) => {
      const j = i + dir;
      if (j < 0 || j >= items.length) return;
      const next = [...items];
      [next[i], next[j]] = [next[j], next[i]];
      setItems(next);
    },
    add: (type) => setItems([...items, newWorkedExampleItem(type)]),
  };
}

/** The reusable items-sequence editor UI — one list of
 * WorkedExampleItemEditor cards plus "add item" buttons. Used for both
 * Question and Solution (see WorkedExampleEditor below) so a table, or
 * any other item type, is inserted identically in either section; there
 * is no separate QuestionTable/SolutionTable implementation. */
function WorkedExampleItemsList({ controller, emptyLabel }) {
  const { items } = controller;
  return (
    <div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <WorkedExampleItemEditor
            key={i}
            item={item}
            onChange={(next) => controller.update(i, next)}
            onRemove={() => controller.remove(i)}
            onMoveUp={() => controller.move(i, -1)}
            onMoveDown={() => controller.move(i, 1)}
            isFirst={i === 0}
            isLast={i === items.length - 1}
          />
        ))}
        {items.length === 0 && <p className="text-[11px] text-[var(--color-ink-faint)]">{emptyLabel}</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {WORKED_EXAMPLE_ITEM_TYPES.map(({ type, label, icon: Icon }) => (
          <button key={type} type="button" onClick={() => controller.add(type)} className="flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2 py-1 text-[11px] font-medium text-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">
            <Plus size={11} /> <Icon size={12} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkedExampleEditor({ content, set }) {
  // See getWorkedExampleItems() / getWorkedExampleQuestionItems() above
  // for exactly how old (plain `question` string; `solution` / `steps` +
  // `finalAnswer`) and new (`questionItems` / `items`) blocks are
  // unified into one editing surface without ever migrating storage.
  const questionItems = getWorkedExampleQuestionItems(content);
  const items = getWorkedExampleItems(content);
  // Existing blocks saved before displayMode existed have no such key at
  // all — undefined must behave exactly like "direct" so nothing already
  // published silently changes appearance (same convention as
  // Compare & Contrast's displayMode).
  const displayMode = content.displayMode ?? "direct";

  const questionController = itemsController(questionItems, (next) => set("questionItems", next));
  const solutionController = itemsController(items, (next) => set("items", next));

  return (
    <div className="space-y-2">
      <div>
        <label className={labelCls}>Question — a sequence of text, subheadings, equations, tables and an answer</label>
        <WorkedExampleItemsList controller={questionController} emptyLabel="No content yet — add a piece of the question below." />
      </div>

      <div>
        <label className={labelCls}>Solution — a sequence of text, subheadings, equations, tables and an answer</label>
        <WorkedExampleItemsList controller={solutionController} emptyLabel="No content yet — add a piece of the solution below." />
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

// parseTabularPaste (src/lib/tableParsing.js) now holds this parsing
// logic — extracted so the reusable Table content element's own "Paste
// table data" flow (TableEditor.jsx) shares exactly one parser with
// Compare & Contrast's original paste-a-table feature, instead of two
// implementations that could quietly drift apart. Behaviour here is
// unchanged: HTML <table> preferred, else tab/comma-delimited text,
// first row is always the header.
const parsePastedCompareTable = parseTabularPaste;

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
