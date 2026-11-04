// A generic, schematic atom diagram — NOT tied to a specific element's
// exact particle count (the accompanying question never asks students to
// count particles from this image; it asks about the concept: what a
// nucleon is, where mass is concentrated, overall charge). Deliberately
// plain: small nucleus of protons/neutrons, one electron shell, and a
// legend rather than text stamped on top of filled shapes — keeps it
// correctly readable in both light and dark theme, and in the fixed
// black-on-white print/export context, without any theme-dependent fill.
export default function AtomDiagram() {
  return (
    <div className="flex items-center gap-4 text-[var(--color-ink)]">
      <svg viewBox="0 0 200 200" className="h-40 w-40" role="img" aria-label="Schematic diagram of an atom showing a central nucleus of protons and neutrons surrounded by electrons">
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = 100 + 80 * Math.cos(rad);
          const y = 100 + 80 * Math.sin(rad);
          return <circle key={deg} cx={x} cy={y} r="5" fill="currentColor" />;
        })}

        <circle cx="100" cy="100" r="26" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="90" cy="94" r="6" fill="currentColor" />
        <circle cx="108" cy="96" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="98" cy="110" r="6" fill="currentColor" />
        <circle cx="112" cy="112" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="flex flex-col gap-1.5 text-xs text-[var(--color-ink-soft)]">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-current" /> proton (p+)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border border-current" /> neutron (n0)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-current opacity-70" /> electron (e&minus;)</span>
      </div>
    </div>
  );
}
