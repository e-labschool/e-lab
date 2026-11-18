// Procedural, softly blurred laboratory backdrop (no network, no image files): window light, counter, cabinets, plant, flasks, tube rack.
// Drawn once to a 2D canvas and shown behind the transparent WebGL canvas.  It is a painting, not geometry (documented limitation).
export function paintBackdrop(canvas, dark) {
  const W = 960, H = 540; canvas.width = W; canvas.height = H; const g = canvas.getContext("2d"); if (!g) return;
  const wall = g.createLinearGradient(0, 0, 0, H); 
  if (dark) { wall.addColorStop(0, "#1b2740"); wall.addColorStop(0.6, "#162036"); wall.addColorStop(1, "#0f1626"); } else { wall.addColorStop(0, "#e6eef7"); wall.addColorStop(0.55, "#d3dfec"); wall.addColorStop(1, "#c5d3e2"); }
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  const glow = (x, y, r, c0, c1) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c0); rg.addColorStop(1, c1); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); };
  // windows (bright)
  glow(W * 0.86, H * 0.28, 260, dark ? "rgba(120,160,230,0.55)" : "rgba(255,255,255,0.95)", "rgba(255,255,255,0)");
  glow(W * 0.12, H * 0.2, 230, dark ? "rgba(90,130,210,0.4)" : "rgba(255,255,255,0.85)", "rgba(255,255,255,0)");
  g.fillStyle = dark ? "rgba(140,175,235,0.22)" : "rgba(255,255,255,0.7)"; for (let i = 0; i < 4; i += 1) g.fillRect(W * (0.72 + i * 0.065), H * 0.05, W * 0.05, H * 0.4);
  // back counter + cabinets
  g.fillStyle = dark ? "#2a3550" : "#a9b8cb"; g.fillRect(0, H * 0.5, W, H * 0.07);
  { const cg = g.createLinearGradient(0, H * 0.57, 0, H); if (dark) { cg.addColorStop(0, "#1c2740"); cg.addColorStop(1, "#2a3552"); } else { cg.addColorStop(0, "#bcc8d8"); cg.addColorStop(1, "#aeb9c9"); } g.fillStyle = cg; g.fillRect(0, H * 0.57, W, H * 0.43); }
  g.strokeStyle = dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.45)"; g.lineWidth = 3; for (let i = 1; i < 9; i += 1) { g.beginPath(); g.moveTo(W * i / 9, H * 0.57); g.lineTo(W * i / 9, H * 0.82); g.stroke(); }
  // glassware bokeh on the back counter
  const flask = (x, base, s, liquid) => {
    g.fillStyle = dark ? "rgba(190,215,255,0.28)" : "rgba(255,255,255,0.6)"; g.beginPath(); g.moveTo(x - 10 * s, base - 120 * s); g.lineTo(x + 10 * s, base - 120 * s); g.lineTo(x + 12 * s, base - 80 * s); g.lineTo(x + 50 * s, base); g.lineTo(x - 50 * s, base); g.lineTo(x - 12 * s, base - 80 * s); g.closePath(); g.fill();
    if (liquid) { g.fillStyle = liquid; g.beginPath(); g.moveTo(x - 27 * s, base - 34 * s); g.lineTo(x + 27 * s, base - 34 * s); g.lineTo(x + 50 * s, base); g.lineTo(x - 50 * s, base); g.closePath(); g.fill(); }
  };
  flask(W * 0.1, H * 0.54, 1.15, "rgba(40,130,230,0.8)"); flask(W * 0.45, H * 0.52, 0.8, "rgba(120,190,250,0.5)"); flask(W * 0.9, H * 0.55, 1.1, "rgba(40,120,220,0.7)"); flask(W * 0.28, H * 0.52, 0.7, null);
  const tubes = (x0) => { const cols = ["#2b7de0", "#f2b134", "#e0489c", "#34b6a6", "#2b7de0"]; cols.forEach((c, i) => { const x = x0 + i * 24; g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(x, H * 0.3, 15, H * 0.22); g.fillStyle = c; g.fillRect(x + 1, H * 0.42, 13, H * 0.1); }); g.fillStyle = dark ? "#3a476a" : "#e5ecf4"; g.fillRect(x0 - 8, H * 0.46, 125, 10); };
  tubes(W * 0.64); tubes(W * 0.03);
  // wall shelves with reagent bottles and glassware (bright, varied, later blurred)
  { const cols = dark ? ["#5b8bd6", "#c9a24a", "#c8588f", "#4fb0a2", "#7d6fd6"] : ["#2b7de0", "#f2b134", "#e0489c", "#34b6a6", "#7b5ce0", "#f07a3c"];
    const bottle = (x, base, hgt, wid, c) => { g.fillStyle = dark ? "rgba(200,220,255,0.3)" : "rgba(255,255,255,0.75)"; g.fillRect(x, base - hgt, wid, hgt); g.fillRect(x + wid * 0.3, base - hgt - hgt * 0.18, wid * 0.4, hgt * 0.2); g.fillStyle = c; g.fillRect(x + 2, base - hgt * 0.62, wid - 4, hgt * 0.6); g.fillStyle = dark ? "#34415e" : "#e9eef6"; g.fillRect(x + wid * 0.26, base - hgt - hgt * 0.24, wid * 0.48, hgt * 0.07); };
    for (const [sy, x0, x1, seed] of [[H * 0.3, W * 0.18, W * 0.6, 3], [H * 0.44, W * 0.2, W * 0.58, 8]]) {
      g.fillStyle = dark ? "#33405e" : "#b7c4d6"; g.fillRect(x0 - 20, sy, x1 - x0 + 40, 8);
      let x = x0; let k = seed; while (x < x1) { k += 1; const hh = 34 + ((k * 37) % 26); const ww = 16 + ((k * 13) % 12); bottle(x, sy, hh, ww, cols[k % cols.length]); x += ww + 8 + ((k * 7) % 12); }
    }
    // erlenmeyer + beaker on the counter, in front of the shelves
    const beaker = (x, base, w, hgt, c) => { g.fillStyle = dark ? "rgba(200,220,255,0.3)" : "rgba(255,255,255,0.7)"; g.fillRect(x, base - hgt, w, hgt); g.fillStyle = c; g.fillRect(x + 3, base - hgt * 0.45, w - 6, hgt * 0.45); g.strokeStyle = dark ? "rgba(255,255,255,0.2)" : "rgba(60,90,140,0.35)"; g.lineWidth = 2; for (let i = 1; i < 5; i += 1) { g.beginPath(); g.moveTo(x + w * 0.1, base - hgt * i / 5); g.lineTo(x + w * 0.4, base - hgt * i / 5); g.stroke(); } };
    beaker(W * 0.33, H * 0.5, 46, 70, "rgba(60,140,235,0.7)"); beaker(W * 0.55, H * 0.5, 38, 60, "rgba(240,190,70,0.65)"); beaker(W * 0.77, H * 0.5, 50, 74, "rgba(70,170,230,0.6)"); }
  // plants
  const plant = (x, y, r) => { for (let i = 0; i < 9; i += 1) { const a = i * 0.7; g.fillStyle = `rgba(${dark ? 40 : 70},${dark ? 110 : 170},${dark ? 70 : 90},0.8)`; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a * 1.3) * r * 0.45, r * 0.5, r * 0.28, a, 0, 7); g.fill(); } };
  plant(W * 0.02, H * 0.36, 55); plant(W * 0.98, H * 0.38, 50);
  // bokeh
  let sd = 5; const r = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  for (let i = 0; i < 26; i += 1) glow(r() * W, r() * H * 0.55, 18 + r() * 26, dark ? "rgba(150,190,255,0.22)" : "rgba(255,255,255,0.55)", "rgba(255,255,255,0)");
  // soften: blur where supported, otherwise rely on the small canvas + CSS scaling
  try { if ("filter" in g) { const t = document.createElement("canvas"); t.width = W; t.height = H; t.getContext("2d").drawImage(canvas, 0, 0); g.clearRect(0, 0, W, H); g.filter = "blur(9px)"; g.drawImage(t, -10, -10, W + 20, H + 20); g.filter = "none"; } } catch { /* keep sharp */ }
}
