// A simple bar magnet with red/blue painted ends (a familiar, clear
// visual convention for "this attracts magnetic material"), held by a
// small handle.
export default function Magnet({ x, y, width = 70, height = 22, rotation = 0 }) {
  const half = width / 2;
  return (
    <g transform={rotation ? `translate(${x},${y}) rotate(${rotation})` : `translate(${x},${y})`}>
      <rect x={-half} y={-height / 2} width={half} height={height} rx="3" fill="#C23B3B" />
      <rect x="0" y={-height / 2} width={half} height={height} rx="3" fill="#3654D6" />
      <rect x={-half} y={-height / 2} width={width} height={height} rx="3" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
      <rect x={-6} y={-height / 2 - 8} width="12" height="9" rx="2" fill="#5E6570" />
    </g>
  );
}
