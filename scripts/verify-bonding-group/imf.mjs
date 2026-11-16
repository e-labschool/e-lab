// Intermolecular Forces: 3 sizes x light/dark, first view shows an interaction, ranking tab, heating view readable, keyboard, context loss, no-WebGL.
export default async function ({ open, health, check, sleep, T, shot, SIZES, errorsCheck }) {
  const URL = "/simulation/intermolecular-forces-visualiser";
  for (const [w, h] of SIZES) for (const scheme of ["light", "dark"]) {
    const label = `imf ${w}x${h} ${scheme}`; console.log(" ", label);
    const S = await open(URL, { w, h, scheme, touch: w < 600 }); const p = S.page;
    await health(S, `${label} explore`, T("imf-workspace"));
    if (w < 600) {
      const o = await p.evaluate(() => ({ s: document.querySelector('[data-testid="explore-chamber"]').getBoundingClientRect().top, t: document.querySelector('[data-testid="tray-panel"]').getBoundingClientRect().top }));
      check(o.s < o.t, `${label}: stage before the molecule tray (${Math.round(o.s)} < ${Math.round(o.t)})`);
    }
    await p.locator(T("tab-rank")).click(); await sleep(500); await health(S, `${label} rank`, T("imf-workspace"));
    check(await p.locator(T("rank-task")).count() === 1, `${label}: ranking task shown`);
    if (w === 1366 && scheme === "light") {
      await p.locator(T("rankset-alkanes")).click(); await sleep(400); await shot(S, "imf-rank-predict");
      await p.locator(T("rank-check")).click(); await sleep(500); await shot(S, "imf-rank-revealed");
      const rv = await p.evaluate(() => { const r = document.querySelector('[data-testid="rank-task"]').getBoundingClientRect(); const items = [...document.querySelectorAll(".imf-rank-item")].map((e) => e.scrollWidth - e.clientWidth); return { w: r.width, over: Math.max(0, ...items) }; });
      check(rv.over <= 1, `${label}: ranking rows do not overflow horizontally`);
      await p.locator(T("alk-slider")).fill("6"); await sleep(300); await shot(S, "imf-alkane-series");
    }
    await p.locator(T("tab-explore")).click(); await sleep(500);
    if (w === 1366 && scheme === "light") {
      await p.locator(T("tray-HCl")).click().catch(() => {}); await p.locator(T("tray-HCl")).click().catch(() => {}); await sleep(900);
      const live = await p.locator(T("live-interaction")).innerText().catch(() => "");
      check(/attractive|repulsive/.test(live), `${label}: first view with two molecules shows an interaction ("${live.replace(/\s+/g, " ")}")`);
      await shot(S, "imf-explore-start");
      await p.locator(T("imf-stage")).focus(); await p.keyboard.press("Escape"); await p.keyboard.press("ArrowRight"); await sleep(300);
      check(await p.locator(`${T("imf-stage")} canvas`).count() === 1, `${label}: stage still renders after keyboard orbit`);
      await p.evaluate(() => { const c = document.querySelector('[data-testid="imf-stage"] canvas'); const gl = c.getContext("webgl2") || c.getContext("webgl"); window.__lose = gl.getExtension("WEBGL_lose_context"); window.__lose.loseContext(); });
      await sleep(600); check(await p.locator(T("webgl-context-lost")).count() === 1, `${label}: context-lost notice shown`);
      await p.evaluate(() => window.__lose.restoreContext()); await sleep(2000);
      check(await p.locator(T("webgl-context-lost")).count() === 0 && await p.locator(`${T("imf-stage")} canvas`).count() === 1, `${label}: canvas restored`);
    }
    await p.locator(T("btn-heat-view")).click().catch(() => {}); await sleep(1200); await shot(S, `imf-heat-${w}-${scheme}`);
    await health(S, `${label} heat`, T("imf-workspace"));
    errorsCheck(S, label); await S.ctx.close();
  }
  const N = await open(URL, { w: 1366, h: 768, nowebgl: true }); check(await N.page.locator(T("webgl-fallback")).count() >= 1, "imf no-webgl: fallback shown"); errorsCheck(N, "imf no-webgl"); await N.ctx.close();
}
