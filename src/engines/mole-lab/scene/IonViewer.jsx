import { useEffect, useRef } from "react";
import { ionScene } from "./ionScene.js";
import { atomColour } from "../engine/particles.js";

// MICROSCOPIC PARTICLE VIEWER (2D canvas, pseudo-3D).  Every pane shows the SAME physical window (2 nm cube): ion density is the
// only thing that changes with concentration, the water colour never does (spec: no arbitrary liquid darkness).  Ions are
// drawn as hydrated ions (the ion plus a shell of oriented water molecules); no intact NaOH / NaCl molecules exist in solution.
// Sizes are enlarged for visibility and the shell is schematic; both facts are printed under the viewer.

const ION_COLOUR = { Na: () => atomColour("Na"), OH: () => atomColour("O"), Cl: () => atomColour("Cl") };
const ION_R = { cation: 0.075, anion: 0.1 }; // fraction of the window half-width (enlarged ionic radii)

function spriteFor(colour, label, hydrated, dark) {
  const S = 96; const c = document.createElement("canvas"); c.width = S; c.height = S; const g = c.getContext("2d"); const m = S / 2;
  if (hydrated) {
    const halo = g.createRadialGradient(m, m, S * 0.12, m, m, S * 0.5); halo.addColorStop(0, dark ? "rgba(150,200,255,0.30)" : "rgba(80,140,220,0.22)"); halo.addColorStop(1, "rgba(120,170,230,0)");
    g.fillStyle = halo; g.beginPath(); g.arc(m, m, S * 0.5, 0, 6.2832); g.fill();
    for (let k = 0; k < 6; k += 1) { // six water molecules, oxygen towards a cation / hydrogens towards an anion
      const a = (k / 6) * 6.2832 + 0.4; const rr = S * 0.37; const x = m + Math.cos(a) * rr; const y = m + Math.sin(a) * rr;
      g.fillStyle = "#e0463f"; g.beginPath(); g.arc(x, y, S * 0.062, 0, 6.2832); g.fill();
      const ang = a + (label === "anion" ? 3.14159 : 0); for (const s of [-1, 1]) { g.fillStyle = "#f4f7ff"; g.beginPath(); g.arc(x + Math.cos(ang + s * 0.9) * S * 0.06, y + Math.sin(ang + s * 0.9) * S * 0.06, S * 0.032, 0, 6.2832); g.fill(); }
    }
  }
  const r = S * (hydrated ? 0.2 : 0.3); const gr = g.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
  gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.18, colour); gr.addColorStop(1, shade(colour, -0.35));
  g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, 6.2832); g.fill();
  g.strokeStyle = "rgba(0,0,0,0.22)"; g.lineWidth = 1; g.stroke();
  return c;
}
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

function makeSprites(ions, dark) {
  const [cat, an] = ions; const col = (i) => (ION_COLOUR[i.id] ?? (() => "#aaaaaa"))();
  return { cation: { hyd: spriteFor(col(cat), "cation", true, dark), dry: spriteFor(col(cat), "cation", false, dark) }, anion: { hyd: spriteFor(col(an), "anion", true, dark), dry: spriteFor(col(an), "anion", false, dark) } };
}

