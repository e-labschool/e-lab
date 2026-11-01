import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Superscript, Subscript, Highlighter,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentIncrease, IndentDecrease, Undo2, Redo2, Link2, RemoveFormatting, Eraser, X,
} from "lucide-react";
import { resolveMathAnnotationsInHtml } from "./EquationFriendlyField.jsx";
import { sanitizeHtml } from "../../lib/sanitizeHtml.js";
import { RICH_TEXT_TYPOGRAPHY } from "../../lib/richTextStyles.js";
import * as ops from "../../lib/richTextOps.js";
import { createHistory } from "../../lib/editHistory.js";
import { hashString, saveDraft, loadDraft, clearDraft, decideDraft } from "../../lib/draftStore.js";

// ============================================================================
// Rich Text editor (contentEditable + Range-based formatting).
//
// ROOT CAUSES of "I can't select text and reliably format it" that this file
// fixes (found by driving the previous editor in headless Chromium, see
// docs/RICH_TEXT_EDITOR.md):
//   1. onBlur -> onChange -> parent state -> React re-set innerHTML. Any
//      toolbar control that takes focus (font-size/family/style <select>,
//      colour picker) blurred the editor, which replaced every DOM node and
//      invalidated the saved Range, so the format landed on a stray
//      zero-width span OUTSIDE the paragraphs. The DOM is now owned by this
//      component (React never re-writes it while it differs from what we
//      last emitted) and the selection is saved as TEXT OFFSETS, which
//      survive any re-render / node splitting.
//   2. Formatting wrapped Range.extractContents() in a <span>, so a selection
//      over several paragraphs produced <span><p>..</p></span>, and a
//      triple-click leaked an empty <p>. richTextOps wraps each selected TEXT
//      node instead, so only the selected characters change.
//   3. Manual DOM edits destroyed native undo. Undo/redo is now an explicit
//      snapshot history (typing, paste and every formatting op).
//   4. Each lesson block card was draggable as a whole (LessonEditor), which
//      competes with mouse text selection and drag-moves selected text.
// ============================================================================

const PARAGRAPH_STYLES = [
  { label: "Normal", value: "p" },
  { label: "Heading 1", value: "h1" },
  { label: "Heading 2", value: "h2" },
  { label: "Heading 3", value: "h3" },
  { label: "Subheading", value: "h4" },
];
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];
const QUICK_COLOURS = [
  ["#12161c", "Dark"], ["#3654D6", "Indigo"], ["#2B7A6E", "Teal"],
  ["#B7791F", "Amber"], ["#B85C4A", "Coral"], ["#6D3FA3", "Violet"],
];
const QUICK_HIGHLIGHTS = [
  ["#fef08a", "Yellow"], ["#bbf7d0", "Green"], ["#bfdbfe", "Blue"],
  ["#fecaca", "Red"], ["#e9d5ff", "Purple"],
];

const selectCls = "rounded border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-1 py-1 text-[11px] text-[var(--color-ink-soft)]";
const DIVIDER = <span className="mx-0.5 h-5 w-px bg-[var(--color-line)]" />;

