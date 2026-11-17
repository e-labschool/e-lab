import VapourLampSchematic from "./VapourLampSchematic.jsx";
import RadiationBeam from "./RadiationBeam.jsx";
import SpectroscopeInstrument from "./SpectroscopeInstrument.jsx";

/** Horizontal, apparatus-style emission setup: lamp -> emitted
 * radiation (real wave trains) -> spectroscope. Replaces the earlier
 * vertical stack of a text box, a down-arrow, and a bordered label. */
export default function EmissionSetup({ elementName, species, lines, glowColor }) {
  return (
    <div className="as-apparatus flex flex-wrap items-center justify-center gap-2 py-1">
      <style>{`@media (min-width: 900px) and (min-height: 700px) { .as-apparatus { zoom: 1.3; } }`}</style>
      <VapourLampSchematic elementName={elementName} species={species} excited glowColor={glowColor} />
      <RadiationBeam lines={lines} />
      <SpectroscopeInstrument />
    </div>
  );
}
