/** The one-pulse sequence as a strip: relaxation delay | RF pulse | acquire (FID). `active` 0 none, 1 delay, 2 pulse, 3 acquire. Not to scale in time (a pulse lasts microseconds, the FID about a second). */
export default function PulseSequence({ active }) {
  const seg = (x, w, id, label, sub) => (
    <g>
      <rect x={x} y="12" width={w} height="30" rx="6" fill={active === id ? "var(--ss-accent-solid)" : "rgba(30,52,108,0.6)"} stroke={active === id ? "#5eead4" : "var(--ss-line)"} strokeWidth={active === id ? 2.5 : 1.5} />
      <text x={x + w / 2} y="31" textAnchor="middle" className="ss-svgtext ss-svgtext--b">{label}</text>
      <text x={x + w / 2} y="58" textAnchor="middle" className="ss-svgtext ss-svgtext--sm">{sub}</text>
    </g>
  );
  return (
    <svg className="ss-pulseseq" viewBox="0 0 320 66" role="img" aria-label={`Pulse sequence: relaxation delay, then an RF pulse, then acquire the FID. ${active === 2 ? "The RF pulse is happening now." : active === 3 ? "The FID is being acquired now." : ""}`} data-testid="pulse-sequence" data-active={active}>
      {seg(4, 82, 1, "delay", "nuclei recover")}
      {seg(92, 66, 2, "RF pulse", "µs")}
      {seg(164, 152, 3, "acquire FID", "about a second")}
    </svg>
  );
}
