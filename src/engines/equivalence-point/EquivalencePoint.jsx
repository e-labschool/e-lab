import React, { useMemo, useState } from "react";
import "./EquivalencePoint.css";
import { COPYRIGHT_TEXT_COMPACT } from "../../data/copyright.js";

// ============================================================
// Reagent definitions — equivalent factors drive the stoichiometry
// automatically (see calculateNeutralization). HCl/NaOH (both factor 1)
// remain the default; H2SO4/Ca(OH)2 are an optional "explore
// stoichiometry" extension only.
// ============================================================
const ACIDS = {
  HCl: { label: "HCl", formula: "HCl", equivalentFactor: 1, type: "monoprotic", ratioNote: "1 mol HCl \u2192 1 mol H\u207A" },
  H2SO4: { label: "H\u2082SO\u2084", formula: "H2SO4", equivalentFactor: 2, type: "diprotic", ratioNote: "1 mol H\u2082SO\u2084 \u2192 up to 2 mol H\u207A equivalents" },
};

const BASES = {
  NaOH: { label: "NaOH", formula: "NaOH", equivalentFactor: 1, ratioNote: "1 mol NaOH \u2192 1 mol OH\u207B" },
  CaOH2: { label: "Ca(OH)\u2082", formula: "Ca(OH)2", equivalentFactor: 2, ratioNote: "1 mol Ca(OH)\u2082 \u2192 2 mol OH\u207B" },
};

const INITIAL_BASE_VOLUME_ML = 25.0;
const ACID_CONCENTRATION = 0.1;
const BASE_CONCENTRATION = 0.1;
const ACID_STEP_ML = 2.5;
const BASE_STEP_ML = 2.5;
const MAX_REAGENT_VOLUME_ML = 500; // a sensible ceiling only — never small enough to block crossing equivalence in either direction

const MAX_VISIBLE_SPHERES = 10;
const MAX_BEAM_ANGLE = 10;
const MAX_POINTER_ANGLE = 22;
const APPROACHING_THRESHOLD = 0.15;
const EPSILON = 1e-10;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * ONE central chemistry function — everything else (pH, status, beam,
 * pointer, spheres) is derived from its output. Uses acid/base
 * EQUIVALENTS, not a bare 1:1 mole assumption, so H2SO4 (2 H+ per mole)
 * and Ca(OH)2 (2 OH- per formula unit) fall out of the same formula
 * automatically rather than needing special-cased logic.
 */
function calculateNeutralization({ acidVolumeMl, acidConcentration, acidFactor, baseVolumeMl, baseConcentration, baseFactor }) {
  const acidVolumeL = acidVolumeMl / 1000;
  const baseVolumeL = baseVolumeMl / 1000;

  const acidMoles = acidConcentration * acidVolumeL;
  const baseMoles = baseConcentration * baseVolumeL;

  const acidEquivalents = acidMoles * acidFactor;
  const baseEquivalents = baseMoles * baseFactor;

  const difference = acidEquivalents - baseEquivalents;
  const totalVolumeL = acidVolumeL + baseVolumeL;

  return { acidMoles, baseMoles, acidEquivalents, baseEquivalents, difference, totalVolumeL };
}

/**
 * pH for the default strong-acid/strong-base system, valid at 25 degC.
 * In "explore stoichiometry" mode this same simple strong-acid/strong-base
 * formula is still used for H2SO4/Ca(OH)2 -- deliberately NOT a rigorous
 * polyprotic equilibrium model (that's flagged to the student separately,
 * see the explore-mode warning note in the component below).
 */
function calculatePH({ acidEquivalents, baseEquivalents, difference, totalVolumeL }) {
  if (Math.abs(difference) < EPSILON) {
    return { pH: 7, status: "equivalence" };
  }
  if (difference < 0) {
    const excessOH = baseEquivalents - acidEquivalents;
    const OH = excessOH / totalVolumeL;
    const pOH = -Math.log10(OH);
    return { pH: 14 - pOH, status: "base" };
  }
  const excessH = acidEquivalents - baseEquivalents;
  const H = excessH / totalVolumeL;
  return { pH: -Math.log10(H), status: "acid" };
}

function getApproaching({ acidEquivalents, baseEquivalents, difference, status }) {
  if (status === "equivalence") return false;
  const totalReference = Math.max(acidEquivalents, baseEquivalents, 1e-12);
  const relativeExcess = Math.abs(difference) / totalReference;
  return relativeExcess < APPROACHING_THRESHOLD;
}

/**
 * Spheres represent ONLY the excess species -- before equivalence only
 * excess OH- is ever shown, after equivalence only excess H+, and never
 * both populations at once (they've reacted: H+ + OH- -> H2O).
 */
function getSphereCount({ difference, status }, initialReferenceEquivalents) {
  if (status === "equivalence") return { oh: 0, h: 0 };
  const fraction = clamp(Math.abs(difference) / initialReferenceEquivalents, 0, 1);
  const count = Math.max(1, Math.round(fraction * MAX_VISIBLE_SPHERES));
  return status === "base" ? { oh: count, h: 0 } : { oh: 0, h: count };
}