// Warn before closing/reloading while an editor holds changes it has not yet
// handed to the parent (typed since the last blur). Cleared on commit.
const dirtyEditors = new Set();
let unloadGuardInstalled = false;
function installUnloadGuard() {
  if (unloadGuardInstalled || typeof window === "undefined") return;
  unloadGuardInstalled = true;
  window.addEventListener("beforeunload", (e) => {
    if (!dirtyEditors.size) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

/** Toolbar button. mousedown is cancelled so the editor keeps focus AND its
 * selection; the click then formats the (still intact) selection. */
function ToolbarButton({ label, icon: Icon, onClick, active = false, disabled = false }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      tabIndex={-1}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--color-line)]/40 disabled:opacity-40 ${active ? "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "text-[var(--color-ink-soft)]"}`}
    >
      <Icon size={15} />
    </button>
  );
}

/** <input type=color> that reports only the final choice (native `change`),
 * not every drag step of the picker, so one pick = one undo step. */
function ColorInput({ label, defaultValue, onPick, onOpen }) {
  const ref = useRef(null);
  const pickRef = useRef(onPick);
  useEffect(() => { pickRef.current = onPick; });
  useEffect(() => {
    const el = ref.current;
    const handler = () => pickRef.current(el.value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);
  return (
    <input ref={ref} type="color" aria-label={label} title={label} defaultValue={defaultValue} onMouseDown={onOpen} onFocus={onOpen} className="h-6 w-7 cursor-pointer rounded border border-[var(--color-line)] bg-transparent p-0.5" />
  );
}

function richTextPaste(event) {
  const html = event.clipboardData?.getData("text/html");
  if (!html) return;
  event.preventDefault();
  const mathResolved = resolveMathAnnotationsInHtml(html);
  document.execCommand("insertHTML", false, sanitizeHtml(mathResolved));
}

export function RichTextEditor({ value, onChange, draftScope }) {
  const editorRef = useRef(null);
  const selRef = useRef(null); // last known selection inside the editor, as text offsets
  const historyRef = useRef(null);
  const lastValueRef = useRef(value ?? ""); // the saved/emitted html this editor is in sync with
  const dirtyRef = useRef(false);
  const recordTimer = useRef(null);
  const draftTimer = useRef(null);
  const hadFocusRef = useRef(false);
  // A draft restored on mount is held locally only: it is NOT handed to the parent
  // (so nothing is written to the server) until the admin edits it.
  const untouchedRestoreRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const [toolbar, setToolbar] = useState({ block: "p" });
  const [history, setHistoryFlags] = useState({ undo: false, redo: false });
  const [notice, setNotice] = useState(null); // { kind: "restored" | "conflict", draft }
  useEffect(() => { onChangeRef.current = onChange; });

  const editorHtml = () => ops.serializeEditorHtml(editorRef.current);

  // ------------------------------------------------------------- selection
  const readLiveOffsets = useCallback(() => {
    const el = editorRef.current;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!el || !sel || sel.rangeCount === 0) return null;
    return ops.getOffsets(el, sel.getRangeAt(0));
  }, []);

  const restoreSelection = useCallback((offsets, { focus = true } = {}) => {
    const el = editorRef.current;
    if (!el || !offsets) return;
    if (focus) el.focus({ preventScroll: true });
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(ops.rangeFromOffsets(el, offsets));
  }, []);

  const refreshToolbar = useCallback((offsets) => {
    const el = editorRef.current;
    if (!el || !offsets) return;
    const next = ops.queryState(el, offsets);
    setToolbar((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  const captureSelection = useCallback(() => {
    const live = readLiveOffsets();
    if (live) selRef.current = live;
  }, [readLiveOffsets]);

  // Keeps selRef in sync with every real selection change (mouse, keyboard,
  // drag, triple-click) with zero per-control wiring. Selection changes that
  // land outside this editor (toolbar select, colour dialog) are ignored, so
  // selRef keeps the last in-editor selection through those interactions.
  useEffect(() => {
    let raf = 0;
    const onSelectionChange = () => {
      const live = readLiveOffsets();
      if (!live) return;
      selRef.current = live;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => refreshToolbar(live));
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => { document.removeEventListener("selectionchange", onSelectionChange); cancelAnimationFrame(raf); };
  }, [readLiveOffsets, refreshToolbar]);

  // ------------------------------------------------- history / draft / emit
  const syncHistoryFlags = useCallback(() => {
    const h = historyRef.current;
    if (!h) return;
    setHistoryFlags((p) => (p.undo === h.canUndo() && p.redo === h.canRedo() ? p : { undo: h.canUndo(), redo: h.canRedo() }));
  }, []);

  const recordNow = useCallback(() => {
    clearTimeout(recordTimer.current);
    recordTimer.current = null;
    const el = editorRef.current;
    if (!el || !historyRef.current) return;
    historyRef.current.record({ html: el.innerHTML, sel: selRef.current });
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const writeDraft = useCallback(() => {
    clearTimeout(draftTimer.current);
    draftTimer.current = null;
    if (!draftScope || !editorRef.current || !dirtyRef.current) return;
    saveDraft(draftScope, {
      html: editorHtml(),
      baseHash: hashString(lastValueRef.current),
      savedAt: Date.now(),
      sel: selRef.current,
      hadFocus: hadFocusRef.current,
    });
  }, [draftScope]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    untouchedRestoreRef.current = false;
    installUnloadGuard();
    dirtyEditors.add(editorRef);
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(writeDraft, 300);
  }, [writeDraft]);

  /** Hands the current html to the parent (which saves it). Only when edited. */
  const commit = useCallback(() => {
    if (!dirtyRef.current || !editorRef.current || untouchedRestoreRef.current) return;
    recordNow();
    const html = editorHtml();
    dirtyRef.current = false;
    dirtyEditors.delete(editorRef);
    clearTimeout(draftTimer.current);
    lastValueRef.current = html;
    if (draftScope) {
      // The draft now describes content we have handed to the parent; keep it
      // (re-based on the new value) until the parent's saved value matches it,
      // so a failed save can still be recovered after a reload.
      saveDraft(draftScope, { html, baseHash: hashString(html), savedAt: Date.now(), sel: selRef.current, hadFocus: hadFocusRef.current, committed: true });
    }
    onChangeRef.current?.(html);
  }, [draftScope, recordNow]);

  const afterMutation = useCallback((offsets) => {
    selRef.current = offsets;
    restoreSelection(offsets);
    recordNow();
    markDirty();
    refreshToolbar(offsets);
  }, [markDirty, recordNow, refreshToolbar, restoreSelection]);

  const applySnapshot = useCallback((snap) => {
    const el = editorRef.current;
    if (!snap || !el) return;
    el.innerHTML = snap.html;
    const sel = snap.sel || { start: 0, end: 0 };
    selRef.current = sel;
    restoreSelection(sel);
    markDirty();
    refreshToolbar(sel);
    syncHistoryFlags();
  }, [markDirty, refreshToolbar, restoreSelection, syncHistoryFlags]);

  const undo = useCallback(() => {
    recordNow();
    if (historyRef.current?.canUndo()) applySnapshot(historyRef.current.undo());
  }, [applySnapshot, recordNow]);
  const redo = useCallback(() => {
    recordNow();
    if (historyRef.current?.canRedo()) applySnapshot(historyRef.current.redo());
  }, [applySnapshot, recordNow]);

  /** Runs a formatting op on the current (or last saved) selection. */
  const run = useCallback((fn) => {
    const el = editorRef.current;
    if (!el) return;
    recordNow(); // typing so far becomes its own undo step
    const offsets = readLiveOffsets() || selRef.current;
    if (!offsets) return;
    const out = fn(el, offsets) || offsets;
    afterMutation(out);
  }, [afterMutation, readLiveOffsets, recordNow]);

  // ------------------------------------------------------- mount / external
  useLayoutEffect(() => {
    const el = editorRef.current;
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* not supported */ }
    el.innerHTML = resolveMathAnnotationsInHtml(value ?? "");
    lastValueRef.current = value ?? "";
    historyRef.current = createHistory({ html: el.innerHTML, sel: null });

    if (draftScope) {
      const draft = loadDraft(draftScope);
      const verdict = decideDraft(draft, value ?? "");
      if (verdict === "none" && draft) clearDraft(draftScope);
      if (verdict === "restore") {
        el.innerHTML = resolveMathAnnotationsInHtml(draft.html);
        historyRef.current = createHistory({ html: resolveMathAnnotationsInHtml(value ?? ""), sel: null });
        historyRef.current.record({ html: el.innerHTML, sel: draft.sel || null });
        dirtyRef.current = true;
        untouchedRestoreRef.current = true;
        installUnloadGuard();
        dirtyEditors.add(editorRef);
        selRef.current = draft.sel || null;
        setNotice({ kind: "restored", draft });
        setHistoryFlags({ undo: true, redo: false });
        if (draft.hadFocus && draft.sel) restoreSelection(draft.sel);
      } else if (verdict === "conflict") {
        setNotice({ kind: "conflict", draft });
      }
    }
    return () => {
      // Never lose what was typed: hand it to the parent when the editor goes
      // away (block collapsed, navigation), then drop timers.
      clearTimeout(recordTimer.current);
      clearTimeout(draftTimer.current);
      if (dirtyRef.current && !untouchedRestoreRef.current) {
        const html = ops.serializeEditorHtml(el);
        dirtyRef.current = false;
        if (html !== lastValueRef.current) onChangeRef.current?.(html);
      }
      dirtyEditors.delete(editorRef);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The parent's value changed to something this editor did not produce (e.g.
  // block-level undo, a reload of the lesson): adopt it, unless the admin is
  // mid-edit here. Values we emitted ourselves are ignored, so React never
  // re-writes the DOM under the user's selection.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || (value ?? "") === lastValueRef.current) return;
    if (dirtyRef.current && document.activeElement === el) return;
    lastValueRef.current = value ?? "";
    el.innerHTML = resolveMathAnnotationsInHtml(value ?? "");
    historyRef.current = createHistory({ html: el.innerHTML, sel: null });
    dirtyRef.current = false;
    setHistoryFlags({ undo: false, redo: false });
  }, [value]);

  // Persist the draft right away when the tab is hidden or the page unloads
  // (the debounce could otherwise still be pending).
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) { captureSelection(); writeDraft(); } };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", flush); };
  }, [captureSelection, writeDraft]);

  // ------------------------------------------------------------ draft notice
  function discardDraft() {
    const el = editorRef.current;
    clearDraft(draftScope);
    if (notice?.kind === "restored") {
      el.innerHTML = resolveMathAnnotationsInHtml(lastValueRef.current);
      historyRef.current = createHistory({ html: el.innerHTML, sel: null });
      dirtyRef.current = false;
      untouchedRestoreRef.current = false;
      dirtyEditors.delete(editorRef);
      setHistoryFlags({ undo: false, redo: false });
    }
    setNotice(null);
  }
  function applyConflictDraft() {
    const el = editorRef.current;
    el.innerHTML = resolveMathAnnotationsInHtml(notice.draft.html);
    historyRef.current = createHistory({ html: resolveMathAnnotationsInHtml(lastValueRef.current), sel: null });
    historyRef.current.record({ html: el.innerHTML, sel: null });
    markDirty();
    setHistoryFlags({ undo: true, redo: false });
    setNotice(null);
  }

  // --------------------------------------------------------------- handlers
  function handleInput() {
    markDirty();
    clearTimeout(recordTimer.current);
    recordTimer.current = setTimeout(recordNow, 400);
    captureSelection();
  }

  function handleKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.altKey) return;
    const k = e.key.toLowerCase();
    let handled = true;
    if (k === "z" && !e.shiftKey) undo();
    else if ((k === "z" && e.shiftKey) || k === "y") redo();
    else if (k === "b") run((el, o) => ops.toggleInline(el, o, "b"));
    else if (k === "i") run((el, o) => ops.toggleInline(el, o, "i"));
    else if (k === "u") run((el, o) => ops.toggleInline(el, o, "u"));
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  function handleBeforeInput(e) {
    if (e.inputType === "historyUndo") { e.preventDefault(); undo(); }
    else if (e.inputType === "historyRedo") { e.preventDefault(); redo(); }
  }

  function handleFocus() {
    // NOTE: do not call document.execCommand here. Running it inside the focus
    // event of the very mousedown that focuses the editor cancels the browser's
    // in-progress drag selection (the first drag after clicking in from outside
    // produced a collapsed caret). defaultParagraphSeparator is set once on mount.
    hadFocusRef.current = true;
  }

  function handleBlur() {
    hadFocusRef.current = false;
    captureSelection();
    commit();
  }

  function handleLink() {
    const offsets = readLiveOffsets() || selRef.current;
    if (!offsets || offsets.start === offsets.end) return;
    const url = window.prompt("Link URL");
    if (!url) return;
    run((el) => ops.applyLink(el, offsets, url));
  }

  const s = toolbar;
  const inline = (key) => (el, o) => ops.toggleInline(el, o, key);

  return (
    <div>
      <div role="toolbar" aria-label="Text formatting" className="mb-1.5 flex flex-wrap items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-1">
        <ToolbarButton label="Undo" icon={Undo2} disabled={!history.undo} onClick={undo} />
        <ToolbarButton label="Redo" icon={Redo2} disabled={!history.redo} onClick={redo} />
        {DIVIDER}
        <select title="Paragraph style" aria-label="Paragraph style" value={PARAGRAPH_STYLES.some((p) => p.value === s.block) ? s.block : "p"} onMouseDown={captureSelection} onChange={(e) => { const v = e.target.value; run((el, o) => ops.setBlockTag(el, o, v)); }} className={selectCls}>
          {PARAGRAPH_STYLES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select title="Font family" aria-label="Font family" value="" onMouseDown={captureSelection} onChange={(e) => { const v = e.target.value; run((el, o) => ops.applyInlineStyle(el, o, "fontFamily", v === "__default" ? null : v)); }} className={`max-w-[7.5rem] ${selectCls}`}>
          <option value="">Font</option>
          <option value="__default">Default</option>
          {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
        <select title="Font size" aria-label="Font size" value="" onMouseDown={captureSelection} onChange={(e) => { const v = e.target.value; run((el, o) => ops.applyInlineStyle(el, o, "fontSize", v === "__default" ? null : `${v}px`)); }} className={selectCls}>
          <option value="">{s.fontSize ? s.fontSize.replace("px", "") : "Size"}</option>
          <option value="__default">Default</option>
          {FONT_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        {DIVIDER}
        <ToolbarButton label="Bold" icon={Bold} active={s.b} onClick={() => run(inline("b"))} />
        <ToolbarButton label="Italic" icon={Italic} active={s.i} onClick={() => run(inline("i"))} />
        <ToolbarButton label="Underline" icon={Underline} active={s.u} onClick={() => run(inline("u"))} />
        <ToolbarButton label="Strikethrough" icon={Strikethrough} active={s.s} onClick={() => run(inline("s"))} />
        <ToolbarButton label="Superscript" icon={Superscript} active={s.sup} onClick={() => run(inline("sup"))} />
        <ToolbarButton label="Subscript" icon={Subscript} active={s.sub} onClick={() => run(inline("sub"))} />

        {DIVIDER}
        <span className="px-1 text-[11px] text-[var(--color-ink-soft)]">Text Colour</span>
        {QUICK_COLOURS.map(([colour, name]) => (
          <button key={colour} type="button" tabIndex={-1} title={`Text colour: ${name}`} aria-label={`Text colour ${name}`} onMouseDown={(e) => e.preventDefault()} onClick={() => run((el, o) => ops.applyInlineStyle(el, o, "color", colour))} className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: colour }} />
        ))}
        <label className="flex items-center gap-1 px-1 text-[11px] text-[var(--color-ink-soft)]" title="Custom text colour">
          Custom
          <ColorInput label="Custom text colour" defaultValue="#12161c" onOpen={captureSelection} onPick={(v) => run((el, o) => ops.applyInlineStyle(el, o, "color", v))} />
        </label>
        <ToolbarButton label="Default text colour" icon={Eraser} onClick={() => run((el, o) => ops.applyInlineStyle(el, o, "color", null))} />

        {DIVIDER}
        <span className="px-1 text-[11px] text-[var(--color-ink-soft)]">Highlight</span>
        {QUICK_HIGHLIGHTS.map(([colour, name]) => (
          <button key={colour} type="button" tabIndex={-1} title={`Highlight: ${name}`} aria-label={`Highlight ${name}`} onMouseDown={(e) => e.preventDefault()} onClick={() => run((el, o) => ops.applyInlineStyle(el, o, "backgroundColor", colour))} className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: colour }} />
        ))}
        <label className="flex items-center gap-1 px-1 text-[11px] text-[var(--color-ink-soft)]" title="Custom highlight colour">
          Custom
          <ColorInput label="Custom highlight colour" defaultValue="#fef08a" onOpen={captureSelection} onPick={(v) => run((el, o) => ops.applyInlineStyle(el, o, "backgroundColor", v))} />
        </label>
        <ToolbarButton label="Remove Highlight" icon={Highlighter} onClick={() => run((el, o) => ops.applyInlineStyle(el, o, "backgroundColor", null))} />

        {DIVIDER}
        <ToolbarButton label="Bullets" icon={List} active={s.list === "ul"} onClick={() => run((el, o) => ops.toggleList(el, o, "ul"))} />
        <ToolbarButton label="Numbered List" icon={ListOrdered} active={s.list === "ol"} onClick={() => run((el, o) => ops.toggleList(el, o, "ol"))} />
        <ToolbarButton label="Decrease Indent" icon={IndentDecrease} onClick={() => run((el, o) => ops.indentBlocks(el, o, -1))} />
        <ToolbarButton label="Increase Indent" icon={IndentIncrease} onClick={() => run((el, o) => ops.indentBlocks(el, o, 1))} />

        {DIVIDER}
        <ToolbarButton label="Align Left" icon={AlignLeft} active={s.align === "left"} onClick={() => run((el, o) => ops.setAlign(el, o, "left"))} />
        <ToolbarButton label="Align Center" icon={AlignCenter} active={s.align === "center"} onClick={() => run((el, o) => ops.setAlign(el, o, "center"))} />
        <ToolbarButton label="Align Right" icon={AlignRight} active={s.align === "right"} onClick={() => run((el, o) => ops.setAlign(el, o, "right"))} />
        <ToolbarButton label="Justify" icon={AlignJustify} active={s.align === "justify"} onClick={() => run((el, o) => ops.setAlign(el, o, "justify"))} />

        {DIVIDER}
        <ToolbarButton label="Link" icon={Link2} onClick={handleLink} />
        <ToolbarButton label="Clear Formatting" icon={RemoveFormatting} onClick={() => run((el, o) => ops.clearInlineFormatting(el, o))} />
      </div>

      {notice && (
        <div role="status" data-testid="rte-draft-notice" className="mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 px-3 py-1.5 text-xs text-[var(--color-ink)]">
          <span>
            {notice.kind === "restored"
              ? "Unsaved draft restored."
              : "An unsaved draft from this browser differs from the saved lesson (the lesson was saved since). It was not applied."}
          </span>
          <span className="flex items-center gap-2">
            {notice.kind === "conflict" && <button type="button" onClick={applyConflictDraft} className="font-semibold text-[var(--color-indigo)]">Restore draft</button>}
            <button type="button" onClick={discardDraft} className="inline-flex items-center gap-1 font-semibold text-[var(--color-coral)]"><X size={12} /> Discard</button>
          </span>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Rich text"
        spellCheck
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBeforeInput={handleBeforeInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={richTextPaste}
        className={`min-h-[100px] rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none ${RICH_TEXT_TYPOGRAPHY}`}
      />
    </div>
  );
}

export default RichTextEditor;
