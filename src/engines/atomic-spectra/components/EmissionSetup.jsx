import VapourLampSchematic from "./VapourLampSchematic.jsx";
import RadiationBeam from "./RadiationBeam.jsx";
import SpectroscopeInstrument from "./SpectroscopeInstrument.jsx";

/** Horizontal, apparatus-style emission setup: lamp -> emitted
 * radiation (real wave trains) -> spectroscope. Replaces the earlier
 * vertical stack of a text box, a down-arrow, and a bordered label. */
export default function EmissionSetup({ elementName, species, lines }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-1">
      <VapourLampSchematic elementName={elementName} species={species} excited />
      <RadiationBeam lines={lines} />
      <SpectroscopeInstrument />
    </div>
  );
}
