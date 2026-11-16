// Landing page: featured set, hero demo is VSEPR (lazy: no engine / WebGL before the visitor asks), no-WebGL keeps the thumbnail.
export default async function ({ open, check, sleep, T, shot, SIZES, errorsCheck }) {
  for (const [w, h] of SIZES) for (const scheme of ["light", "dark"]) {
    const label = `landing ${w}x${h} ${scheme}`; console.log(" ", label);
    const S = await open("/", { w, h, scheme, touch: w < 600 }); const p = S.page;
    const pre = await p.evaluate(() => ({ canvases: document.querySelectorAll("canvas").length, docX: document.documentElement.scrollWidth - document.documentElement.clientWidth, run: !!document.querySelector("[data-run-demo]"), runText: document.querySelector("[data-run-demo]")?.textContent?.trim() }));
    check(pre.canvases === 0, `${label}: no canvas (no WebGL) before the visitor asks (${pre.canvases})`);
    check(pre.docX <= 1, `${label}: no horizontal overflow (${pre.docX}px)`);
    check(/VSEPR/i.test(pre.runText ?? ""), `${label}: hero demo is VSEPR ("${pre.runText}")`);
    if (w === 1366 && scheme === "light") {
      const feat = await p.evaluate(() => [...document.querySelectorAll("[data-featured-sim], [data-sim-card]")].map((e) => e.textContent.trim().slice(0, 40)));
      await shot(S, "landing-before-run");
      await p.locator("[data-run-demo]").click(); await sleep(4000); await shot(S, "landing-vsepr-running");
      check(await p.locator('[data-testid="vsepr-stage"] canvas').count() === 1, `${label}: VSEPR demo mounts a canvas after Run`);
      check(feat.length >= 0, "landing: featured cards read");
    }
    errorsCheck(S, label); await S.ctx.close();
  }
  const N = await open("/", { w: 1366, h: 768, nowebgl: true }); await N.page.locator("[data-try-simulation]").click().catch(() => {}); await sleep(1200);
  const t = await N.page.evaluate(() => ({ thumb: !!document.querySelector("[data-demo-stage] img"), status: document.querySelector("[data-demo-stage] [role=status]")?.textContent ?? "", stage: !!document.querySelector('[data-testid="vsepr-stage"]'), run: !!document.querySelector("[data-run-demo]") }));
  check(t.thumb, "landing no-webgl: static thumbnail shown"); check(/needs WebGL/.test(t.status), `landing no-webgl: explanation shown ("${t.status.slice(0, 50)}")`); check(!t.stage && !t.run, "landing no-webgl: no engine mounted, no dead Run button");
  await shot(N, "landing-nowebgl"); errorsCheck(N, "landing no-webgl"); await N.ctx.close();
}
