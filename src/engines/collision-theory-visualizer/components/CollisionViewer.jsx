import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import { eventGeometry, positionAt, VIEW, OUTCOME_TEXT } from "../lib/geometry.js";
import { SPECIES, SITE_COLOR, OUTCOME_COLOR } from "../theme.js";

const DURATION_MS = 2600;

function Mol({ cx, cy, species, phi, half, showSite, tile }) {
  const sp = SPECIES[species];
  const a0 = phi - half; const a1 = phi + half; const r = VIEW.r * 0.72;
  const full = half >= Math.PI - 1e-6;
  const arc = !showSite || full ? null : (
    <path d={`M${(cx + r * Math.cos(a0)).toFixed(1)},${(cy + r * Math.sin(a0)).toFixed(1)}A${r},${r} 0 ${half * 2 > Math.PI ? 1 : 0} 1 ${(cx + r * Math.cos(a1)).toFixed(1)},${(cy + r * Math.sin(a1)).toFixed(1)}`} fill="none" stroke={SITE_COLOR} strokeWidth="4" strokeLinecap="round" />
  );
  return (
    <g>
      <circle cx={cx} cy={cy} r={VIEW.r} fill={sp.color} stroke={tile ? "#14226b" : "none"} strokeWidth="2" />
      {arc}
      <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" style={{ paintOrder: "stroke" }}>{sp.id}</text>
    </g>
  );
}

/**
 * Magnified view of ONE real collision recorded by the engine (see geometry.js): both molecules approach along their real
 * relative velocity, touch with their real orientations, and either react or bounce. It never leaves the viewBox and always
 * ends on a held final frame that shows both molecules, their paths and the outcome.
 */
export function CollisionViewer({ event, siteDeg, reduced, replayToken, counts, pinned, onPin, followText }) {
  const geo = useMemo(() => (event ? eventGeometry(event) : null), [event]);
  const [s, setS] = useState(1);
  const raf = useRef(0);
  const key = event ? `${event.seq}-${replayToken}` : "none";
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (!event || reduced) { setS(1); return undefined; }
    const t0 = performance.now(); setS(0);
    const tick = (now) => { const f = Math.min(1, (now - t0) / DURATION_MS); setS(f); if (f < 1) raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [key, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const half = (Math.min(360, siteDeg) * Math.PI) / 360;
  const pos = geo ? positionAt(geo, s) : null;
  const reacted = event?.outcome === 0;
  const after = s >= 0.5;
  const spA = reacted && after ? 2 : 0; const spB = reacted && after ? 3 : 1;
  const out = event ? OUTCOME_TEXT[event.outcome] : null;
  const barMax = event ? Math.max(event.E, event.ea) * 1.3 || 1 : 1;
  return (
    <div className="ct-viewer" data-testid="viewer">
      <div className="ct-viewer-fig">
        <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} role="img" data-testid="viewer-svg" data-final={s >= 1 ? "1" : "0"}
          aria-label={event ? `Magnified collision. ${out.title}. Collision energy ${event.E.toFixed(1)} kilojoules per mole, activation energy ${event.ea.toFixed(1)}.` : "Magnified collision view. Waiting for a collision."}>
          <rect x="0.5" y="0.5" width={VIEW.w - 1} height={VIEW.h - 1} rx="8" fill="#f7faff" stroke="#c9d6ee" />
          {geo && (
            <>
              <g stroke="#7b88a8" strokeWidth="1.5" strokeDasharray="4 3" fill="none">
                <path d={`M${geo.start.ax},${geo.start.ay}L${geo.contact.ax},${geo.contact.ay}`} />
                <path d={`M${geo.start.bx},${geo.start.by}L${geo.contact.bx},${geo.contact.by}`} />
                <path d={`M${geo.contact.ax},${geo.contact.ay}L${geo.end.ax},${geo.end.ay}`} stroke={OUTCOME_COLOR[event.outcome]} />
                <path d={`M${geo.contact.bx},${geo.contact.by}L${geo.end.bx},${geo.end.by}`} stroke={OUTCOME_COLOR[event.outcome]} />
              </g>
              {s > 0.43 && s < 0.7 && <circle cx={(geo.contact.ax + geo.contact.bx) / 2} cy={(geo.contact.ay + geo.contact.by) / 2} r={6 + (s - 0.43) * 40} fill="none" stroke={OUTCOME_COLOR[event.outcome]} strokeWidth="2.5" opacity={Math.max(0, 1 - (s - 0.43) * 3.5)} />}
              <Mol cx={pos.ax} cy={pos.ay} species={spA} phi={event.phiA} half={half} showSite={siteDeg < 360 && spA < 2} tile={geo.tile} />
              <Mol cx={pos.bx} cy={pos.by} species={spB} phi={event.phiB} half={half} showSite={siteDeg < 360 && spB < 2} />
            </>
          )}
          {!event && <text x={VIEW.w / 2} y={VIEW.h / 2} textAnchor="middle" fontSize="12" fill="#4a5a82">Waiting for an A + B collision</text>}
        </svg>
      </div>
      <div className="ct-viewer-info">
        {event ? (
          <>
            <p className="ct-out" style={{ color: OUTCOME_COLOR[event.outcome] }} data-testid="viewer-outcome">
              {reacted ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              <span>{out.title}</span>
            </p>
            <div className="ct-ebar" role="img" aria-label={`Collision energy ${event.E.toFixed(1)}, activation energy ${event.ea.toFixed(1)} kilojoules per mole`} data-testid="viewer-ebar">
              <span className="ct-ebar-fill" style={{ width: `${Math.min(100, (event.E / barMax) * 100)}%`, background: event.E >= event.ea ? "#15803d" : "#b45309" }} />
              <span className="ct-ebar-ea" style={{ left: `${(event.ea / barMax) * 100}%` }} />
            </div>
            <p className="ct-ev-line" data-testid="viewer-energy">E = <b>{event.E.toFixed(1)}</b> {event.E >= event.ea ? "≥" : "<"} Ea = <b>{event.ea.toFixed(1)}</b> kJ mol{"⁻¹"}</p>
            <p className="ct-ev-line" data-testid="viewer-orient">Sites facing: {event.kind === 1 ? "surface" : "A"} {event.oriA ? <Check size={12} aria-label="yes" role="img" /> : <X size={12} aria-label="no" role="img" />} B {event.oriB ? <Check size={12} aria-label="yes" role="img" /> : <X size={12} aria-label="no" role="img" />}</p>
          </>
        ) : <p className="ct-ev-line">{followText}</p>}
        <div className="ct-chips" role="group" aria-label="Watch a type of collision">
          {OUTCOME_TEXT.map((o, i) => (
            <button key={o.key} type="button" className="ct-chip" aria-pressed={pinned === i} onClick={() => onPin(pinned === i ? null : i)} title={`${o.title}. Show the latest one.`} data-testid={`chip-${o.key}`}>
              <i style={{ background: OUTCOME_COLOR[i] }} aria-hidden="true" />{["Reaction", "Low energy", "Orientation", "Both"][i]} <b>{counts[i]}</b>
            </button>
          ))}
        </div>
        <p className="ct-ev-foot">{pinned == null ? followText : "Showing the latest of the chosen type."}{" "}
          {event && (<button type="button" className="ct-link" onClick={() => onPin(pinned, true)} data-testid="viewer-replay"><RotateCcw size={11} aria-hidden="true" /> Replay</button>)}
        </p>
      </div>
    </div>
  );
}
