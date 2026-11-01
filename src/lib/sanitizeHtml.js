import DOMPurify from "dompurify";

// The one sanitiser for Learn rich-text HTML (editor paste, student render,
// admin preview). DOMPurify's default allowlist already keeps everything the
// Rich Text editor emits: h1-h4, p, span[style] (font-size/-family, color,
// background-color), b/i/u/s/sub/sup, ul/ol/li, a[href], and style="text-align"
// / "margin-left" on blocks. `style` and `color` are added explicitly so this
// stays true if DOMPurify's defaults ever change; tests in
// scripts/test-rich-text-selection.mjs lock the round trip in.
export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || "", { ADD_ATTR: ["style", "color"] });
}
