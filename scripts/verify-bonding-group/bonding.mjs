// Bonding Visualizer: 3 sizes x light/dark, stage-first on phone, covalent library / dative / polarity, metallic no-WebGL, keyboard, reduced motion.
export default async function ({ open, health, check, sleep, T, shot, SIZES, errorsCheck }) {
  const URL = "/simulation/bonding-visualizer";
  for (const [w, h] of SIZES) for (const scheme of ["light", "dark"]) {
    const label = `bonding ${w}x${h} ${scheme}`; console.log(" ", label);
    const S = await open(URL, { w, h, scheme, touch: w < 600 }); const p = S.page;
    await health(S, `${label} ionic`, T("bonding-workspace"));
    await p.locator(T("tab-covalent")).click(); await sleep(700);
    await health(S, `${label} covalent`, T("bonding-workspace"));
    if (w < 600) {
      const o = await p.evaluate(() => { const c = document.querySelector('[data-testid="canvas"]').getBoundingClientRect(); const lib = document.querySelector(".bv-library")?.getBoundingClientRect(); return { canvasTop: c.top, libTop: lib?.top ?? 1e9, canvasH: c.height }; });
      check(o.canvasTop < o.libTop, `${label}: the 3D stage comes before the element library (stage top ${Math.round(o.canvasTop)} < library top ${Math.round(o.libTop)})`);
      check(o.canvasTop < 420, `${label}: stage starts in the first screen (${Math.round(o.canvasTop)}px)`);
    }
    if (w === 1366 && scheme === "light") {
      for (const [tab, id] of [["Double Bond", "CO2"], ["Triple Bond", "N2"], ["Coordinate bonds & ions", "CO"], ["Coordinate bonds & ions", "NH4+"]]) {
        await p.getByText(tab, { exact: true }).first().click(); await sleep(300);
        const ex = p.locator(`[data-testid="example-${id}"]`);
        if (await ex.count()) { await ex.first().click(); await sleep(500); } else check(false, `${label}: example ${id} missing`);
        const clip0 = await p.evaluate(() => { const svg = document.querySelector(".bv-svg"); if (!svg) return null; const r = svg.getBoundingClientRect(); let worst = 0; for (const c of svg.querySelectorAll("circle")) { const b = c.getBoundingClientRect(); worst = Math.max(worst, r.top - b.top, b.bottom - r.bottom, r.left - b.left, b.right - r.right); } return Math.round(worst); });
        check(clip0 === null || clip0 <= 2, `${label}: ${id} atoms fit inside the canvas when loaded (worst overflow ${clip0}px)`);
        await p.locator(T("tool-bring")).click().catch(() => {}); await sleep(1800);
        const clip = await p.evaluate(() => { const svg = document.querySelector(".bv-svg"); if (!svg) return null; const r = svg.getBoundingClientRect(); let worst = 0; for (const c of svg.querySelectorAll("circle")) { const b = c.getBoundingClientRect(); worst = Math.max(worst, r.top - b.top, b.bottom - r.bottom, r.left - b.left, b.right - r.right); } return Math.round(worst); });
        check(clip === null || clip <= 2, `${label}: ${id} atoms fit inside the canvas before bonding (worst overflow ${clip}px)`);
        const btn = p.locator(T("tool-form-bond")); if (await btn.isEnabled().catch(() => false)) { await btn.click(); await sleep(7000); }
        await shot(S, `bonding-covalent-${id}`);
        const info = await p.locator(T("bv-explain")).innerText().catch(() => "");
        check(info.length > 10, `${label}: ${id} has an explanation line`);
      }
      const pol = await p.locator('[data-testid="polarity-panel"]').count(); check(pol === 1, `${label}: polarity panel shown for a finished molecule`);
      const st = p.locator(T("structure")); const f = await st.getAttribute("data-renderer"); check(f === "webgl", `${label}: structure rendered with WebGL`);
      await st.focus(); await p.keyboard.press("ArrowRight"); await sleep(200);
      check(await p.locator(`${T("structure")} [data-testid="stage-keyhint"]`).count() === 1, `${label}: keyboard help present on the molecule stage`);
    }
    errorsCheck(S, label); await S.ctx.close();
  }
  // metallic mode
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    const label = `bonding metallic ${w}x${h}`; const S = await open(URL, { w, h, touch: w < 600 }); const p = S.page;
    await p.locator(T("tab-metallic")).click(); await sleep(900); await health(S, label, T("bonding-workspace"));
    check(await p.locator(T("metallic-stage")).count() === 1, `${label}: stage present`);
    await p.locator(T("el-Na")).click(); await p.locator(T("el-Na")).click(); await sleep(400);
    check(await p.locator(T("tool-release")).isEnabled(), `${label}: release enabled after two atoms`);
    await p.locator(T("tool-release")).click(); await sleep(5500); await p.locator(T("tool-form-lattice")).click(); await sleep(6500);
    await shot(S, `bonding-metallic-${w}`);
    await p.locator(T("metallic-stage")).focus(); await p.keyboard.press("ArrowLeft"); await p.keyboard.press("-"); await sleep(300);
    // context loss
    if (w === 1366) {
      await p.evaluate(() => { const c = document.querySelector('[data-testid="metallic-stage"] canvas'); const gl = c.getContext("webgl2") || c.getContext("webgl"); window.__lose = gl.getExtension("WEBGL_lose_context"); window.__lose.loseContext(); });
      await sleep(600); check(await p.locator(T("webgl-context-lost")).count() === 1, `${label}: context-lost notice shown`);
      await p.evaluate(() => window.__lose.restoreContext()); await sleep(1800);
      check(await p.locator(T("webgl-context-lost")).count() === 0 && await p.locator(`${T("metallic-stage")} canvas`).count() === 1, `${label}: canvas restored`);
    }
    errorsCheck(S, label); await S.ctx.close();
  }
  // no WebGL: metallic controls disabled with a visible reason
  const N = await open(URL, { w: 1366, h: 768, nowebgl: true }); const p = N.page; await p.locator(T("tab-metallic")).click(); await sleep(700);
  check(await p.locator(T("tool-release")).isDisabled() && await p.locator(T("tool-form-lattice")).isDisabled(), "bonding no-webgl: metallic controls disabled");
  check(/3D view unavailable on this device/.test(await p.locator(T("bv-explain")).innerText()), "bonding no-webgl: reason shown in the explanation line");
  check(await p.locator(T("webgl-fallback")).count() >= 1, "bonding no-webgl: fallback notice shown"); await shot(N, "bonding-metallic-nowebgl");
  await p.locator(T("tab-covalent")).click(); await sleep(500); check(await p.locator(T("webgl-fallback")).count() === 0, "bonding no-webgl: covalent mode still works (2D)");
  errorsCheck(N, "bonding no-webgl"); await N.ctx.close();
}
