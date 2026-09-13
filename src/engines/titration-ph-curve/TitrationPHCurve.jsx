import React, { useEffect, useMemo, useRef, useState } from "react";
import "./TitrationPHCurve.css";

const KW = 1.0e-14;

const DEFAULT_FLASK_VOLUME_ML = 25.0;
const DEFAULT_CONCENTRATION = 0.100;

const REAGENTS = {
  HCl: {
    id: "HCl",
    label: "HCl",
    displayName: "Hydrochloric acid",
    type: "acid",
    strength: "strong",
    colorClass: "acid",
  },

  CH3COOH: {
    id: "CH3COOH",
    label: "CH₃COOH",
    displayName: "Ethanoic acid",
    type: "acid",
    strength: "weak",
    Ka: 1.8e-5,
    colorClass: "acid",
  },

  NaOH: {
    id: "NaOH",
    label: "NaOH",
    displayName: "Sodium hydroxide",
    type: "base",
    strength: "strong",
    colorClass: "base",
  },

  NH3: {
    id: "NH3",
    label: "NH₃",
    displayName: "Ammonia",
    type: "base",
    strength: "weak",
    Kb: 1.8e-5,
    colorClass: "base",
  },
};

const ACIDS = ["HCl", "CH3COOH"];
const BASES = ["NaOH", "NH3"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generic monoprotic acid/base equilibrium solver.
 *
 * Handles:
 * HCl + NaOH
 * CH3COOH + NaOH
 * HCl + NH3
 * CH3COOH + NH3
 *
 * at 25 °C.
 *
 * We solve charge balance numerically:
 *
 * [H+] + fixed positive ions + [BH+]
 * =
 * [OH-] + fixed negative ions + [A-]
 */
function solvePH({
  acid,
  acidMoles,
  base,
  baseMoles,
  totalVolumeL,
}) {
  if (totalVolumeL <= 0) return 7;

  const acidFormal = acidMoles / totalVolumeL;
  const baseFormal = baseMoles / totalVolumeL;

  const acidIsStrong = acid.strength === "strong";
  const baseIsStrong = base.strength === "strong";

  const KaAcid =
    acid.strength === "weak"
      ? acid.Ka
      : null;

  const KaConjugateBase =
    base.strength === "weak"
      ? KW / base.Kb
      : null;

  function chargeBalance(H) {
    const OH = KW / H;

    // Strong acid contributes its spectator anion, e.g. Cl-
    const strongAcidAnion =
      acidIsStrong ? acidFormal : 0;

    // Weak acid:
    // HA ⇌ H+ + A-
    const weakAcidAnion =
      !acidIsStrong
        ? acidFormal *
          (KaAcid / (KaAcid + H))
        : 0;

    // Strong base contributes spectator cation, e.g. Na+
    const strongBaseCation =
      baseIsStrong ? baseFormal : 0;

    // Weak base is handled through its conjugate acid:
    // BH+ ⇌ H+ + B
    //
    // fraction protonated =
    // H / (H + Ka(BH+))
    const weakBaseConjugateAcid =
      !baseIsStrong
        ? baseFormal *
          (H / (H + KaConjugateBase))
        : 0;

    const positive =
      H +
      strongBaseCation +
      weakBaseConjugateAcid;

    const negative =
      OH +
      strongAcidAnion +
      weakAcidAnion;

    return positive - negative;
  }

  /**
   * Solve in log concentration space.
   * H from 10 M to 1e-16 M gives pH -1 to 16.
   */
  let lowLogH = -16;
  let highLogH = 1;

  let lowH = Math.pow(10, lowLogH);
  let highH = Math.pow(10, highLogH);

  let fLow = chargeBalance(lowH);
  let fHigh = chargeBalance(highH);

  // Normally this bracket contains the root.
  // Defensive fallback if numerical extremes occur.
  if (fLow * fHigh > 0) {
    return 7;
  }

  for (let i = 0; i < 120; i++) {
    const midLogH =
      (lowLogH + highLogH) / 2;

    const midH =
      Math.pow(10, midLogH);

    const fMid =
      chargeBalance(midH);

    if (Math.abs(fMid) < 1e-14) {
      return -Math.log10(midH);
    }

    if (fLow * fMid <= 0) {
      highLogH = midLogH;
      fHigh = fMid;
    } else {
      lowLogH = midLogH;
      fLow = fMid;
    }
  }

  const finalLogH =
    (lowLogH + highLogH) / 2;

  return -Math.log10(
    Math.pow(10, finalLogH)
  );
}

function getChemistryState({
  flaskReagent,
  buretteReagent,
  flaskVolumeMl,
  titrantVolumeMl,
  flaskConcentration,
  buretteConcentration,
}) {
  const flaskVolumeL =
    flaskVolumeMl / 1000;

  const titrantVolumeL =
    titrantVolumeMl / 1000;

  const totalVolumeL =
    flaskVolumeL + titrantVolumeL;

  const flaskMoles =
    flaskConcentration *
    flaskVolumeL;

  const titrantMoles =
    buretteConcentration *
    titrantVolumeL;

  const flask =
    REAGENTS[flaskReagent];

  const burette =
    REAGENTS[buretteReagent];

  let acid;
  let acidMoles;
  let base;
  let baseMoles;

  if (flask.type === "acid") {
    acid = flask;
    acidMoles = flaskMoles;

    base = burette;
    baseMoles = titrantMoles;
  } else {
    base = flask;
    baseMoles = flaskMoles;

    acid = burette;
    acidMoles = titrantMoles;
  }

  const pH = solvePH({
    acid,
    acidMoles,
    base,
    baseMoles,
    totalVolumeL,
  });

  const stoichDifference =
    acidMoles - baseMoles;

  const tolerance = 1e-9;

  let excess = "equivalence";

  if (stoichDifference > tolerance) {
    excess = "acid";
  } else if (
    stoichDifference < -tolerance
  ) {
    excess = "base";
  }

  const equivalenceTitrantVolumeMl =
    flaskMoles /
    buretteConcentration *
    1000;

  const distanceFromEq =
    Math.abs(
      titrantVolumeMl -
        equivalenceTitrantVolumeMl
    );

  let stage;

  if (
    Math.abs(
      titrantVolumeMl -
        equivalenceTitrantVolumeMl
    ) < 0.001
  ) {
    stage = "equivalence";
  } else if (
    distanceFromEq <= 1.0
  ) {
    stage = "approaching";
  } else {
    stage = excess;
  }

  return {
    pH,
    excess,
    stage,
    equivalenceTitrantVolumeMl,
    totalVolumeL,
  };
}

function formatPH(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(2);
}

export default function TitrationPHCurve() {
  const [flaskReagent, setFlaskReagent] =
    useState("NaOH");

  const [buretteReagent, setBuretteReagent] =
    useState("HCl");

  const [
    flaskConcentration,
    setFlaskConcentration,
  ] = useState(DEFAULT_CONCENTRATION);

  const [
    buretteConcentration,
    setBuretteConcentration,
  ] = useState(DEFAULT_CONCENTRATION);

  const [flaskVolumeMl] =
    useState(DEFAULT_FLASK_VOLUME_ML);

  const [
    titrantVolumeMl,
    setTitrantVolumeMl,
  ] = useState(0);

  const [points, setPoints] = useState([]);

  const [autoRunning, setAutoRunning] =
    useState(false);

  const [showFeatures, setShowFeatures] =
    useState(false);

  const [dropKey, setDropKey] = useState(0);

  const [swirlKey, setSwirlKey] =
    useState(0);

  const autoTimer =
    useRef(null);

  const chemistry = useMemo(
    () =>
      getChemistryState({
        flaskReagent,
        buretteReagent,
        flaskVolumeMl,
        titrantVolumeMl,
        flaskConcentration,
        buretteConcentration,
      }),
    [
      flaskReagent,
      buretteReagent,
      flaskVolumeMl,
      titrantVolumeMl,
      flaskConcentration,
      buretteConcentration,
    ]
  );

  function resetExperiment() {
    setAutoRunning(false);

    if (autoTimer.current) {
      clearInterval(autoTimer.current);
      autoTimer.current = null;
    }

    setTitrantVolumeMl(0);

    const initial =
      getChemistryState({
        flaskReagent,
        buretteReagent,
        flaskVolumeMl,
        titrantVolumeMl: 0,
        flaskConcentration,
        buretteConcentration,
      });

    setPoints([
      {
        volume: 0,
        pH: initial.pH,
      },
    ]);

    setDropKey((x) => x + 1);
    setSwirlKey((x) => x + 1);
  }

  // Resets the whole experiment whenever the SELECTED reagents or
  // concentrations change -- including on first mount. This replaces the
  // earlier setTimeout(() => resetExperiment(), 0) pattern: that relied
  // on a macrotask delay to "wait" for state to settle, which is
  // fragile and doesn't actually guarantee ordering. An effect keyed on
  // exactly the values resetExperiment depends on runs AFTER React has
  // committed those values, so it always sees the fully-propagated
  // selection -- no arbitrary timer needed.
  useEffect(() => {
    resetExperiment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaskReagent, buretteReagent, flaskConcentration, buretteConcentration]);

  useEffect(() => {
    return () => {
      if (autoTimer.current) {
        clearInterval(autoTimer.current);
      }
    };
  }, []);

  function addTitrant(amountMl) {
    const maxVolume = 60;

    setTitrantVolumeMl((previous) => {
      const next =
        Math.min(
          maxVolume,
          Number(
            (
              previous +
              amountMl
            ).toFixed(3)
          )
        );

      const nextState =
        getChemistryState({
          flaskReagent,
          buretteReagent,
          flaskVolumeMl,
          titrantVolumeMl: next,
          flaskConcentration,
          buretteConcentration,
        });

      setPoints((current) => [
        ...current,
        {
          volume: next,
          pH: nextState.pH,
        },
      ]);

      return next;
    });

    setDropKey((x) => x + 1);
    setSwirlKey((x) => x + 1);
  }

  function toggleAuto() {
    if (autoRunning) {
      setAutoRunning(false);

      if (autoTimer.current) {
        clearInterval(
          autoTimer.current
        );

        autoTimer.current = null;
      }

      return;
    }

    setAutoRunning(true);

    autoTimer.current =
      setInterval(() => {
        setTitrantVolumeMl(
          (previous) => {
            if (previous >= 60) {
              clearInterval(
                autoTimer.current
              );

              autoTimer.current =
                null;

              setAutoRunning(false);

              return previous;
            }

            const currentState =
              getChemistryState({
                flaskReagent,
                buretteReagent,
                flaskVolumeMl,
                titrantVolumeMl:
                  previous,
                flaskConcentration,
                buretteConcentration,
              });

            const distance =
              Math.abs(
                previous -
                  currentState
                    .equivalenceTitrantVolumeMl
              );

            const step =
              distance < 2
                ? 0.25
                : 1;

            const next =
              Math.min(
                60,
                Number(
                  (
                    previous +
                    step
                  ).toFixed(3)
                )
              );

            const nextState =
              getChemistryState({
                flaskReagent,
                buretteReagent,
                flaskVolumeMl,
                titrantVolumeMl:
                  next,
                flaskConcentration,
                buretteConcentration,
              });

            setPoints((current) => [
              ...current,
              {
                volume: next,
                pH: nextState.pH,
              },
            ]);

            setDropKey((x) => x + 1);
            setSwirlKey((x) => x + 1);

            return next;
          }
        );
      }, 550);
  }

  // Pure state-setters only -- the useEffect above handles resetting
  // once React has actually committed the new selection, so these
  // handlers no longer need to orchestrate timing themselves.
  function changeFlask(value) {
    const next = REAGENTS[value];

    setFlaskReagent(value);

    const currentBurette =
      REAGENTS[buretteReagent];

    if (
      currentBurette.type ===
      next.type
    ) {
      setBuretteReagent(
        next.type === "acid"
          ? "NaOH"
          : "HCl"
      );
    }
  }

  function changeBurette(value) {
    const next = REAGENTS[value];

    setBuretteReagent(value);

    const currentFlask =
      REAGENTS[flaskReagent];

    if (
      currentFlask.type ===
      next.type
    ) {
      setFlaskReagent(
        next.type === "acid"
          ? "NaOH"
          : "HCl"
      );
    }
  }

  const buretteOptions =
    REAGENTS[flaskReagent].type ===
    "acid"
      ? BASES
      : ACIDS;

  const flaskOptions =
    Object.keys(REAGENTS);

  const nearEquivalence =
    Math.abs(
      titrantVolumeMl -
        chemistry
          .equivalenceTitrantVolumeMl
    ) < 2;

  const graph = useMemo(() => {
    const WIDTH = 520;
    const HEIGHT = 330;

    const padding = {
      left: 52,
      right: 20,
      top: 18,
      bottom: 46,
    };

    const xMax = 60;
    const yMin = 0;
    const yMax = 14;

    function x(v) {
      return (
        padding.left +
        (v / xMax) *
          (WIDTH -
            padding.left -
            padding.right)
      );
    }

    function y(pH) {
      const clipped =
        clamp(pH, yMin, yMax);

      return (
        padding.top +
        ((yMax - clipped) /
          (yMax - yMin)) *
          (HEIGHT -
            padding.top -
            padding.bottom)
      );
    }

    const polyline =
      points
        .map(
          (point) =>
            `${x(point.volume)},${y(
              point.pH
            )}`
        )
        .join(" ");

    return {
      WIDTH,
      HEIGHT,
      padding,
      x,
      y,
      polyline,
    };
  }, [points]);

  const flask =
    REAGENTS[flaskReagent];

  const burette =
    REAGENTS[buretteReagent];

  const statusText =
    chemistry.stage ===
    "equivalence"
      ? "EQUIVALENCE POINT"
      : chemistry.stage ===
        "approaching"
      ? "APPROACHING EQUIVALENCE"
      : chemistry.excess ===
        "acid"
      ? "ACID IN EXCESS"
      : "BASE IN EXCESS";

  const flaskLiquidClass =
    flask.type === "acid"
      ? "liquid-acid"
      : "liquid-base";

  const buretteLiquidClass =
    burette.type === "acid"
      ? "liquid-acid"
      : "liquid-base";

  return (
    <section className="titration-sim">
      <header className="titration-title">
        <div>
          <h2>
            pH Curve & Titration
            Visualizer
          </h2>

          <p>
            Add the titrant,
            follow the pH meter,
            and watch the curve
            form in real time.
          </p>
        </div>
      </header>

      <div className="experiment-options">
        <label>
          <span>
            Flask solution
          </span>

          <select
            value={flaskReagent}
            onChange={(e) =>
              changeFlask(
                e.target.value
              )
            }
          >
            {flaskOptions.map(
              (id) => {
                const r =
                  REAGENTS[id];

                return (
                  <option
                    key={id}
                    value={id}
                  >
                    {r.label} —{" "}
                    {r.strength ===
                    "strong"
                      ? "Strong"
                      : "Weak"}{" "}
                    {r.type ===
                    "acid"
                      ? "Acid"
                      : "Base"}
                  </option>
                );
              }
            )}
          </select>
        </label>

        <label>
          <span>
            Burette solution
          </span>

          <select
            value={
              buretteReagent
            }
            onChange={(e) =>
              changeBurette(
                e.target.value
              )
            }
          >
            {buretteOptions.map(
              (id) => {
                const r =
                  REAGENTS[id];

                return (
                  <option
                    key={id}
                    value={id}
                  >
                    {r.label} —{" "}
                    {r.strength ===
                    "strong"
                      ? "Strong"
                      : "Weak"}{" "}
                    {r.type ===
                    "acid"
                      ? "Acid"
                      : "Base"}
                  </option>
                );
              }
            )}
          </select>
        </label>

        <label>
          <span>
            Flask concentration
          </span>

          <select
            value={
              flaskConcentration
            }
            onChange={(e) =>
              setFlaskConcentration(
                Number(
                  e.target.value
                )
              )
            }
          >
            <option value={0.05}>
              0.050 mol dm⁻³
            </option>
            <option value={0.1}>
              0.100 mol dm⁻³
            </option>
            <option value={0.2}>
              0.200 mol dm⁻³
            </option>
          </select>
        </label>

        <label>
          <span>
            Burette concentration
          </span>

          <select
            value={
              buretteConcentration
            }
            onChange={(e) =>
              setBuretteConcentration(
                Number(
                  e.target.value
                )
              )
            }
          >
            <option value={0.05}>
              0.050 mol dm⁻³
            </option>
            <option value={0.1}>
              0.100 mol dm⁻³
            </option>
            <option value={0.2}>
              0.200 mol dm⁻³
            </option>
          </select>
        </label>
      </div>

      <div className="titration-main">
        {/* LEFT — LAB APPARATUS */}
        <div className="lab-panel">
          <div className="apparatus">
            <div className="retort-stand">
              <div className="stand-pole" />
              <div className="stand-foot" />
              <div className="clamp-arm" />
              <div className="clamp-head" />
            </div>

            <div className="burette-wrap">
              <div className="burette-name">
                {burette.label}
              </div>

              <div className="burette-conc">
                {buretteConcentration.toFixed(
                  3
                )}{" "}
                mol dm⁻³
              </div>

              <div className="burette-glass">
                <div
                  className={`burette-fluid ${buretteLiquidClass}`}
                  style={{
                    height: `${clamp(
                      78 -
                        titrantVolumeMl *
                          0.9,
                      8,
                      78
                    )}%`,
                  }}
                />

                {Array.from({
                  length: 14,
                }).map((_, i) => (
                  <span
                    className="graduation"
                    key={i}
                    style={{
                      top: `${
                        5 +
                        i * 6.5
                      }%`,
                    }}
                  />
                ))}

                <div className="glass-shine" />
              </div>

              <div className="stopcock">
                <div className="stopcock-bar" />
              </div>

              <div className="burette-tip" />

              <div
                key={dropKey}
                className={`titrant-drop ${buretteLiquidClass}`}
              />
            </div>

            <div
              key={swirlKey}
              className="flask-wrap"
            >
              <div className="flask-neck" />

              <div className="flask-body">
                <div
                  className={`flask-liquid ${flaskLiquidClass}`}
                >
                  <div className="liquid-wave" />
                </div>

                <div className="flask-highlight" />
              </div>

              <div className="flask-label">
                <strong>
                  {flask.label}
                </strong>

                <span>
                  {flaskVolumeMl.toFixed(
                    1
                  )}{" "}
                  cm³
                </span>
              </div>
            </div>

            <div className="ph-probe">
              <div className="probe-wire" />

              <div className="probe-body" />

              <div className="probe-tip" />
            </div>

            <div className="ph-meter">
              <span className="meter-label">
                pH METER
              </span>

              <strong>
                {formatPH(
                  chemistry.pH
                )}
              </strong>
            </div>
          </div>
        </div>

        {/* RIGHT — GRAPH */}
        <div className="graph-panel">
          <div className="graph-heading">
            <div>
              <h3>pH Curve</h3>

              <span>
                {burette.label}{" "}
                added to{" "}
                {flask.label}
              </span>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${graph.WIDTH} ${graph.HEIGHT}`}
            className="ph-graph"
          >
            <defs>
              <linearGradient
                id="curveGradient"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop
                  offset="0%"
                  stopColor="#6ea8ff"
                />
                <stop
                  offset="100%"
                  stopColor="#ff728b"
                />
              </linearGradient>

              <filter id="softGlow">
                <feGaussianBlur
                  stdDeviation="2"
                  result="blur"
                />
                <feMerge>
                  <feMergeNode
                    in="blur"
                  />
                  <feMergeNode
                    in="SourceGraphic"
                  />
                </feMerge>
              </filter>
            </defs>

            {/* horizontal grid */}
            {[
              0, 2, 4, 6, 7, 8,
              10, 12, 14,
            ].map((pH) => (
              <g key={pH}>
                <line
                  x1={
                    graph.padding
                      .left
                  }
                  x2={
                    graph.WIDTH -
                    graph.padding
                      .right
                  }
                  y1={graph.y(pH)}
                  y2={graph.y(pH)}
                  className={
                    pH === 7
                      ? "neutral-line"
                      : "grid-line"
                  }
                />

                <text
                  x={
                    graph.padding
                      .left - 12
                  }
                  y={
                    graph.y(pH) +
                    4
                  }
                  textAnchor="end"
                  className="axis-number"
                >
                  {pH}
                </text>
              </g>
            ))}

            {/* vertical grid */}
            {[
              0, 10, 20, 30,
              40, 50, 60,
            ].map((volume) => (
              <g key={volume}>
                <line
                  x1={graph.x(volume)}
                  x2={graph.x(volume)}
                  y1={graph.padding.top}
                  y2={
                    graph.HEIGHT -
                    graph.padding
                      .bottom
                  }
                  className="grid-line"
                />

                <text
                  x={graph.x(volume)}
                  y={
                    graph.HEIGHT -
                    21
                  }
                  textAnchor="middle"
                  className="axis-number"
                >
                  {volume}
                </text>
              </g>
            ))}

            {/* axes */}
            <line
              x1={graph.padding.left}
              y1={graph.padding.top}
              x2={graph.padding.left}
              y2={
                graph.HEIGHT -
                graph.padding.bottom
              }
              className="axis-line"
            />

            <line
              x1={graph.padding.left}
              y1={
                graph.HEIGHT -
                graph.padding.bottom
              }
              x2={
                graph.WIDTH -
                graph.padding.right
              }
              y2={
                graph.HEIGHT -
                graph.padding.bottom
              }
              className="axis-line"
            />

            {/* equivalence guide */}
            {showFeatures && (
              <>
                <line
                  x1={graph.x(
                    chemistry
                      .equivalenceTitrantVolumeMl
                  )}
                  x2={graph.x(
                    chemistry
                      .equivalenceTitrantVolumeMl
                  )}
                  y1={
                    graph.padding
                      .top
                  }
                  y2={
                    graph.HEIGHT -
                    graph.padding
                      .bottom
                  }
                  className="equivalence-guide"
                />

                <text
                  x={graph.x(
                    chemistry
                      .equivalenceTitrantVolumeMl
                  )}
                  y={
                    graph.padding
                      .top + 15
                  }
                  textAnchor="middle"
                  className="equivalence-text"
                >
                  Equivalence
                </text>
              </>
            )}

            {/* curve */}
            {points.length > 1 && (
              <polyline
                points={
                  graph.polyline
                }
                className="curve-line"
              />
            )}

            {/* points */}
            {points.map(
              (point, index) => (
                <circle
                  key={`${point.volume}-${index}`}
                  cx={graph.x(
                    point.volume
                  )}
                  cy={graph.y(
                    point.pH
                  )}
                  r={
                    index ===
                    points.length -
                      1
                      ? 5
                      : 2.7
                  }
                  className={
                    index ===
                    points.length -
                    1
                      ? "current-point"
                      : "curve-point"
                  }
                />
              )
            )}

            <text
              x="17"
              y={
                graph.HEIGHT / 2
              }
              transform={`rotate(-90 17 ${
                graph.HEIGHT / 2
              })`}
              textAnchor="middle"
              className="axis-title"
            >
              pH
            </text>

            <text
              x={
                graph.WIDTH / 2 +
                18
              }
              y={
                graph.HEIGHT - 3
              }
              textAnchor="middle"
              className="axis-title"
            >
              Volume of{" "}
              {burette.label}{" "}
              added / cm³
            </text>
          </svg>
        </div>
      </div>

      <div className="live-strip">
        <div>
          <span>
            Titrant added
          </span>

          <strong>
            {titrantVolumeMl.toFixed(
              1
            )}{" "}
            cm³
          </strong>
        </div>

        <div>
          <span>pH</span>

          <strong>
            {formatPH(
              chemistry.pH
            )}
          </strong>
        </div>

        <div
          className={`live-state state-${chemistry.stage}`}
        >
          <span>
            Current state
          </span>

          <strong>
            {statusText}
          </strong>
        </div>
      </div>

      <div className="titration-controls">
        {nearEquivalence && (
          <button
            type="button"
            onClick={() =>
              addTitrant(0.2)
            }
          >
            +0.2 cm³
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            addTitrant(0.5)
          }
        >
          +0.5 cm³
        </button>

        <button
          type="button"
          onClick={() =>
            addTitrant(1)
          }
        >
          +1.0 cm³
        </button>

        <button
          type="button"
          onClick={() =>
            addTitrant(5)
          }
        >
          +5.0 cm³
        </button>

        <button
          type="button"
          className={
            autoRunning
              ? "auto active"
              : "auto"
          }
          onClick={toggleAuto}
        >
          {autoRunning
            ? "Pause"
            : "Auto Add"}
        </button>

        <button
          type="button"
          className="feature-button"
          onClick={() =>
            setShowFeatures(
              (value) => !value
            )
          }
        >
          {showFeatures
            ? "Hide Features"
            : "Show Features"}
        </button>

        <button
          type="button"
          className="reset-button"
          onClick={() =>
            resetExperiment()
          }
        >
          Replay
        </button>
      </div>
    </section>
  );
}
