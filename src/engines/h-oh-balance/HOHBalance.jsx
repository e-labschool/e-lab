import { useEffect, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import DropperBeaker from "./components/DropperBeaker.jsx";
import ConcentrationBars from "./components/ConcentrationBars.jsx";
import PHPanel from "./components/PHPanel.jsx";
import StatusStrip from "./components/StatusStrip.jsx";
import { INITIAL_H, nextHConcentration, nextHFromNaOHDrop, ohFromH, pHFromH, lerpConcentration } from "./lib/math.js";
import { PALETTE } from "../particle-model-visualizer/data/palette.js";

const NEUTRAL_STATUS = "Pure water: [H⁺] = [OH⁻] → Neutral";
const REACTION_CAPTION = "H⁺ + OH⁻ → H₂O";
const REAGENT_TEXT = {
  hcl: { addCaption: "HCl adds H⁺", status: ["HCl added → [H⁺] ↑", "H⁺ reacts with OH⁻ → [OH⁻] ↓", "More H⁺ → lower pH"] },
  naoh: { addCaption: "NaOH adds OH⁻", status: ["NaOH added → [OH⁻] ↑", "OH⁻ reacts with H⁺ → [H⁺] ↓", "Less H⁺ → higher pH"] },
};

/**
 * A compact, content-sized component — no 100vh/min-h-screen/full-page
 * canvas anywhere. Both reagent paths run through the same timeline
 * shape (see handleAddReagent): whichever species the reagent directly
 * adds rises first, then the reaction caption appears, then the OTHER
 * species falls — so the animation always shows the added ion consuming
 * its counterpart, never the counterpart just changing on its own. The
 * only thing that differs between "hcl" and "naoh" is which bar/caption
 * plays which role.
 */
export default function HOHBalance({ compact = false }) {
  const [hConc, setHConc] = useState(INITIAL_H); // settled value — single source of truth
  const [displayH, setDisplayH] = useState(INITIAL_H);
  const [displayOH, setDisplayOH] = useState(ohFromH(INITIAL_H));
  const [fallingReagent, setFallingReagent] = useState(null); // "hcl" | "naoh" | null
  const [caption, setCaption] = useState("");
  const [statusText, setStatusText] = useState(NEUTRAL_STATUS);
  const [animating, setAnimating] = useState(false);

  const timeoutsRef = useRef([]);
  const rafRef = useRef(null);

  function clearAllTimers() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  useEffect(() => clearAllTimers, []);

  function schedule(fn, ms) {
    timeoutsRef.current.push(setTimeout(fn, ms));
  }

  function tweenConcentration(from, to, durationMs, setter, onDone) {
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / durationMs);
      setter(lerpConcentration(from, to, t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else onDone?.();
    }
    rafRef.current = requestAnimationFrame(step);
  }

  function handleAddReagent(reagent) {
    if (animating) return;
    setAnimating(true);
    const text = REAGENT_TEXT[reagent];
    setStatusText(text.status[0]);
    setCaption(text.addCaption);
    setFallingReagent(reagent);

    const fromH = hConc;
    const toH = reagent === "hcl" ? nextHConcentration(hConc) : nextHFromNaOHDrop(hConc);
    const fromOH = ohFromH(fromH);
    const toOH = ohFromH(toH);

    schedule(() => setFallingReagent(null), 400);

    // Whichever species this reagent adds directly rises first.
    const primary = reagent === "hcl"
      ? { setter: setDisplayH, from: fromH, to: toH }
      : { setter: setDisplayOH, from: fromOH, to: toOH };
    schedule(() => tweenConcentration(primary.from, primary.to, 500, primary.setter), 500);

    schedule(() => { setCaption(REACTION_CAPTION); setStatusText(text.status[1]); }, 1000);
    schedule(() => setCaption(""), 1600);

    // The other species falls in response — never simultaneously.
    const secondary = reagent === "hcl"
      ? { setter: setDisplayOH, from: fromOH, to: toOH }
      : { setter: setDisplayH, from: fromH, to: toH };
    schedule(() => {
      tweenConcentration(secondary.from, secondary.to, 600, secondary.setter, () => {
        setHConc(toH);
        setStatusText(text.status[2]);
        setAnimating(false);
      });
    }, 1200);
  }

  function handleReset() {
    clearAllTimers();
    setHConc(INITIAL_H);
    setDisplayH(INITIAL_H);
    setDisplayOH(ohFromH(INITIAL_H));
    setFallingReagent(null);
    setCaption("");
    setStatusText(NEUTRAL_STATUS);
    setAnimating(false);
  }

  const pH = pHFromH(displayH);

  const body = (
    <div
      className="mx-auto flex w-full flex-col gap-4 rounded-xl border p-5 sm:p-6"
      style={{ maxWidth: 1000, borderColor: PALETTE.border, background: PALETTE.bg }}
    >
      <p className="text-center text-sm font-semibold" style={{ color: PALETTE.textPrimary }}>
        H⁺&ndash;OH⁻ Balance in Water at 25&deg;C
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(220px,0.9fr)_minmax(300px,1.3fr)_minmax(200px,0.8fr)] md:gap-5">
        <div className="flex items-center justify-center">
          <DropperBeaker
            fallingReagent={fallingReagent}
            onAddHCl={() => handleAddReagent("hcl")}
            onAddNaOH={() => handleAddReagent("naoh")}
            onReset={handleReset}
            disabled={animating}
          />
        </div>

        <div className="flex flex-col items-center justify-center gap-2">
          <ConcentrationBars hConc={displayH} ohConc={displayOH} />
          <p className="h-4 text-xs font-medium" style={{ color: PALETTE.textSecondary, opacity: caption ? 1 : 0, transition: "opacity 150ms ease" }}>
            {caption || "\u00A0"}
          </p>
        </div>

        <div className="flex items-center justify-center">
          <PHPanel pH={pH} />
        </div>
      </div>

      <StatusStrip statusText={statusText} />
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame title="H+ - OH- Balance in Water" subtitle="Add HCl or NaOH and watch [H+], [OH-] and pH move together.">
      {body}
    </InteractiveFrame>
  );
}
