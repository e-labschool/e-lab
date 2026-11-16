// VSEPR Explorer: layout at 3 sizes x light/dark, molecule list visible, keyboard camera, context loss, no-WebGL, challenge round.
export default async function ({ open, health, check, sleep, T, shot, SIZES, errorsCheck }) {
  const URL = "/simulation/vsepr-explorer-3d";
  for (const [w, h] of SIZES) for (const scheme of ["light", "dark"]) {
    const label = `vsepr ${w}x${h} ${scheme}`; console.log(" ", label);
    const S = await open(URL, { w, h, scheme, touch: w < 600 });
    const p = S.page;
    await health(S, `${label} build`, T("vsepr-workspace"));
    await p.locator(T("tab-molecules")).click(); await sleep(900);
    const list = await p.evaluate(() => { const l = document.querySelector(".vx-lib-scroll"); const r = l?.getBoundingClientRect(); const first = document.querySelector('[data-testid="mol-h2o"]')?.getBoundingClientRect(); return { h: r?.height ?? 0, firstH: first?.height ?? 0 }; });
    check(list.h > 100 && list.firstH > 10, `${label}: molecule list has a real height (${Math.round(list.h)}px)`);
    await health(S, `${label} molecules`, T("vsepr-workspace"));
    if (w < 600) { const top = await p.evaluate(() => { const st = document.querySelector('[data-testid="vsepr-stage"]').getBoundingClientRect(); const lib = document.querySelector(".vx-library").getBoundingClientRect(); return { st: st.top, lib: lib.top }; }); check(top.st < top.lib, `${label}: 3D stage is above the controls on phones (stage ${Math.round(top.st)} < list ${Math.round(top.lib)})`); }
    if (w === 1366 && scheme === "light") {
      for (const id of ["sf4", "brf5", "ch4", "co32m", "h2s"]) { await p.locator(T(`mol-${id}`)).click(); await sleep(1100); await shot(S, `vsepr-${id}`); }
      // overlapping angle labels (SF4, BrF5)
      for (const id of ["sf4", "brf5"]) {
        await p.locator(T(`mol-${id}`)).click(); await sleep(1400);
        const ov = await p.evaluate(() => { const els = [...document.querySelectorAll(".vx-angle-label")].filter((e) => e.dataset.on === "1").map((e) => e.getBoundingClientRect()); let o = 0; for (let i = 0; i < els.length; i += 1) for (let j = i + 1; j < els.length; j += 1) { const a = els[i], b = els[j]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) o += 1; } return { n: els.length, o }; });
        check(ov.n >= 1 && ov.o === 0, `${label}: ${id} angle labels do not overlap (${ov.n} labels, ${ov.o} overlaps)`);
      }
      // keyboard orbit / zoom
      await p.locator(T("mol-ch4")).click(); await sleep(800);
      const cam0 = await p.evaluate(() => document.querySelector('[data-testid="vsepr-stage"]').__vsepr.api().cameraPosition());
      await p.locator(T("vsepr-stage")).focus(); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await sleep(300);
      const cam1 = await p.evaluate(() => document.querySelector('[data-testid="vsepr-stage"]').__vsepr.api().cameraPosition());
      check(Math.hypot(cam1[0] - cam0[0], cam1[2] - cam0[2]) > 0.3, `${label}: arrow keys orbit the camera`);
      const d0 = Math.hypot(...cam1); await p.keyboard.press("+"); await sleep(200); const d1 = Math.hypot(...(await p.evaluate(() => document.querySelector('[data-testid="vsepr-stage"]').__vsepr.api().cameraPosition())));
      check(d1 < d0 - 0.05, `${label}: + zooms in (${d0.toFixed(2)} -> ${d1.toFixed(2)})`);
      const hint = await p.evaluate(() => { const e = document.querySelector('[data-testid="stage-keyhint"]'); return e ? getComputedStyle(e).opacity : "none"; });
      check(hint === "1", `${label}: keyboard instructions visible while the stage has focus (opacity ${hint})`);
      await shot(S, "vsepr-keyboard-focus");
      // context lost / restored through the shared hook
      await p.evaluate(() => { const c = document.querySelector('[data-testid="vsepr-stage"] canvas'); const gl = c.getContext("webgl2") || c.getContext("webgl"); window.__lose = gl.getExtension("WEBGL_lose_context"); window.__lose?.loseContext(); });
      await sleep(600); check(await p.locator(T("webgl-context-lost")).count() === 1, `${label}: context-lost notice shown`);
      await p.evaluate(() => window.__lose?.restoreContext()); await sleep(1800);
      check(await p.locator(T("webgl-context-lost")).count() === 0 && await p.locator(`${T("vsepr-stage")} canvas`).count() === 1, `${label}: canvas restored after context restore`);
      // challenge round
      await p.locator(T("tab-challenge")).click(); await sleep(400); await shot(S, "vsepr-challenge-start");
      check(await p.locator(T("ch-start")).count() === 1, `${label}: challenge start screen`);
    }
    errorsCheck(S, label); await S.ctx.close();
  }
  // no WebGL: clear fallback, the 3D hint is hidden
  const S = await open(URL, { w: 1366, h: 768, nowebgl: true }); await S.page.locator(T("tab-molecules")).click(); await sleep(600);
  check(await S.page.locator(T("webgl-fallback")).count() >= 1, "vsepr no-webgl: fallback message shown");
  check(await S.page.locator(".vx-viewer-hint").evaluate((e) => getComputedStyle(e).display === "none").catch(() => true), "vsepr no-webgl: 3D drag hint is hidden");
  await shot(S, "vsepr-nowebgl"); errorsCheck(S, "vsepr no-webgl"); await S.ctx.close();
  // reduced motion: auto-rotate disabled
  const R = await open(URL, { w: 1366, h: 768, reduced: true }); check(await R.page.locator(T("vt-rotate")).isDisabled(), "vsepr reduced-motion: auto-rotate toggle disabled"); await R.ctx.close();
}
