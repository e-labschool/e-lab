// Pure DOM operations behind the admin Rich Text editor (RichTextEditor in
// src/data/learnBlockRegistry.jsx). Everything here works on a plain DOM
// subtree (`root` = the contentEditable element) and a SELECTION EXPRESSED
// AS TEXT OFFSETS, so it can be unit-tested in jsdom (which has no
// execCommand) and so the selection survives any DOM restructuring or
// React re-render: a DOM Range points at nodes that formatting splits,
// merges or replaces, whereas "characters 40..52 of the editor's text" is
// stable across all of that. See docs/RICH_TEXT_EDITOR.md.
//
// Why Range-based ops instead of document.execCommand: execCommand
// ("fontSize") only knows the legacy 1-7 sizes, wraps a whole paragraph in
// some browsers when the selection touches its edges, and mixes badly with
// manual DOM edits (native undo is lost). These functions wrap ONLY the
// selected text, in spans with real inline styles (font-size:24px).

export const ZWSP = "\u200B";
const INLINE_FORMAT_TAGS = new Set(["SPAN", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "SUB", "SUP", "FONT", "MARK"]);
const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "UL", "OL", "BLOCKQUOTE", "PRE", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "FIGURE", "HR"]);
const LEAF_CANDIDATES = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE"]);
const LIST_TAGS = new Set(["UL", "OL"]);
export const INDENT_STEP_PX = 24;
export const MAX_INDENT_PX = 240;

const isEl = (n) => n && n.nodeType === 1;
const isText = (n) => n && n.nodeType === 3;
const isBlockEl = (n) => isEl(n) && BLOCK_TAGS.has(n.tagName);
const kebab = (p) => p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

// ---------------------------------------------------------------- offsets

export function textNodesOf(root) {
  const out = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
  return out;
}