function IonSphere({ type, index }) {
  const isOH = type === "OH";
  return (
    <div className={`ion-sphere ${isOH ? "oh-sphere" : "h-sphere"}`} style={{ "--delay": `${index * 40}ms` }}>
      {isOH ? "OH\u207B" : "H\u207A"}
    </div>
  );
}

function SphereGroup({ type, count }) {
  return (
    <div className="sphere-group">
      {Array.from({ length: count }).map((_, index) => (
        <IonSphere key={`${type}-${index}`} type={type} index={index} />
      ))}
    </div>
  );
}

export default function EquivalencePoint() {
  const [acidVolumeMl, setAcidVolumeMl] = useState(0);
  const [baseVolumeMl, setBaseVolumeMl] = useState(INITIAL_BASE_VOLUME_ML);
  const [acidDropKey, setAcidDropKey] = useState(0);
  const [baseDropKey, setBaseDropKey] = useState(0);
  const [exploreMode, setExploreMode] = useState(false);
  const [selectedAcid, setSelectedAcid] = useState("HCl");
  const [selectedBase, setSelectedBase] = useState("NaOH");

  const acidFactor = ACIDS[selectedAcid].equivalentFactor;
  const baseFactor = BASES[selectedBase].equivalentFactor;

  const neutralization = useMemo(
    () =>
      calculateNeutralization({
        acidVolumeMl,
        acidConcentration: ACID_CONCENTRATION,
        acidFactor,
        baseVolumeMl,
        baseConcentration: BASE_CONCENTRATION,
        baseFactor,
      }),
    [acidVolumeMl, baseVolumeMl, acidFactor, baseFactor]
  );

  const { pH, status } = calculatePH(neutralization);
  const approaching = getApproaching({ ...neutralization, status });

  // Fixed reference (the INITIAL base charge, at the currently-selected
  // base's equivalent factor) -- stable throughout a run regardless of
  // how much reagent gets added later, so the beam/pointer/sphere scale
  // doesn't drift as volumes grow.
  const initialReferenceEquivalents = (INITIAL_BASE_VOLUME_ML / 1000) * BASE_CONCENTRATION * baseFactor;

  // negative = base/OH- excess, zero = equivalence, positive = acid/H+ excess
  const balanceState = neutralization.difference / initialReferenceEquivalents;
  const normalizedBalance = clamp(balanceState, -1, 1);

  // Beam and pointer are BOTH driven by the exact same signed value, in
  // the SAME direction -- verified against the actual CSS rotation
  // mechanics (browser positive rotation is clockwise; the beam's right
  // side/H+ pan and the pointer's tip both swing toward +x for a
  // positive angle), so they can never visually contradict each other.
  const beamAngle = normalizedBalance * MAX_BEAM_ANGLE;
  const pointerAngle = normalizedBalance * MAX_POINTER_ANGLE;

  const sphereCount = getSphereCount({ ...neutralization, status }, initialReferenceEquivalents);

  const isEquivalent = status === "equivalence";
  const isExploring = selectedAcid !== "HCl" || selectedBase !== "NaOH";

  function addAcid() {
    setAcidDropKey((k) => k + 1);
    setAcidVolumeMl((v) => Math.min(v + ACID_STEP_ML, MAX_REAGENT_VOLUME_ML));
  }

  function addBase() {
    setBaseDropKey((k) => k + 1);
    setBaseVolumeMl((v) => Math.min(v + BASE_STEP_ML, MAX_REAGENT_VOLUME_ML));
  }

  function reset() {
    setAcidVolumeMl(0);
    setBaseVolumeMl(INITIAL_BASE_VOLUME_ML);
    setAcidDropKey((k) => k + 1);
    setBaseDropKey((k) => k + 1);
    // Explore mode's chosen reagents are intentionally NOT reset here --
    // Replay resets volumes/spheres/pH/beam/pointer/status/drops, but may
    // retain the currently-selected acid/base per the spec.
  }

  function handleAcidChange(e) {
    setSelectedAcid(e.target.value);
    setAcidVolumeMl(0);
    setBaseVolumeMl(INITIAL_BASE_VOLUME_ML);
  }

  function handleBaseChange(e) {
    setSelectedBase(e.target.value);
    setAcidVolumeMl(0);
    setBaseVolumeMl(INITIAL_BASE_VOLUME_ML);
  }

  let statusTitle;
  let statusClass;
  if (isEquivalent) {
    statusTitle = "EQUIVALENCE POINT";
    statusClass = "status-equivalence";
  } else if (approaching) {
    statusTitle = "Approaching equivalence...";
    statusClass = "status-approaching";
  } else if (status === "acid") {
    statusTitle = "H\u207A in excess";
    statusClass = "status-acidic";
  } else {
    statusTitle = "OH\u207B in excess";
    statusClass = "status-basic";
  }

  return (
    <section className="equivalence-simulation">
      <div className="equivalence-header">
        <div>
          <h2>Equivalence Point</h2>
          <p>Add HCl little by little and observe what happens as the solution approaches the equivalence point.</p>
        </div>

        <div className="ph-display">
          <span>pH</span>
          <strong>{Number.isFinite(pH) ? pH.toFixed(2) : "\u2014"}</strong>
        </div>
      </div>

      <div className="simulation-stage">
        <div className={`status-card ${statusClass}`}>
          <strong>{statusTitle}</strong>
          {status === "base" && !isEquivalent && <span>BASIC</span>}
          {status === "acid" && !isEquivalent && <span>ACIDIC</span>}
          {isEquivalent && <span>{"Neither H\u207A nor OH\u207B is in excess"}</span>}
        </div>

        {/* NaOH dropper -- left/OH- side */}
        <div className="naoh-unit">
          <div className="burette">
            <div className="burette-liquid" />
            <div className="burette-lines"><i /><i /><i /><i /><i /></div>
            <div className="burette-tip" />
          </div>
          <div key={baseDropKey} className={baseDropKey > 0 ? "acid-drop acid-drop-active" : "acid-drop"} />
          <span className="hcl-label">{BASES[selectedBase].label}</span>
        </div>

        {/* HCl dropper -- right/H+ side */}
        <div className="hcl-unit">
          <div className="burette">
            <div className="burette-liquid" />
            <div className="burette-lines"><i /><i /><i /><i /><i /></div>
            <div className="burette-tip" />
          </div>
          <div key={acidDropKey} className={acidDropKey > 0 ? "acid-drop acid-drop-active" : "acid-drop"} />
          <span className="hcl-label">{ACIDS[selectedAcid].label}</span>
        </div>

        <div className="balance-wrapper">
          <div className="balance-gauge">
            <div className="gauge-arc">
              <span className="tick tick-1" />
              <span className="tick tick-2" />
              <span className="tick tick-3" />
              <span className="tick tick-4" />
              <span className="tick tick-5" />
            </div>
            <div className="balance-pointer" style={{ transform: `translateX(-50%) rotate(${pointerAngle}deg)` }} />
          </div>

          <div className="balance-stand">
            <div className="stand-column" />
            <div className="stand-base" />
          </div>

          <div className="balance-beam" style={{ transform: `translate(-50%, -50%) rotate(${beamAngle}deg)` }}>
            <div className="beam-body" />

            <div className="pan-unit pan-unit-left">
              <div className="pan-support" />
              <div className="balance-pan">
                <SphereGroup type="OH" count={sphereCount.oh} />
              </div>
              <div className="pan-label oh-label">{"OH\u207B"}</div>
            </div>

            <div className="pan-unit pan-unit-right">
              <div className="pan-support" />
              <div className="balance-pan">
                <SphereGroup type="H" count={sphereCount.h} />
              </div>
              <div className="pan-label h-label">{"H\u207A"}</div>
            </div>

            <div className="beam-pivot-dot" />
          </div>
        </div>
      </div>

      <div className="reaction-row">
        <strong>{"H\u207A + OH\u207B \u2192 H\u2082O"}</strong>
      </div>

      <div className="volume-row">
        <span>{BASES[selectedBase].label}: <strong>{baseVolumeMl.toFixed(1)} {"cm\u00b3"}</strong></span>
        <span>{ACIDS[selectedAcid].label}: <strong>{acidVolumeMl.toFixed(1)} {"cm\u00b3"}</strong></span>
      </div>

      <label className="explore-toggle-row">
        <input type="checkbox" checked={exploreMode} onChange={(e) => setExploreMode(e.target.checked)} />
        Explore stoichiometry
      </label>

      {exploreMode && (
        <div className="explore-panel">
          <div className="explore-field">
            <label htmlFor="eq-acid-select">Acid</label>
            <select id="eq-acid-select" value={selectedAcid} onChange={handleAcidChange}>
              {Object.entries(ACIDS).map(([key, acid]) => (
                <option key={key} value={key}>{acid.label}</option>
              ))}
            </select>
          </div>
          <div className="explore-field">
            <label htmlFor="eq-base-select">Base</label>
            <select id="eq-base-select" value={selectedBase} onChange={handleBaseChange}>
              {Object.entries(BASES).map(([key, base]) => (
                <option key={key} value={key}>{base.label}</option>
              ))}
            </select>
          </div>
          <p className="explore-ratio-note">
            {ACIDS[selectedAcid].ratioNote} {"\u00b7"} {BASES[selectedBase].ratioNote}
          </p>
          {isExploring && (
            <p className="explore-warning-note">
              Explore mode focuses on stoichiometric acid/base equivalents. Detailed polyprotic equilibria are not represented.
            </p>
          )}
        </div>
      )}

      <div className="simulation-controls">
        <button type="button" className="secondary-control" onClick={addBase}>
          Add {BASES[selectedBase].label}
        </button>
        <button type="button" className="primary-control" onClick={addAcid}>
          Add {ACIDS[selectedAcid].label}
        </button>
        <button type="button" className="secondary-control" onClick={reset}>
          Replay
        </button>
      </div>

      <p className="equivalence-copyright">{COPYRIGHT_TEXT_COMPACT}</p>
    </section>
  );
}
