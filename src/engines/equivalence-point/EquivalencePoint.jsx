import React, { useMemo, useState } from "react";
import "./EquivalencePoint.css";

const INITIAL_NAOH_VOLUME_ML = 25;
const NAOH_CONCENTRATION = 0.1;

const HCL_CONCENTRATION = 0.1;
const HCL_STEP_ML = 2.5;

const MAX_VISIBLE_SPHERES = 10;

/**
 * Strong acid / strong base titration:
 * NaOH in flask
 * HCl added
 * 25 °C
 */
function calculateTitration(acidVolumeMl) {
  const baseVolumeL = INITIAL_NAOH_VOLUME_ML / 1000;
  const acidVolumeL = acidVolumeMl / 1000;

  const baseMoles = NAOH_CONCENTRATION * baseVolumeL;
  const acidMoles = HCL_CONCENTRATION * acidVolumeL;

  const totalVolumeL = baseVolumeL + acidVolumeL;

  const difference = acidMoles - baseMoles;

  // Relative progress:
  // 0 = no acid added
  // 1 = exact equivalence
  const equivalenceAcidVolumeMl =
    (baseMoles / HCL_CONCENTRATION) * 1000;

  const progress = acidVolumeMl / equivalenceAcidVolumeMl;

  let pH;
  let status;
  let excessType;

  const tolerance = 1e-10;

  if (Math.abs(difference) < tolerance) {
    pH = 7;
    status = "EQUIVALENCE";
    excessType = "none";
  } else if (difference < 0) {
    // OH- remains in excess
    const excessOHMoles = Math.abs(difference);
    const ohConcentration = excessOHMoles / totalVolumeL;

    const pOH = -Math.log10(ohConcentration);
    pH = 14 - pOH;

    status = progress >= 0.8 ? "APPROACHING" : "BASIC";
    excessType = "OH";
  } else {
    // H+ remains in excess
    const excessHMoles = difference;
    const hConcentration = excessHMoles / totalVolumeL;

    pH = -Math.log10(hConcentration);

    status = "ACIDIC";
    excessType = "H";
  }

  return {
    acidMoles,
    baseMoles,
    difference,
    totalVolumeL,
    equivalenceAcidVolumeMl,
    progress,
    pH,
    status,
    excessType,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * We use ONE balance variable.
 *
 * negative = OH- excess
 * zero = equivalence
 * positive = H+ excess
 */
function getBalanceState(data) {
  const { acidMoles, baseMoles } = data;

  const normalized =
    (acidMoles - baseMoles) / baseMoles;

  return clamp(normalized, -1, 1);
}

function getSphereCount(data) {
  const { difference, baseMoles, excessType } = data;

  if (excessType === "none") {
    return {
      oh: 0,
      h: 0,
    };
  }

  const fraction =
    Math.abs(difference) / baseMoles;

  const count = Math.max(
    1,
    Math.round(
      clamp(fraction, 0, 1) * MAX_VISIBLE_SPHERES
    )
  );

  if (excessType === "OH") {
    return {
      oh: count,
      h: 0,
    };
  }

  return {
    oh: 0,
    h: count,
  };
}

function IonSphere({ type, index }) {
  const isOH = type === "OH";

  return (
    <div
      className={`ion-sphere ${
        isOH ? "oh-sphere" : "h-sphere"
      }`}
      style={{
        "--delay": `${index * 40}ms`,
      }}
    >
      {isOH ? "OH⁻" : "H⁺"}
    </div>
  );
}

function SphereGroup({ type, count }) {
  return (
    <div className="sphere-group">
      {Array.from({ length: count }).map((_, index) => (
        <IonSphere
          key={`${type}-${index}`}
          type={type}
          index={index}
        />
      ))}
    </div>
  );
}

export default function EquivalencePoint() {
  const [acidVolumeMl, setAcidVolumeMl] = useState(0);
  const [dropKey, setDropKey] = useState(0);

  const data = useMemo(
    () => calculateTitration(acidVolumeMl),
    [acidVolumeMl]
  );

  const balance = getBalanceState(data);

  const sphereCount = getSphereCount(data);

  /**
   * IMPORTANT:
   *
   * OH- excess:
   * balance negative
   * beam left side DOWN
   *
   * H+ excess:
   * balance positive
   * beam right side DOWN
   */
  const MAX_BEAM_ANGLE = 10;

  const beamAngle =
    balance * MAX_BEAM_ANGLE;

  /**
   * Pointer moves opposite direction to beam.
   *
   * This is what was wrong in the previous version.
   */
  const MAX_POINTER_ANGLE = 22;

  const pointerAngle =
    -balance * MAX_POINTER_ANGLE;

  const isEquivalent =
    data.excessType === "none";

  const maxAcidVolume =
    data.equivalenceAcidVolumeMl * 1.6;

  function addHCl() {
    setDropKey((previous) => previous + 1);

    setAcidVolumeMl((previous) =>
      Math.min(
        previous + HCL_STEP_ML,
        maxAcidVolume
      )
    );
  }

  function reset() {
    setAcidVolumeMl(0);
    setDropKey((previous) => previous + 1);
  }

  let statusTitle;
  let statusClass;

  if (data.status === "EQUIVALENCE") {
    statusTitle = "EQUIVALENCE POINT";
    statusClass = "status-equivalence";
  } else if (data.status === "APPROACHING") {
    statusTitle = "Approaching equivalence...";
    statusClass = "status-approaching";
  } else if (data.status === "ACIDIC") {
    statusTitle = "H⁺ in excess";
    statusClass = "status-acidic";
  } else {
    statusTitle = "OH⁻ in excess";
    statusClass = "status-basic";
  }

  return (
    <section className="equivalence-simulation">
      <div className="equivalence-header">
        <div>
          <h2>Equivalence Point</h2>

          <p>
            Add HCl little by little and observe what
            happens as the solution approaches the
            equivalence point.
          </p>
        </div>

        <div className="ph-display">
          <span>pH</span>

          <strong>
            {Number.isFinite(data.pH)
              ? data.pH.toFixed(2)
              : "—"}
          </strong>
        </div>
      </div>

      <div className="simulation-stage">
        <div className={`status-card ${statusClass}`}>
          <strong>{statusTitle}</strong>

          {data.status === "BASIC" && (
            <span>BASIC</span>
          )}

          {data.status === "ACIDIC" && (
            <span>ACIDIC</span>
          )}

          {isEquivalent && (
            <span>
              Neither H⁺ nor OH⁻ is in excess
            </span>
          )}
        </div>

        {/* HCl dropper */}
        <div className="hcl-unit">
          <div className="burette">
            <div className="burette-liquid" />

            <div className="burette-lines">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>

            <div className="burette-tip" />
          </div>

          <div
            key={dropKey}
            className={
              dropKey > 0
                ? "acid-drop acid-drop-active"
                : "acid-drop"
            }
          />

          <span className="hcl-label">HCl</span>
        </div>

        <div className="balance-wrapper">
          {/* Gauge */}
          <div className="balance-gauge">
            <div className="gauge-arc">
              <span className="tick tick-1" />
              <span className="tick tick-2" />
              <span className="tick tick-3" />
              <span className="tick tick-4" />
              <span className="tick tick-5" />
            </div>

            <div
              className="balance-pointer"
              style={{
                transform: `translateX(-50%) rotate(${pointerAngle}deg)`,
              }}
            />
          </div>

          {/* Central stand */}
          <div className="balance-stand">
            <div className="stand-column" />
            <div className="stand-base" />
          </div>

          {/* Entire beam rotates as ONE object */}
          <div
            className="balance-beam"
            style={{
              transform: `translate(-50%, -50%) rotate(${beamAngle}deg)`,
            }}
          >
            <div className="beam-body" />

            {/* LEFT rigid support + pan */}
            <div className="pan-unit pan-unit-left">
              <div className="pan-support" />

              <div className="balance-pan">
                <SphereGroup
                  type="OH"
                  count={sphereCount.oh}
                />
              </div>

              <div className="pan-label oh-label">
                OH⁻
              </div>
            </div>

            {/* RIGHT rigid support + pan */}
            <div className="pan-unit pan-unit-right">
              <div className="pan-support" />

              <div className="balance-pan">
                <SphereGroup
                  type="H"
                  count={sphereCount.h}
                />
              </div>

              <div className="pan-label h-label">
                H⁺
              </div>
            </div>

            <div className="beam-pivot-dot" />
          </div>
        </div>
      </div>

      <div className="reaction-row">
        <strong>
          H⁺ + OH⁻ → H₂O
        </strong>
      </div>

      <div className="volume-row">
        HCl added:{" "}
        <strong>
          {acidVolumeMl.toFixed(1)} cm³
        </strong>
      </div>

      <div className="simulation-controls">
        <button
          type="button"
          className="primary-control"
          onClick={addHCl}
          disabled={acidVolumeMl >= maxAcidVolume}
        >
          Add HCl
        </button>

        <button
          type="button"
          className="secondary-control"
          onClick={reset}
        >
          Replay
        </button>
      </div>
    </section>
  );
}
