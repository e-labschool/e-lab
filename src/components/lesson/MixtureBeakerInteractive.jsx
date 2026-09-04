import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import ThreeCanvas from "../3d/ThreeCanvas.jsx";
import MixtureBeakerScene3D from "../3d/MixtureBeakerScene3D.jsx";

const MIXTURES = {
  "salt-water": { label: "Salt + Water", macro: "Clear, uniform liquid — no visible particles.", answer: "homogeneous" },
  "sand-water": { label: "Sand + Water", macro: "Cloudy at first; sand settles to the bottom over time.", answer: "heterogeneous" },
  "oil-water": { label: "Oil + Water", macro: "Two distinct liquid layers, oil floating on water.", answer: "heterogeneous" },
};

const SORT_ITEMS = [
  { id: "salt-solution", label: "Salt solution", answer: "homogeneous" },
  { id: "air", label: "Air", answer: "homogeneous" },
  { id: "sand-water", label: "Sand + water", answer: "heterogeneous" },
  { id: "oil-water", label: "Oil + water", answer: "heterogeneous" },
];

export default function MixtureBeakerInteractive() {
  const [mixture, setMixture] = useState("salt-water");
  const [view, setView] = useState("particle");
  const [sorted, setSorted] = useState({});

  function sort(id, value) {
    setSorted((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(MIXTURES).map(([id, m]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMixture(id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              mixture === id
                ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5 text-xs">
        {["macro", "particle"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-md px-2.5 py-1 font-medium ${view === v ? "bg-[var(--color-ink)] text-[var(--color-paper)]" : "text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"}`}
          >
            {v === "macro" ? "Macro view" : "Particle model"}
          </button>
        ))}
      </div>

      {view === "particle" ? (
        <div className="mt-3">
          <ThreeCanvas height={280} cameraDistance={3.2} fallbackLabel="Mixture particle model" fallbackDescription={MIXTURES[mixture].macro}>
            <MixtureBeakerScene3D mixture={mixture} />
          </ThreeCanvas>
        </div>
      ) : (
        <div className="mt-3 flex h-[280px] items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">{MIXTURES[mixture].macro}</p>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-[var(--color-line)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Classify: homogeneous or heterogeneous?</p>
        <div className="mt-2 flex flex-col gap-2">
          {SORT_ITEMS.map((item) => {
            const chosen = sorted[item.id];
            return (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--color-ink)]">{item.label}</span>
                <div className="flex gap-1.5">
                  {["homogeneous", "heterogeneous"].map((opt) => {
                    const isChosen = chosen === opt;
                    const isRight = chosen && opt === item.answer;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => sort(item.id, opt)}
                        disabled={Boolean(chosen)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                          isChosen && isRight ? "border-[var(--color-teal)] bg-[var(--color-teal-soft)] text-[var(--color-teal)]" :
                          isChosen && !isRight ? "border-[var(--color-coral)] bg-[var(--color-coral-soft)] text-[var(--color-coral)]" :
                          "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
                        }`}
                      >
                        {opt === "homogeneous" ? "Homo." : "Hetero."}
                      </button>
                    );
                  })}
                  {chosen && (chosen === item.answer ? <CheckCircle2 size={15} className="text-[var(--color-teal)]" /> : <XCircle size={15} className="text-[var(--color-coral)]" />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
