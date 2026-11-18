// Indexed unit icosphere (pure typed arrays; no three). 12, 42, 162, 642, 2562 vertices for subdiv 0..4.
export function icosphere(subdiv) {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l]; });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < subdiv; s += 1) {
    const cache = new Map();
    const mid = (a, b) => {
      const k = a < b ? `${a}_${b}` : `${b}_${a}`; let m = cache.get(k);
      if (m === undefined) { const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2]; const l = Math.hypot(...p); v.push([p[0] / l, p[1] / l, p[2] / l]); m = v.length - 1; cache.set(k, m); }
      return m;
    };
    const nf = [];
    for (const [a, b, c] of f) { const ab = mid(a, b); const bc = mid(b, c); const ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  const dirs = new Float32Array(v.length * 3); v.forEach((p, i) => dirs.set(p, 3 * i));
  const index = new Uint32Array(f.length * 3); f.forEach((tri, i) => index.set(tri, 3 * i));
  return { dirs, index, count: v.length };
}
