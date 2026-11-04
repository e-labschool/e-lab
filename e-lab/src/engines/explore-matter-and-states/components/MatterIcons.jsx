// A small, consistent set of hand-built SVG icons for the example tray.
// Deliberately simple flat vector shapes in the e-Lab palette — not photos,
// not clipart, not emoji. Every icon shares a 64x64 viewBox so the tray can
// lay them out uniformly.

const stroke = "var(--color-ink)";
const line = "var(--color-line)";

function Wrap({ children }) {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
      {children}
    </svg>
  );
}

export const Rock = () => (
  <Wrap>
    <path d="M10 44 L18 26 L30 20 L46 24 L54 40 L48 50 L16 50 Z" fill="var(--color-ink-faint)" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M22 34 L30 30 L40 34" fill="none" stroke={line} strokeWidth="1.5" />
  </Wrap>
);

export const IronNail = () => (
  <Wrap>
    <rect x="29" y="14" width="6" height="34" rx="1" fill="var(--color-block-d)" />
    <path d="M32 48 L24 58 L32 54 L40 58 Z" fill="var(--color-block-d)" />
    <rect x="24" y="10" width="16" height="6" rx="1.5" fill="var(--color-ink)" />
  </Wrap>
);

export const Ice = () => (
  <Wrap>
    <path d="M16 20 h32 v10 l-6 20 h-20 l-6 -20 Z" fill="var(--color-indigo-soft)" stroke="var(--color-indigo)" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M24 24 v20 M32 24 v24 M40 24 v20" stroke="var(--color-indigo)" strokeWidth="1" opacity="0.5" />
  </Wrap>
);

export const Salt = () => (
  <Wrap>
    <path d="M14 42 Q32 30 50 42 L46 48 H18 Z" fill="var(--color-paper-raised)" stroke={stroke} strokeWidth="1.5" />
    {[...Array(9)].map((_, i) => (
      <rect key={i} x={20 + (i % 3) * 8} y={30 + Math.floor(i / 3) * 6} width="4" height="4" fill="var(--color-ink-soft)" transform={`rotate(${(i * 13) % 30} ${22 + (i % 3) * 8} ${32 + Math.floor(i / 3) * 6})`} />
    ))}
  </Wrap>
);

export const Copper = () => (
  <Wrap>
    <rect x="14" y="24" width="36" height="18" rx="2" fill="var(--color-amber)" stroke={stroke} strokeWidth="1.5" />
    <path d="M14 28 h36 M14 34 h36 M14 38 h36" stroke="var(--color-paper)" strokeWidth="1" opacity="0.35" />
  </Wrap>
);

export const Water = () => (
  <Wrap>
    <path d="M20 20 h24 v6 l4 4 v20 a2 2 0 0 1 -2 2 h-28 a2 2 0 0 1 -2 -2 v-20 l4 -4 Z" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M18 34 h28 v16 a2 2 0 0 1 -2 2 h-24 a2 2 0 0 1 -2 -2 Z" fill="var(--color-indigo-soft)" stroke="var(--color-indigo)" strokeWidth="1" />
  </Wrap>
);

export const Ethanol = () => (
  <Wrap>
    <path d="M28 12 h8 v10 l6 6 v22 a3 3 0 0 1 -3 3 h-14 a3 3 0 0 1 -3 -3 v-22 l6 -6 Z" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M24 32 h16 v16 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 Z" fill="var(--color-teal-soft)" stroke="var(--color-teal)" strokeWidth="1" />
  </Wrap>
);

export const Air = () => (
  <Wrap>
    <path d="M32 14 c10 0 16 8 16 16 c0 9 -7 16 -16 20 c-9 -4 -16 -11 -16 -20 c0 -8 6 -16 16 -16 Z" fill="var(--color-paper)" stroke="var(--color-ink-faint)" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="26" cy="26" r="2" fill="var(--color-ink-faint)" />
    <circle cx="36" cy="30" r="2" fill="var(--color-ink-faint)" />
    <circle cx="30" cy="38" r="2" fill="var(--color-ink-faint)" />
  </Wrap>
);

export const Oxygen = () => (
  <Wrap>
    <rect x="24" y="12" width="16" height="40" rx="6" fill="var(--color-indigo-soft)" stroke="var(--color-indigo)" strokeWidth="1.5" />
    <rect x="28" y="8" width="8" height="6" rx="1.5" fill="var(--color-ink)" />
    <text x="32" y="46" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-indigo)">O2</text>
  </Wrap>
);

export const CarbonDioxide = () => (
  <Wrap>
    <rect x="24" y="12" width="16" height="40" rx="6" fill="var(--color-teal-soft)" stroke="var(--color-teal)" strokeWidth="1.5" />
    <rect x="28" y="8" width="8" height="6" rx="1.5" fill="var(--color-ink)" />
    <text x="32" y="46" textAnchor="middle" fontSize="8" fontFamily="var(--font-mono)" fill="var(--color-teal)">CO2</text>
  </Wrap>
);

export const Light = () => (
  <Wrap>
    <path d="M32 14 a10 10 0 0 1 6 18 v4 h-12 v-4 a10 10 0 0 1 6 -18 Z" fill="var(--color-amber-soft)" stroke="var(--color-amber)" strokeWidth="1.5" />
    <rect x="27" y="38" width="10" height="6" fill="var(--color-ink-faint)" />
    <path d="M32 4 v4 M14 22 h4 M46 22 h4 M20 10 l3 3 M44 10 l-3 3" stroke="var(--color-amber)" strokeWidth="1.5" strokeLinecap="round" />
  </Wrap>
);

export const Sound = () => (
  <Wrap>
    <path d="M16 26 h8 l10 -10 v32 l-10 -10 h-8 Z" fill="var(--color-ink)" />
    <path d="M40 24 a10 10 0 0 1 0 16" fill="none" stroke="var(--color-indigo)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M45 18 a18 18 0 0 1 0 28" fill="none" stroke="var(--color-indigo)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
  </Wrap>
);

export const Heat = () => (
  <Wrap>
    <rect x="18" y="30" width="28" height="14" rx="2" fill="var(--color-amber-soft)" stroke="var(--color-amber)" strokeWidth="1.5" />
    <path d="M32 12 c3 4 -2 6 0 10 M24 16 c3 4 -2 6 0 10 M40 16 c3 4 -2 6 0 10" fill="none" stroke="var(--color-amber)" strokeWidth="1.5" strokeLinecap="round" />
  </Wrap>
);

export const Shadow = () => (
  <Wrap>
    <circle cx="16" cy="20" r="4" fill="var(--color-amber)" />
    <rect x="28" y="24" width="8" height="16" fill="var(--color-ink)" />
    <ellipse cx="46" cy="48" rx="12" ry="4" fill="var(--color-ink-faint)" opacity="0.5" />
  </Wrap>
);

export const MATTER_ICONS = {
  rock: Rock, "iron-nail": IronNail, ice: Ice, salt: Salt, copper: Copper,
  water: Water, ethanol: Ethanol, air: Air, oxygen: Oxygen, "carbon-dioxide": CarbonDioxide,
};

export const NON_MATTER_ICONS = { light: Light, sound: Sound, heat: Heat, shadow: Shadow };
