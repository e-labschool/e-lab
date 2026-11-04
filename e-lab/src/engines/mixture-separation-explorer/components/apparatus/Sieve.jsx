// A circular sieve frame with a cross-hatched mesh pattern -- the mesh
// hole size is implied visually by the grid spacing, not literally
// measured, but reads clearly as "a mesh with holes" rather than a
// solid surface.
export default function Sieve({ x, y, width, meshY }) {
  const uid = "mse-sieve";
  const spacing = width * 0.045;
  return (
    <g>
      <rect x={x} y={y} width={width} height="14" rx="3" fill="#B9BFC8" stroke="#8A929E" strokeWidth="1" />
      <defs>
        <pattern id={`${uid}-mesh`} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <path d={`M0 0 L${spacing} ${spacing} M${spacing} 0 L0 ${spacing}`} stroke="#8A929E" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x={x + 4} y={meshY} width={width - 8} height="6" fill={`url(#${uid}-mesh)`} opacity="0.85" />
    </g>
  );
}
