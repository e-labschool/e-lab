import { useMemo } from "react";
import ThreeCanvas from "../../components/ThreeCanvas.jsx";
import { detectWebGL } from "../../components/webgl.js";
import { usePhase } from "../../components/useAnim.js";
import { useReducedMotion, useStudio } from "../../state/StudioContext.jsx";
import MethaneScene from "../scene/MethaneScene.jsx";
import AtomGlyph, { GlyphDefs } from "./AtomGlyph.jsx";
import { GEOMETRIES } from "../scene/glyphs.js";

/** Stage 1: the slowly rotating methane model - WebGL when available, otherwise the same molecule as an animated SVG. */
export default function MethaneStage() {
  const paused = useStudio((s) => s.paused); const speed = useStudio((s) => s.speed); const reduced = useReducedMotion();
  const webgl = useMemo(() => detectWebGL(), []);
  return (
    <div className="ms-methane" data-testid="methane-stage" data-webgl={webgl ? "1" : "0"} data-rotating={!paused && !reduced ? "1" : "0"}>
      {webgl ? (
        <ThreeCanvas position={[3.0, -4.6, 2.2]} label="Rotating ball-and-stick model of methane, CH4: one carbon atom bonded to four hydrogen atoms" testId="methane-canvas">
          <MethaneScene rotate={!paused && !reduced} speed={speed} />
        </ThreeCanvas>
      ) : <MethaneSvg />}
    </div>
  );
}

function MethaneSvg() {
  const phase = usePhase({ scale: 1 });
  const g = GEOMETRIES.ch4;
  return (
    <svg className="ms-fill-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Rotating ball-and-stick model of methane" data-testid="methane-svg">
      <GlyphDefs id="m1" />
      <AtomGlyph id="m1" atoms={g.atoms} bonds={g.bonds} cx={200} cy={150} scale={86} spin={phase * 0.7} tilt={0.35} />
    </svg>
  );
}