function offsetOfPoint(root, node, offset) {
  const r = root.ownerDocument.createRange();
  r.setStart(root, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Selection range -> {start,end} text offsets inside `root`, or null if the
 * range is not inside it. */
export function getOffsets(root, range) {
  if (!range || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetOfPoint(root, range.startContainer, range.startOffset);
  const end = offsetOfPoint(root, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

/** {start,end} -> a tight DOM Range (start prefers the beginning of the next
 * text node, end the end of the previous one, so a selection that merely
 * touches a paragraph boundary never leaks into the next block). */
export function rangeFromOffsets(root, { start, end }) {
  const doc = root.ownerDocument;
  const r = doc.createRange();
  const nodes = textNodesOf(root);
  if (!nodes.length) {
    r.selectNodeContents(root);
    r.collapse(true);
    return r;
  }
  const total = nodes.reduce((n, t) => n + t.data.length, 0);
  const s = Math.max(0, Math.min(start, total));
  const e = Math.max(s, Math.min(end, total));
  const collapsed = s === e;
  let pos = 0;
  let startSet = false;
  let endSet = false;
  for (const t of nodes) {
    const len = t.data.length;
    if (!startSet && (collapsed ? s <= pos + len : s < pos + len)) {
      r.setStart(t, s - pos);
      startSet = true;
    }
    if (!endSet && e <= pos + len && (e > pos || (e === pos && (pos === 0 || collapsed)))) {
      r.setEnd(t, e - pos);
      endSet = true;
    }
    pos += len;
    if (startSet && endSet) break;
  }
  const last = nodes[nodes.length - 1];
  if (!startSet) r.setStart(last, last.data.length);
  if (!endSet) r.setEnd(last, last.data.length);
  if (collapsed) r.collapse(false);
  return r;
}

function structuralWhitespace(t, root) {
  if (!/^\s*$/.test(t.data)) return false;
  const p = t.parentNode;
  if (p === root || LIST_TAGS.has(p.tagName) || p.tagName === "TABLE" || p.tagName === "TBODY" || p.tagName === "TR") return true;
  return Array.from(p.childNodes).some(isBlockEl);
}

/** Splits text nodes at the selection edges and returns exactly the text
 * nodes covered by [start,end). */
export function isolateTextNodes(root, { start, end }) {
  if (end <= start) return [];
  const bounds = [start, end];
  for (const b of bounds) {
    let pos = 0;
    for (const t of textNodesOf(root)) {
      const len = t.data.length;
      if (b > pos && b < pos + len) {
        t.splitText(b - pos);
        break;
      }
      pos += len;
    }
  }
  const out = [];
  let pos = 0;
  for (const t of textNodesOf(root)) {
    const len = t.data.length;
    if (len && pos >= start && pos + len <= end && !structuralWhitespace(t, root)) out.push(t);
    pos += len;
  }
  return out;
}

// ---------------------------------------------------------------- helpers

function unwrap(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function splitParentAroundChild(parent, child) {
  if (child.previousSibling) {
    const before = parent.cloneNode(false);
    while (parent.firstChild !== child) before.appendChild(parent.firstChild);
    parent.parentNode.insertBefore(before, parent);
  }
  if (child.nextSibling) {
    const after = parent.cloneNode(false);
    while (child.nextSibling) after.appendChild(child.nextSibling);
    parent.parentNode.insertBefore(after, parent.nextSibling);
  }
}

/** Splits `ancestor` (and every element between it and `node`) so that one
 * piece of `ancestor` contains nothing but `node`'s chain. */
function isolateWithin(ancestor, node) {
  let current = node;
  while (current !== ancestor) {
    const parent = current.parentNode;
    splitParentAroundChild(parent, current);
    current = parent;
  }
  return ancestor;
}

function inlineAncestors(node, root) {
  const out = [];
  for (let n = node.parentNode; n && n !== root; n = n.parentNode) {
    if (isBlockEl(n)) break;
    if (isEl(n)) out.push(n);
  }
  return out;
}

const isPureStyleSpan = (el) => el.tagName === "SPAN" && Array.from(el.attributes).every((a) => a.name === "style");

// ------------------------------------------------------------ normalisation

/** Removes empty inline wrappers, merges nested/adjacent equivalent spans and
 * adjacent same-tag formatting elements. Never changes the text. */
export function normalizeInline(root) {
  const doc = root.ownerDocument;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    const els = Array.from(root.querySelectorAll("span,b,strong,i,em,u,s,strike,del,sub,sup,font,mark"));
    for (const el of els) {
      if (!root.contains(el)) continue;
      if (el.tagName === "SPAN" && !el.getAttribute("style")?.trim() && Array.from(el.attributes).every((a) => a.name === "style")) {
        unwrap(el);
        changed = true;
        continue;
      }
      if (!el.firstChild) { el.remove(); changed = true; continue; }
      // span > span (only child): merge, inner style wins
      if (isPureStyleSpan(el) && el.childNodes.length === 1 && isEl(el.firstChild) && isPureStyleSpan(el.firstChild)) {
        const inner = el.firstChild;
        const merged = `${el.getAttribute("style") || ""};${inner.getAttribute("style") || ""}`;
        el.setAttribute("style", mergeStyleText(doc, merged));
        unwrap(inner);
        changed = true;
        continue;
      }
      const prev = el.previousSibling;
      if (prev && isEl(prev) && prev.tagName === el.tagName && sameAttrs(prev, el)) {
        while (el.firstChild) prev.appendChild(el.firstChild);
        el.remove();
        changed = true;
      }
    }
    root.normalize();
  }
}

function mergeStyleText(doc, text) {
  const probe = doc.createElement("span");
  for (const decl of text.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    probe.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
  }
  return probe.getAttribute("style") || "";
}

function sameAttrs(a, b) {
  if (a.attributes.length !== b.attributes.length) return false;
  for (const attr of Array.from(a.attributes)) if (b.getAttribute(attr.name) !== attr.value) return false;
  return true;
}

/** Wraps stray inline/text nodes that sit directly under `root` in <p>. */
export function ensureBlocks(root) {
  const doc = root.ownerDocument;
  let run = null;
  for (const node of Array.from(root.childNodes)) {
    const inline = isText(node) ? !/^\s*$/.test(node.data) || run : isEl(node) && !isBlockEl(node);
    if (inline) {
      if (!run) {
        run = doc.createElement("p");
        root.insertBefore(run, node);
      }
      run.appendChild(node);
    } else {
      run = null;
    }
  }
  if (!root.firstChild) {
    const p = doc.createElement("p");
    p.appendChild(doc.createElement("br"));
    root.appendChild(p);
  }
}

// ----------------------------------------------------------- inline styles

/** Wraps a collapsed caret in a ZWSP text node so inline ops can treat it as a
 * 1-character selection (typing continues inside the new formatting). */
function materialiseCaret(root, offsets) {
  const doc = root.ownerDocument;
  const r = rangeFromOffsets(root, offsets);
  const z = doc.createTextNode(ZWSP);
  if (isText(r.startContainer)) {
    const t = r.startContainer;
    const tail = t.splitText(r.startOffset);
    t.parentNode.insertBefore(z, tail);
  } else {
    r.insertNode(z);
  }
  return { start: offsets.start, end: offsets.start + 1 };
}

function afterCaretOps(offsets, materialised) {
  return materialised ? { start: offsets.start + 1, end: offsets.start + 1 } : offsets;
}

/** Applies `prop: value` (camelCase CSS prop) to ONLY the selected text.
 * `value === null` removes the property from the selected text. Returns the
 * selection offsets to restore afterwards. */
export function applyInlineStyle(root, offsets, prop, value) {
  ensureBlocks(root);
  const collapsed = offsets.start === offsets.end;
  if (collapsed && value === null) return offsets;
  const work = collapsed ? materialiseCaret(root, offsets) : offsets;
  const nodes = isolateTextNodes(root, work);
  const css = kebab(prop);
  const doc = root.ownerDocument;
  for (const t of nodes) {
    if (value === null) {
      const holder = inlineAncestors(t, root).find((a) => a.tagName === "SPAN" && a.style.getPropertyValue(css));
      if (!holder) continue;
      isolateWithin(holder, t);
      holder.style.removeProperty(css);
      if (!holder.getAttribute("style")) holder.removeAttribute("style");
      continue;
    }
    const parent = t.parentNode;
    // Overriding a value an ancestor span already sets: split that span so
    // only the selected text changes (no nested duplicate spans).
    const holder = inlineAncestors(t, root).find((a) => isPureStyleSpan(a) && a.style.getPropertyValue(css));
    if (holder) {
      isolateWithin(holder, t);
      holder.style.setProperty(css, value);
    } else if (parent !== root && isPureStyleSpan(parent) && parent.childNodes.length === 1) {
      parent.style.setProperty(css, value);
    } else {
      const span = doc.createElement("span");
      span.style.setProperty(css, value);
      parent.insertBefore(span, t);
      span.appendChild(t);
    }
  }
  normalizeInline(root);
  return afterCaretOps(offsets, collapsed);
}

const TAG_MATCHERS = {
  b: (el) => el.tagName === "B" || el.tagName === "STRONG" || /^(bold|[6-9]00)$/.test(el.style?.fontWeight || ""),
  i: (el) => el.tagName === "I" || el.tagName === "EM" || el.style?.fontStyle === "italic",
  u: (el) => el.tagName === "U" || /underline/.test(el.style?.textDecoration || el.style?.textDecorationLine || ""),
  s: (el) => el.tagName === "S" || el.tagName === "STRIKE" || el.tagName === "DEL" || /line-through/.test(el.style?.textDecoration || el.style?.textDecorationLine || ""),
  sub: (el) => el.tagName === "SUB",
  sup: (el) => el.tagName === "SUP",
};

function removeMatcherFrom(el, key) {
  // Style-based variants are removed by editing the style; tag variants unwrap.
  if (el.tagName === "SPAN") {
    if (key === "b") el.style.removeProperty("font-weight");
    if (key === "i") el.style.removeProperty("font-style");
    if (key === "u" || key === "s") {
      const token = key === "u" ? "underline" : "line-through";
      const cur = (el.style.textDecoration || el.style.textDecorationLine || "").split(/\s+/).filter((x) => x && x !== token);
      if (cur.length) el.style.setProperty("text-decoration", cur.join(" ")); else el.style.removeProperty("text-decoration");
    }
    if (!el.getAttribute("style")) el.removeAttribute("style");
  } else {
    unwrap(el);
  }
}

/** Toggles bold/italic/underline/strike/sub/sup (key b,i,u,s,sub,sup) on the
 * selection. If every selected character already has it, it is removed;
 * otherwise it is added to all of them. */
export function toggleInline(root, offsets, key, { force } = {}) {
  ensureBlocks(root);
  const collapsed = offsets.start === offsets.end;
  const work = collapsed ? materialiseCaret(root, offsets) : offsets;
  const nodes = isolateTextNodes(root, work);
  const doc = root.ownerDocument;
  const match = TAG_MATCHERS[key];
  const has = (t) => inlineAncestors(t, root).some(match);
  const remove = force === "remove" || (force !== "add" && nodes.length > 0 && nodes.every(has));
  const opposite = key === "sub" ? "sup" : key === "sup" ? "sub" : null;
  for (const t of nodes) {
    if (remove) {
      for (const anc of inlineAncestors(t, root).filter(match)) {
        isolateWithin(anc, t);
        removeMatcherFrom(anc, key);
      }
      continue;
    }
    if (opposite) {
      for (const anc of inlineAncestors(t, root).filter(TAG_MATCHERS[opposite])) {
        isolateWithin(anc, t);
        removeMatcherFrom(anc, opposite);
      }
    }
    if (has(t)) continue;
    const wrap = doc.createElement(key);
    t.parentNode.insertBefore(wrap, t);
    wrap.appendChild(t);
  }
  normalizeInline(root);
  return afterCaretOps(offsets, collapsed);
}

/** Removes inline formatting (spans, b/i/u/s/sub/sup/font/mark) from the
 * SELECTED text only; links and block structure are kept. */
export function clearInlineFormatting(root, offsets) {
  if (offsets.start === offsets.end) return offsets;
  ensureBlocks(root);
  for (const t of isolateTextNodes(root, offsets)) {
    let guard = 0;
    for (;;) {
      const fmt = inlineAncestors(t, root).filter((a) => INLINE_FORMAT_TAGS.has(a.tagName));
      const outer = fmt[fmt.length - 1];
      if (!outer || guard++ > 30) break;
      isolateWithin(outer, t);
      unwrap(outer);
    }
  }
  normalizeInline(root);
  return offsets;
}

/** Wraps selected text in <a href>. */
export function applyLink(root, offsets, href) {
  const safe = String(href || "").trim();
  if (!safe || /^\s*(javascript|data|vbscript):/i.test(safe)) return offsets;
  ensureBlocks(root);
  const doc = root.ownerDocument;
  for (const t of isolateTextNodes(root, offsets)) {
    const existing = inlineAncestors(t, root).find((a) => a.tagName === "A");
    if (existing) { existing.setAttribute("href", safe); continue; }
    const a = doc.createElement("a");
    a.setAttribute("href", safe);
    t.parentNode.insertBefore(a, t);
    a.appendChild(t);
  }
  normalizeInline(root);
  return offsets;
}

// ------------------------------------------------------------------ blocks

function hasBlockChild(el) {
  return Array.from(el.childNodes).some((c) => isBlockEl(c) && !(el.tagName === "LI" && LIST_TAGS.has(c.tagName)));
}

function isLeafBlock(el) {
  return LEAF_CANDIDATES.has(el.tagName) && !hasBlockChild(el);
}

function ownContentIntersects(el, range) {
  if (el.tagName !== "LI") return range.intersectsNode(el);
  return Array.from(el.childNodes).some((c) => !LIST_TAGS.has(c.tagName) && range.intersectsNode(c));
}

/** Leaf blocks (p, h1-h6, div, li, blockquote, pre) touched by the selection. */
export function selectedBlocks(root, offsets) {
  ensureBlocks(root);
  const range = rangeFromOffsets(root, offsets);
  const collapsed = offsets.start === offsets.end;
  const all = Array.from(root.querySelectorAll("p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre")).filter(isLeafBlock);
  if (collapsed) {
    const b = closestLeaf(range.startContainer, root);
    return b ? [b] : [];
  }
  return all.filter((b) => ownContentIntersects(b, range));
}

function closestLeaf(node, root) {
  for (let n = isText(node) ? node.parentNode : node; n && n !== root; n = n.parentNode) {
    if (isEl(n) && LEAF_CANDIDATES.has(n.tagName) && isLeafBlock(n)) return n;
    if (isEl(n) && n.tagName === "LI") return n;
  }
  return null;
}

function renameElement(el, tag) {
  const doc = el.ownerDocument;
  const next = doc.createElement(tag);
  for (const a of Array.from(el.attributes)) next.setAttribute(a.name, a.value);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.parentNode.replaceChild(next, el);
  return next;
}

/** li -> p (or the given tag), splitting its list around it. Nested lists stay after it. */
function liftListItem(li, tag = "p") {
  const doc = li.ownerDocument;
  const list = li.parentNode;
  const nested = Array.from(li.childNodes).filter((c) => isEl(c) && LIST_TAGS.has(c.tagName));
  const p = doc.createElement(tag);
  const style = li.getAttribute("style");
  if (style) p.setAttribute("style", style);
  while (li.firstChild && !(isEl(li.firstChild) && LIST_TAGS.has(li.firstChild.tagName))) p.appendChild(li.firstChild);
  if (!p.firstChild) p.appendChild(doc.createElement("br"));
  // Split the list around the item.
  const parentOfList = list.parentNode;
  if (parentOfList && parentOfList.tagName === "LI") {
    // nested list: put the paragraph content back into the parent li chain by
    // turning the item into a sibling li of the parent (outdent semantics).
    return null;
  }
  splitParentAroundChild(list, li);
  list.parentNode.insertBefore(p, list);
  for (const n of nested) list.parentNode.insertBefore(n, list);
  list.remove();
  return p;
}

/** Sets the block style of every selected block: "p", "h1", "h2", "h3", "h4". */
export function setBlockTag(root, offsets, tag) {
  const want = tag.toUpperCase();
  for (const block of selectedBlocks(root, offsets)) {
    let b = block;
    if (b.tagName === "LI") {
      const lifted = liftListItem(b, tag);
      if (!lifted) continue;
      b = lifted;
    }
    if (b.tagName !== want) renameElement(b, want);
  }
  return offsets;
}

/** Toggles a bulleted ("ul") / numbered ("ol") list on the selected blocks. */
export function toggleList(root, offsets, type) {
  const doc = root.ownerDocument;
  const want = type.toUpperCase();
  const blocks = selectedBlocks(root, offsets);
  if (!blocks.length) return offsets;
  const allInList = blocks.every((b) => b.tagName === "LI" && b.parentNode.tagName === want);
  if (allInList) {
    for (const li of blocks) liftListItem(li);
    return offsets;
  }
  for (const block of blocks) {
    if (block.tagName === "LI") {
      const list = block.parentNode;
      if (list.tagName !== want) {
        splitParentAroundChild(list, block);
        renameElement(list, want);
      }
      continue;
    }
    const li = doc.createElement("li");
    const style = block.getAttribute("style");
    if (style) li.setAttribute("style", style);
    while (block.firstChild) li.appendChild(block.firstChild);
    if (!li.firstChild) li.appendChild(doc.createElement("br"));
    const list = doc.createElement(type);
    list.appendChild(li);
    block.parentNode.replaceChild(list, block);
  }
  mergeAdjacentLists(root);
  return offsets;
}

function mergeAdjacentLists(root) {
  for (const list of Array.from(root.querySelectorAll("ul,ol"))) {
    if (!root.contains(list)) continue;
    let next = list.nextSibling;
    while (next && isEl(next) && next.tagName === list.tagName && sameAttrs(next, list)) {
      while (next.firstChild) list.appendChild(next.firstChild);
      next.remove();
      next = list.nextSibling;
    }
  }
}

/** Indent (+1) / outdent (-1). List items nest/un-nest; other blocks get margin-left. */
export function indentBlocks(root, offsets, dir) {
  const doc = root.ownerDocument;
  for (const block of selectedBlocks(root, offsets)) {
    if (block.tagName === "LI") {
      const list = block.parentNode;
      if (dir > 0) {
        const prev = block.previousElementSibling;
        if (!prev || prev.tagName !== "LI") continue;
        let sub = Array.from(prev.children).reverse().find((c) => LIST_TAGS.has(c.tagName));
        if (!sub) { sub = doc.createElement(list.tagName.toLowerCase()); prev.appendChild(sub); }
        sub.appendChild(block);
      } else {
        const parentLi = list.parentNode;
        if (parentLi && parentLi.tagName === "LI") {
          const following = [];
          while (block.nextSibling) {
            const sib = block.nextSibling;
            block.parentNode.removeChild(sib);
            following.push(sib);
          }
          parentLi.parentNode.insertBefore(block, parentLi.nextSibling);
          if (following.length) {
            const sub = doc.createElement(list.tagName.toLowerCase());
            following.forEach((f) => sub.appendChild(f));
            block.appendChild(sub);
          }
          if (!list.firstChild) list.remove();
        } else {
          liftListItem(block);
        }
      }
      continue;
    }
    const cur = parseInt(block.style.marginLeft || "0", 10) || 0;
    const next = Math.max(0, Math.min(MAX_INDENT_PX, cur + dir * INDENT_STEP_PX));
    if (next) block.style.marginLeft = `${next}px`; else block.style.removeProperty("margin-left");
    if (!block.getAttribute("style")) block.removeAttribute("style");
  }
  return offsets;
}

/** Sets text-align (left|center|right|justify) on every selected block. */
export function setAlign(root, offsets, align) {
  for (const block of selectedBlocks(root, offsets)) block.style.textAlign = align;
  return offsets;
}

// ------------------------------------------------------------------- state

/** Formatting state at the START of the selection (for toolbar highlighting). */
export function queryState(root, offsets) {
  const range = rangeFromOffsets(root, { start: offsets.start, end: offsets.start });
  let node = range.startContainer;
  if (offsets.end > offsets.start) {
    const r2 = rangeFromOffsets(root, offsets);
    node = r2.startContainer;
  }
  const anc = isText(node) ? inlineAncestors(node, root) : [];
  const block = closestLeaf(node, root);
  const state = {};
  for (const k of Object.keys(TAG_MATCHERS)) state[k] = anc.some(TAG_MATCHERS[k]);
  state.block = block ? block.tagName.toLowerCase() : "p";
  state.list = block && block.tagName === "LI" ? block.parentNode.tagName.toLowerCase() : null;
  state.align = block?.style?.textAlign || "";
  const sized = anc.find((a) => a.style?.fontSize);
  state.fontSize = sized ? sized.style.fontSize : "";
  return state;
}

/** Innerhtml for saving: drops ZWSP caret holders and empty wrappers. */
export function serializeEditorHtml(root) {
  const clone = root.cloneNode(true);
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(clone, 4);
  const empties = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.data.includes(ZWSP)) n.data = n.data.split(ZWSP).join("");
    if (!n.data) empties.push(n);
  }
  empties.forEach((n) => n.remove());
  normalizeInline(clone);
  return clone.innerHTML;
}
