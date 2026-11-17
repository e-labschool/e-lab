/** OE-09: the nucleus as a small dot.  A real nucleus is about 10^-5 of an orbital radius, so even this is far too big;
 *  the stage carries a visible "not to scale" caption (see NucleusNote). */
export default function NucleusDot() {
  return (
    <mesh>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color="#F5C542" emissive="#8a6400" emissiveIntensity={0.9} />
    </mesh>
  );
}

export function NucleusNote() {
  return <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]" data-testid="nucleus-note">Not to scale: the nucleus (yellow dot) is drawn far too large; a real nucleus is about 10{"⁻⁵"} of an orbital radius.</p>;
}
