import { Construction } from "lucide-react";

/** Honest placeholder for a technique that has not been built yet. No invented content: it only says what the technique is for and what exists today. */
export default function DevelopmentPlaceholder({ technique, blurb, action }) {
  return (
    <div className="ss-dev" role="status" data-testid={`dev-${technique.id}`}>
      <Construction size={34} aria-hidden="true" />
      <h3>{technique.label}</h3>
      <p className="ss-dev-badge">In development</p>
      <p>{blurb}</p>
      <p className="ss-dev-note">No simulation, data or spectra are shown here yet. The ¹H NMR section (six steps), the IR spectroscopy section (nine stages) and the mass spectrometry section (six stages) of this lab are complete.</p>
      {action}
    </div>
  );
}
