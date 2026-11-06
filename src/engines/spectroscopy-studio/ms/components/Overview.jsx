import { MS_PARTS, PARTS_BY_STAGE } from "../data/instrument.js";

/** The compact instrument overview: ALWAYS visible, the parts the stage is about are highlighted, and the region of the tracked particle is marked. */
export default function Overview({ stage, analyser, trackPart = null, activityOpen = false }) {
  const active = new Set(PARTS_BY_STAGE[stage] ?? []);
  return (
    <div className="ms-ribbon ms-overview" data-testid="instrument-overview" data-active={[...active].join(" ")} data-analyser={analyser} role="group" aria-label="Simplified mass spectrometer, the active parts are highlighted">
      <ol>
        {MS_PARTS.map((p, i) => {
          const on = active.has(p.id) || (activityOpen && p.id === "spectrum");
          const name = p.id === "analyser" ? (analyser === "tof" ? "Flight tube" : "Magnetic sector") : p.label;
          return (
            <li key={p.id} className={`${on ? "is-active" : ""}${trackPart === p.id ? " is-tracked" : ""}`} aria-current={on ? "true" : undefined} data-part={p.id}>
              <span className="ms-ribbon-box" title={`${name}: ${p.sub}`}>
                <b><span className="ms-long">{p.id === "analyser" ? name : p.label}</span><span className="ms-short">{p.id === "analyser" ? (analyser === "tof" ? "TOF tube" : "Sector") : p.short}</span></b>
                {trackPart === p.id && <i className="ms-trackdot" aria-label="tracked particle is here">◉ tracked</i>}
              </span>
              {i < MS_PARTS.length - 1 && <span className="ms-ribbon-arrow" aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
