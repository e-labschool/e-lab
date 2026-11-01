# Rich Text editor (admin Learn blocks)

Code: `src/components/admin/RichTextEditor.jsx` (UI, history, drafts),
`src/lib/richTextOps.js` (pure DOM formatting), `src/lib/editHistory.js`,
`src/lib/draftStore.js`, `src/lib/sanitizeHtml.js`, `src/lib/richTextStyles.js`.
`learnBlockRegistry.jsx` still exports `RichTextEditor` and `sanitizeHtml`.

## Why selection formatting failed (root causes)

Found by driving the previous editor in headless Chromium (focus-moving
`<select>` after a mouse selection):

1. **Blur -> commit -> React re-wrote `innerHTML`.** Any control that takes focus
   (font family/size/paragraph `<select>`, colour picker) blurred the editor;
   `onBlur` called `onChange(innerHTML)`; the parent updated `value`;
   `dangerouslySetInnerHTML` replaced every DOM node, so the saved `Range` pointed
   at detached nodes. The format then landed on a zero-width `<span>` placed
   *outside* the paragraphs.
2. **`extractContents()` wrapped in a `<span>`**: a multi-paragraph selection
   produced `<span><p>..</p></span>`; triple-click leaked an empty `<p>`.
3. **Manual DOM edits destroyed native undo** (Ctrl+Z did nothing after a size/colour
   change).
4. **The whole block card was `draggable`** (LessonEditor), which competes with
   mouse text selection (Firefox/Safari) and drag-moves selected text.
5. A window-level Ctrl+Z handler in LessonEditor performed *block* undo while
   typing in the editor.

## How it works now

* The editor owns its DOM. React only writes it on mount and when the `value`
  prop is something the editor did not itself emit (and the admin is not
  mid-edit). Echoes of its own value are ignored.
* The selection is stored as **text offsets** (`{start,end}` over the editor's
  text), restored after every operation. Offsets survive node splitting/merging and
  re-renders. A `selectionchange` listener keeps the last in-editor selection;
  selections outside the editor (toolbar `<select>`, colour dialog) are ignored.
* Toolbar buttons cancel `mousedown` (editor keeps focus + selection); selects and
  the colour input capture the selection first and the op restores it and re-focuses
  the editor afterwards.
* Operations are plain DOM functions (jsdom-testable): wrap **only the selected text
  nodes** in `<span style="font-size:24px">` etc., split spans around partial
  re-formatting (no nested duplicates), merge identical neighbours, never wrap a block.
  Block ops (heading, alignment, lists, indent) act on the leaf blocks the selection
  touches; a selection that merely ends at the start of the next paragraph (triple-click)
  does not leak into it.
* Bold/Italic/Underline/Strikethrough/Sub/Sup toggle (all-selected -> remove, else add;
  sub/sup exclusive). Collapsed caret: a zero-width holder is inserted so typing
  continues formatted; holders are stripped on save (`serializeEditorHtml`).
* Undo/redo is an explicit snapshot history (typing debounced, every format op its own
  step, 100 deep) bound to the toolbar, Ctrl/Cmd+Z, Ctrl+Shift+Z/Y and `beforeinput`
  `historyUndo/Redo`.
* Output markup: `h1-h4`, `p`, `span[style]` (`font-size`, `font-family`, `color`,
  `background-color`), `b i u s sub sup`, `ul/ol/li`, `a[href]`, `text-align` and
  `margin-left` on blocks. DOMPurify's allowlist already keeps all of it
  (`sanitizeHtml` adds `style`/`color` explicitly); a test locks the round trip.
* Student Learn and the admin preview use the same typography classes
  (`richTextStyles.js`): H1 1.75rem, H2 1.4rem, H3 1.125rem (as before), H4 1rem;
  `<p>` siblings get a small gap; lists/links/sub/sup as before. Existing lessons: no
  stored content is rewritten; only the new heading sizes and paragraph gap are new CSS.
* Paragraph style options: Normal, Heading 1-3, Subheading (existing `h4`).
  Old "Heading" content (`h3`) renders as before.

## Known limits

* Inline formatting of a *collapsed* caret relies on a zero-width character; if the
  admin moves away without typing, the holder is removed on save.
* Pasted HTML goes through `execCommand('insertHTML')` (sanitised) and is recorded in
  history through the `input` event.
* Native colour **picker dialog** and native `<select>` popups are OS UI; tests drive the
  focus-moving `change` events but not the popup itself.
* Splitting a `⟦math:...⟧` marker across formatting spans would break that marker
  (unchanged behaviour; formatting whole markers is fine).
* Only Chromium was exercised.

## Tests

* `npm run test:rich-text-ops` - 27 jsdom tests of the DOM operations + history.
* `npm run test:rich-text-selection` - real component in jsdom, sanitiser/student round
  trip, draft versioning.
* `npm run verify:rich-text` - headless Chromium on the real admin editor with the mock
  Supabase harness (double-click, Shift+Arrow, triple-click, drag across paragraphs, every
  toolbar control incl. selects, undo/redo, save -> reload, student render, drafts).
