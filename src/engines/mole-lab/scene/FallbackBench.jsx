import { BAG } from "./bagSpec.js";
import { atomColour } from "../engine/particles.js";
import { getSubstance } from "../engine/substances.js";
import { fmtMol, fromQuanta } from "../engine/numeric.js";

/** 2D, no-WebGL stand-in for the bench: the SAME standard packet outline, fill = fraction of one mole, and the exact amount in text.
 *  Also an accessible text alternative to the 3D view (each packet is a labelled, selectable button). */
export default function FallbackBench({ rows, selectedId, onSelect, notice }) {
  return (
    <div className="ml-fallback" data-testid="ml-fallback" role="group" aria-label="Packets on the bench (2D view)">
      <p className="ml-fallback-note" role="status"><b>3D view unavailable on this device.</b> {notice ?? "The packets are shown in 2D; everything else works as usual."}</p>
      {rows.map((row, ri) => (
        <div className="ml-fallback-row" key={ri}>
          {row.map((e) => e.type === "stack" ? (
            <div key={e.key} className="ml-fb-stack" data-testid="ml-fb-stack"><b>× {e.count}</b><span>full packets</span><span>{e.count} mol of {getSubstance(e.substanceId).formulaDisplay}</span></div>
          ) : (
            <button key={e.key} type="button" className={"ml-fb-bag" + (selectedId === e.packet.id ? " is-selected" : "")} aria-pressed={selectedId === e.packet.id} onClick={() => onSelect?.(e.packet.id)}
              data-testid={`ml-fb-${e.packet.id}`} aria-label={`${getSubstance(e.packet.substanceId).name} packet, ${fmtMol(fromQuanta(e.packet.q))} mol, ${e.packet.open ? "open" : "closed"}`}>
              <svg viewBox="0 0 80 112" width="68" height="95" aria-hidden="true">
                <defs><clipPath id={`c-${e.packet.id}`}><rect x="8" y="14" width="64" height="92" rx="9" /></clipPath></defs>
                <rect x="8" y="14" width="64" height="92" rx="9" className="ml-fb-plastic" />
                <rect x="8" y={14 + 92 * (1 - Math.min(1, e.packet.q / 1e9))} width="64" height={92 * Math.min(1, e.packet.q / 1e9)} clipPath={`url(#c-${e.packet.id})`} fill={atomColour(Object.keys(getSubstance(e.packet.substanceId).composition)[0])} opacity="0.85" data-fill={Math.min(1, e.packet.q / 1e9)} />
                <rect x="8" y="14" width="64" height="92" rx="9" className="ml-fb-outline" />
                <rect x="8" y="26" width="64" height="3.5" fill="#c93a3f" /><rect x="8" y="30" width="64" height="3" fill="#2f6fd0" />
              </svg>
              <span className="ml-fb-q">{fmtMol(fromQuanta(e.packet.q))} mol</span><span className="ml-fb-f">{getSubstance(e.packet.substanceId).formulaDisplay}{e.packet.open ? " · open" : ""}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
export { BAG };
