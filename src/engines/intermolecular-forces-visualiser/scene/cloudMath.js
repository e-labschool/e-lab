export const tanhSafe = (x) => { if (x > 8) return 1; if (x < -8) return -1; const e = Math.exp(2 * x); return (e - 1) / (e + 1); };
