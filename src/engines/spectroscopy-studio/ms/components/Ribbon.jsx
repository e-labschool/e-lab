import { MS_PARTS } from "../data/instrument.js";

/** The labelled spectrometer as a compact chain; the part that the stage is about is emphasised. Illustrative, not a drawing of a real instrument. */
export default function Ribbon({ active, analyser = "sector" }) {
  return (
    <div className="ms-ribbon" data-testid="instrument-ribbon" data-active={active} role="group" aria-label="Simplified mass spectrometer, the active part is highlighted">
      <ol>
        {MS_PARTS.map((p, i) => (
          <li key={p.id} className={p.id === active ? "is-active" : ""} aria-current={p.id === active ? "true" : undefined} data-part={p.id}>
            <span className="ms-ribbon-box"><b>{p.id === "analyser" ? (analyser === "tof" ? "Flight tube" : analyser === "sector" ? "Magnetic sector" : p.label) : p.label}</b><i>{p.sub}</i></span>
            {i < MS_PARTS.length - 1 && <span className="ms-ribbon-arrow" aria-hidden="true">›</span>}
          </li>
        ))}
      </ol>
      <p className="ms-ribbon-note">Illustrative instrument model · electron ionisation (EI) · high vacuum</p>
    </div>
  );
}
