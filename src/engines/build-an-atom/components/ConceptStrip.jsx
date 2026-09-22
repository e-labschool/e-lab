const SECTIONS = [
  { type: "proton", title: "PROTONS", question: "Who is it?", body: "Determines the element.", color: "var(--color-teal)" },
  { type: "neutron", title: "NEUTRONS", question: "Which isotope?", body: "Changes the mass number.", color: "var(--color-violet)" },
  { type: "electron", title: "ELECTRONS", question: "What charge?", body: "Determines whether the species is neutral or an ion.", color: "var(--color-indigo)" },
];

export default function ConceptStrip({ highlightedType }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {SECTIONS.map((s) => (
        <div
          key={s.type}
          className="rounded-lg border p-2.5 text-center transition-shadow"
          style={{
            borderColor: highlightedType === s.type ? s.color : "var(--color-line)",
            boxShadow: highlightedType === s.type ? `0 0 0 2px ${s.color}` : "none",
          }}
        >
          <p className="text-[11px] font-bold" style={{ color: s.color }}>{s.title}</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--color-ink)]">{s.question}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
