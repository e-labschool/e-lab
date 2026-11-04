import { renderCompactLatex } from "../../../lib/scientificContent.jsx";
import { orbitalLatex } from "../model/orbitals.js";

const cache = new Map();
/** Render orbital / configuration notation through the app's scientific renderer: "2p_{x}" -> 2p<sub>x</sub>. Input is always our own constants. */
export function sciHtml(src) {
  let h = cache.get(src); if (h === undefined) { h = renderCompactLatex(src); cache.set(src, h); } return h;
}
export default function Sci({ src, className = "", title }) {
  return <span className={`hy-orb ${className}`.trim()} title={title} dangerouslySetInnerHTML={{ __html: sciHtml(src) }} />;
}

const ORB_RE = /\b(\d)(p[xyz]|d(?:xy|xz|yz|z2|x2-y2))(?![A-Za-z0-9])/g;
/** Prose with specific orbital names (2px, 2pz, 3dz2 ...) -> HTML with proper subscripts through the app's renderer. Text is escaped first. */
export function richHtml(text) {
  const esc = String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc.replace(ORB_RE, (_, n, k) => sciHtml(orbitalLatex(n, k)));
}
/** One short explanation under the viewer (same shell classes as the shared ExplainLine, but renders orbital subscripts and may use two lines). */
export function RichExplain({ text, testId }) {
  return (
    <div className="sd-explain hy-explain" data-testid="explain-line">
      <p className="sd-explain-text hy-explain-text" aria-live="polite" aria-atomic="true" data-testid={testId} dangerouslySetInnerHTML={{ __html: richHtml(text) }} />
    </div>
  );
}
