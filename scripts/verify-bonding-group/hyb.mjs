// Hybridisation Explorer: 3 sizes x light/dark, stage-first on phone, IB toggle, new molecules, keyboard, context loss, no-WebGL.
export default async function ({ open, health, check, sleep, T, shot, SIZES, errorsCheck }) {
  const URL = "/simulation/hybridisation-explorer";
  for (const [w, h] of SIZES) for (const scheme of ["light", "dark"]) {
    const label = `hyb ${w}x${h} ${scheme}`; console.log(" ", label);
    const S = await open(URL, { w, h, scheme, touch: w < 600 }); const p = S.page;
    await health(S, `${label} lab`, T("hybridisation-workspace"));
    if (w < 600) {
      const o = await p.evaluate(() => ({ s: document.querySelector('[data-testid="hy-stage"]').getBoundingClientRect().top, l: document.querySelector('[data-testid="hybridisation-left"]').getBoundingClientRect().top }));
      check(o.s < o.l, `${label}: stage before controls (${Math.round(o.s)} < ${Math.round(o.l)})`);
    }
    check(await p.locator(T("opt-beyond-ib")).isChecked() === false, `${label}: beyond-IB switch off by default`);
    await p.locator(T("tab-molecules")).click(); await sleep(900); await health(S, `${label} molecules`, T("hybridisation-workspace"));
    if (w === 1366 && scheme === "light") {
      for (const id of ["BeCl2", "BF3", "HCN", "C2H5OH", "C2H4", "C6H6"]) {
        await p.selectOption(T("select-molecule"), id); await sleep(500);
        for (let i = 0; i < 8; i += 1) { const nx = p.locator(T("btn-next")); if (await nx.isDisabled()) break; await nx.click(); await sleep(450); }
        await sleep(1800); await shot(S, `hyb-${id}-final`);
      }
      await p.locator(T("hy-stage")).focus(); const c0 = await p.evaluate(() => document.querySelector('[data-testid="hy-stage"]').__hy.api().cameraPosition?.() ?? null);
      await p.keyboard.press("ArrowRight"); await sleep(300);
      const c1 = await p.evaluate(() => document.querySelector('[data-testid="hy-stage"]').__hy.api().cameraPosition?.() ?? null);
      check(!c0 || Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 0.1, `${label}: arrow key orbits the camera`);
      check(await p.locator(`${T("hy-stage")} [data-testid="stage-keyhint"]`).count() === 1, `${label}: key help present`);
      await p.evaluate(() => { const c = document.querySelector('[data-testid="hy-stage"] canvas'); const gl = c.getContext("webgl2") || c.getContext("webgl"); window.__lose = gl.getExtension("WEBGL_lose_context"); window.__lose.loseContext(); });
      await sleep(600); check(await p.locator(T("webgl-context-lost")).count() === 1, `${label}: context-lost notice shown`);
      await p.evaluate(() => window.__lose.restoreContext()); await sleep(2000);
      check(await p.locator(T("webgl-context-lost")).count() === 0 && await p.locator(`${T("hy-stage")} canvas`).count() === 1, `${label}: canvas restored`);
    }
    errorsCheck(S, label); await S.ctx.close();
  }
  const N = await open(URL, { w: 1366, h: 768, nowebgl: true }); check(await N.page.locator(T("webgl-fallback")).count() >= 1, "hyb no-webgl: fallback shown"); errorsCheck(N, "hyb no-webgl"); await N.ctx.close();
}