/** Draw one frame of a pane.  `t` = seconds, `rot` = view rotation (radians). */
export function drawPane(ctx, W, H, scene, { t, rot, dark, label }) {
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, dark ? "#16283d" : "#eaf4fc"); bg.addColorStop(1, dark ? "#0e1b2c" : "#d2e7f6");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const half = Math.min(W, H) * 0.34; const cx = W / 2; const cy = H / 2 + H * 0.01;
  const cosr = Math.cos(rot); const sinr = Math.sin(rot); const tilt = 0.32; const ct = Math.cos(tilt); const st = Math.sin(tilt);
  const proj = (x, y, z) => { const x1 = x * cosr + z * sinr; const z1 = -x * sinr + z * cosr; const y2 = y * ct - z1 * st; const z2 = y * st + z1 * ct; const persp = 1 / (1 - z2 * 0.18); return { sx: cx + x1 * half * persp, sy: cy - y2 * half * persp, d: z2, k: persp }; };
  // the window: a cube drawn as faint edges (back edges fainter)
  const corners = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push(proj(x, y, z));
  const edge = (a, b) => { ctx.beginPath(); ctx.moveTo(corners[a].sx, corners[a].sy); ctx.lineTo(corners[b].sx, corners[b].sy); ctx.stroke(); };
  ctx.lineWidth = 1; ctx.strokeStyle = dark ? "rgba(190,215,245,0.35)" : "rgba(40,70,120,0.35)";
  for (const [a, b] of [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]]) edge(a, b);
  // ions and lattice, back to front
  const items = [];
  for (const i of scene.ions) { const w = t * (0.9 + (i.x * 7.3 % 1)); const jx = Math.sin(w * 1.3 + i.y * 9) * 0.035; const jy = Math.cos(w * 1.1 + i.z * 8) * 0.035; const jz = Math.sin(w * 0.9 + i.x * 6) * 0.035; items.push({ p: proj(i.x + jx, i.y + jy, i.z + jz), sp: i.species, hyd: true }); }
  for (const i of scene.lattice) items.push({ p: proj(i.x, i.y, i.z), sp: i.species, hyd: false });
  items.sort((a, b) => a.p.d - b.p.d);
  for (const it of items) {
    const sprite = scene.sprites[it.sp][it.hyd ? "hyd" : "dry"]; const r = ION_R[it.sp] * half * 1.55 * it.p.k * (it.hyd ? 3.4 : 2.3);
    ctx.globalAlpha = 0.55 + 0.45 * (it.p.d + 1) / 2; ctx.drawImage(sprite, it.p.sx - r, it.p.sy - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  // front edges again so the window reads as a window
  ctx.strokeStyle = dark ? "rgba(200,225,250,0.55)" : "rgba(30,60,110,0.5)";
  for (const [a, b] of [[4, 5], [4, 6], [5, 7], [6, 7]]) edge(a, b);
  // scale bar: 1 nm of the 2 nm window
  const bar = half * 1.0; ctx.strokeStyle = dark ? "#e9f1ff" : "#16233f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, H - 14); ctx.lineTo(10 + bar, H - 14); ctx.moveTo(10, H - 18); ctx.lineTo(10, H - 10); ctx.moveTo(10 + bar, H - 18); ctx.lineTo(10 + bar, H - 10); ctx.stroke();
  ctx.fillStyle = dark ? "#e9f1ff" : "#16233f"; ctx.font = "600 11px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText("1 nm", 14 + bar, H - 10);
  if (!scene.ions.length && !scene.lattice.length) { ctx.textAlign = "center"; ctx.font = "600 12px system-ui, sans-serif"; ctx.fillStyle = dark ? "#b9cbe6" : "#4a5a78"; const words = String(label || "No ions yet").split(" "); const lines = []; let cur = "";
    for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (cur && ctx.measureText(t).width > W - 24) { lines.push(cur); cur = w; } else cur = t; }
    lines.push(cur); lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * 15)); }
}

/** One canvas pane.  `pane` is a view pane from stage3View; redraws on a rAF loop only while mounted and visible. */
export default function IonPane({ pane, size = 160, dark, reduced, testId }) {
  const ref = useRef(null); const live = useRef({});
  const scene = ionScene({ c: pane.c, state: pane.state, solidFraction: pane.solidFraction });
  live.current = { scene, dark, reduced, pane };
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined; const ctx = cv.getContext("2d"); if (!ctx) return undefined;
    const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0; let sprites = null; let spriteKey = ""; let alive = true; const t0 = performance.now();
    const frame = (now) => {
      if (!alive) return; const L = live.current;
      const key = `${L.dark}|${L.pane.ions.map((i) => i.id).join(",")}`; if (key !== spriteKey) { spriteKey = key; sprites = makeSprites(L.pane.ions, L.dark); }
      const t = L.reduced ? 0 : (now - t0) / 1000; const rot = L.reduced ? 0.55 : 0.55 + t * 0.14;
      drawPane(ctx, size, size, { ...L.scene, sprites }, { t, rot, dark: L.dark, label: L.pane.note });
      if (!L.reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // reduced motion draws one still frame each time the content changes (see the dependency below)
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [size, reduced, dark, pane.c, pane.state, pane.solidFraction, pane.ions]);
  return <canvas ref={ref} className="ml3-pane-canvas" style={{ width: size, height: size }} data-testid={testId} data-ions={scene.ions.length} data-lattice={scene.lattice.length} role="img"
    aria-label={`${pane.label}: ${pane.state === "empty" ? "no ions yet" : `${scene.ions.length} hydrated ions in the 2 nm window, concentration ${pane.cText}`}`} />;
}
