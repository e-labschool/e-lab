// Tiny dense linear algebra for the normal-mode calculation (pure JS, no dependencies).
// Matrices are arrays of Float64Array rows (n x n). Only what the IR module needs: a symmetric eigen-solver (cyclic Jacobi),
// vector helpers and Gram-Schmidt. Sizes are tiny (3N <= 27), so clarity wins over speed.

export const zeros = (n, m = n) => Array.from({ length: n }, () => new Float64Array(m));
export const identity = (n) => { const a = zeros(n); for (let i = 0; i < n; i += 1) a[i][i] = 1; return a; };
export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 1) s += a[i] * b[i]; return s; };
export const norm = (a) => Math.sqrt(dot(a, a));
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Symmetric Jacobi eigen-decomposition. Returns eigenvalues ascending and eigenvectors as rows: vectors[k] belongs to values[k]. */
export function eigenSym(A, { tol = 1e-14, maxSweeps = 80 } = {}) {
  const n = A.length;
  const a = A.map((r) => Float64Array.from(r));
  const v = identity(n);
  for (let sweep = 0; sweep < maxSweeps; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p][q] * a[p][q];
    let diag = 0; for (let i = 0; i < n; i += 1) diag += a[i][i] * a[i][i];
    if (off <= tol * tol * Math.max(diag, 1e-300)) break;
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        const apq = a[p][q];
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1); const s = t * c;
        for (let k = 0; k < n; k += 1) { const akp = a[k][p]; const akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k += 1) { const apk = a[p][k]; const aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k += 1) { const vkp = v[k][p]; const vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[i][i] - a[j][j]);
  return { values: order.map((i) => a[i][i]), vectors: order.map((i) => Float64Array.from({ length: n }, (_, k) => v[k][i])) };
}

/** Orthonormalise in order (modified Gram-Schmidt); vectors with norm < eps after projection are dropped. */
export function gramSchmidt(vectors, eps = 1e-9) {
  const out = [];
  for (const v0 of vectors) {
    const v = Float64Array.from(v0);
    for (let pass = 0; pass < 2; pass += 1) for (const u of out) { const c = dot(v, u); for (let i = 0; i < v.length; i += 1) v[i] -= c * u[i]; }
    const nv = norm(v); if (nv < eps) continue;
    for (let i = 0; i < v.length; i += 1) v[i] /= nv;
    out.push(v);
  }
  return out;
}
