// Bonding Visualizer: 3 sizes x light/dark, stage-first on phone, metallic mode, context loss, no-WebGL fallback. Covalent round 2: bonding2.mjs.
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
    // (the covalent recognition / formation / 3D checks live in bonding2.mjs: the old example tabs no longer exist)
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
