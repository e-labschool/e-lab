import { useEffect, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import DropperBeaker from "./components/DropperBeaker.jsx";
import ConcentrationBars from "./components/ConcentrationBars.jsx";
import PHPanel from "./components/PHPanel.jsx";
import StatusStrip from "./components/StatusStrip.jsx";
import { INITIAL_H, nextHConcentration, ohFromH, pHFromH, lerpConcentration } from "./lib/math.js";
import { PALETTE } from "../particle-model-visualizer/data/palette.js";

/**
 * A compact, content-sized component — no 100vh/min-h-screen/full-page
 * canvas anywhere. Everything here grows only from its own content: the
 * outer card has a max-width and ordinary padding, the three columns are
 * a CSS grid with explicit fr-ratios, and the two concentration bars are
 * fixed-size indicators (not a graph — no axes, no plotted point).
 *
 * The add-drop sequence is a handful of setTimeout-scheduled state
 * changes plus a couple of small requestAnimationFrame tweens for the
 * bar heights/numbers, so [H+] visibly rises before "H+ + OH- -> H2O"
 * appears, which itself appears before [OH-] visibly falls — never all
 * at once, since that would look like OH- changes automatically rather
 * than in response to the reaction.
 */
export default function HOHBalance({ compact = false }) {
  const [hConc, setHConc] = useState(INITIAL_H); // settled value
  const [displayH, setDisplayH] = useState(INITIAL_H); // currently shown/animating value
  const [displayOH, setDisplayOH] = useState(ohFromH(INITIAL_H));
  const [dropFalling, setDropFalling] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
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

  function handleAddDrop() {
    if (animating) return;
    setAnimating(true);
    setStatusIndex(1);

    const fromH = hConc;
    const toH = nextHConcentration(hConc);
    const fromOH = ohFromH(fromH);
    const toOH = ohFromH(toH);

    setDropFalling(true);
    schedule(() => setDropFalling(false), 400);

    // 0.5s: H+ bar begins rising
    schedule(() => tweenConcentration(fromH, toH, 500, setDisplayH), 500);

    // 1.0s: show the reaction, briefly
    schedule(() => { setReacting(true); setStatusIndex(2); }, 1000);
    schedule(() => setReacting(false), 1600);

    // 1.2s: OH- bar begins decreasing; settle around 1.8s
    schedule(() => {
      tweenConcentration(fromOH, toOH, 600, setDisplayOH, () => {
        setHConc(toH);
        setStatusIndex(3);
        setAnimating(false);
      });
    }, 1200);
  }

  function handleReset() {
    clearAllTimers();
    setHConc(INITIAL_H);
    setDisplayH(INITIAL_H);
    setDisplayOH(ohFromH(INITIAL_H));
    setDropFalling(false);
    setReacting(false);
    setStatusIndex(0);
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
          <DropperBeaker dropFalling={dropFalling} onAddDrop={handleAddDrop} onReset={handleReset} disabled={animating} />
        </div>

        <div className="flex flex-col items-center justify-center gap-2">
          <ConcentrationBars hConc={displayH} ohConc={displayOH} />
          <p className="h-4 text-xs font-medium" style={{ color: PALETTE.textSecondary, opacity: reacting ? 1 : 0, transition: "opacity 150ms ease" }}>
            H⁺ + OH⁻ → H₂O
          </p>
        </div>

        <div className="flex items-center justify-center">
          <PHPanel pH={pH} />
        </div>
      </div>

      <StatusStrip statusIndex={statusIndex} />
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame title="H+ - OH- Balance in Water" subtitle="Add HCl and watch [H+], [OH-] and pH move together.">
      {body}
    </InteractiveFrame>
  );
}
