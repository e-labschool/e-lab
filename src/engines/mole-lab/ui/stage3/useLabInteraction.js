import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialInteraction, interactionReducer } from "../../engine/interaction.js";
import { findPacket } from "../../engine/packetOps.js";
import { beakerId } from "../../engine/stage3.js";

/**
 * Stage 3 interaction: the SAME pure state machine as Stages 1 and 2 (engine/interaction.js), wired to the Concentration Lab.
 * Packet -> beaker pours go through ONE store action ("s3/pour") issued at the tilting -> pouring transition; every other
 * apparatus action (measure, pour water, stir, transfer, fill to mark, aliquot ...) is ONE store action too.  The 3D scene only
 * READS the store: an interrupted or skipped animation cannot change an amount.
 *
 * Mouse, touch and keyboard all use these functions (the buttons call them directly; the pointer handlers call them via PointerController).
 */
const FLOW_IN = 0.55; const FLOW_OUT = 0.5;

export default function useLabInteraction({ getState, dispatch, reduced, animate = true, resetKey = 0 }) {
  const bench = useRef({ nodes: new Map(), drag: null, pour: null, flow: null, stir: null });
  const [machine, setMachine] = useState(initialInteraction);
  const machineRef = useRef(machine);
  const [selectedId, setSelectedId] = useState(null);
  const [placement, setPlacement] = useState({});
  const [message, setMessage] = useState({ text: "", tone: "info", nonce: 0 });
  const [busy, setBusy] = useState(false);
  const reducedRef = useRef(reduced); reducedRef.current = reduced || !animate;
  const timers = useRef(new Set());

  const send = useCallback((e) => { const next = interactionReducer(machineRef.current, e); if (next !== machineRef.current) { machineRef.current = next; setMachine(next); } return next; }, []);
  const say = useCallback((text, tone = "info") => setMessage((m) => ({ text, tone, nonce: m.nonce + 1 })), []);
  const scene = useCallback(() => getState().scenes[3], [getState]);
  const act = useCallback((a) => dispatch({ ...a, stage: 3 }), [dispatch]);
  const station = useCallback((x = "A") => scene().data.stations[x], [scene]);

  const clearBusy = useCallback(() => { setBusy(false); }, []);
  /** Run a display-only animation guard: busy until the 3D layer reports done (or a safety timer fires, e.g. WebGL lost). */
  const guard = useCallback((ms) => { setBusy(true); const id = setTimeout(() => { timers.current.delete(id); const b = bench.current; if (b.flow || b.stir || b.pour) { b.flow = null; b.stir = null; } clearBusy(); }, ms + 1200); timers.current.add(id); }, [clearBusy]);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); timers.current.clear(); }, []);

  const cancel = useCallback((why) => { bench.current.drag = null; bench.current.pour = null; bench.current.flow = null; bench.current.stir = null; setBusy(false); send({ type: "cancel" }); if (why) say(why, "info"); }, [send, say]);
  const select = useCallback((id) => { if (bench.current.pour || bench.current.flow) return; setSelectedId(id); send({ type: "cancel" }); if (id) send({ type: "select", id }); }, [send]);
  const isBusy = () => Boolean(bench.current.pour || bench.current.flow || bench.current.stir);

  const startFlow = useCallback((f) => {
    if (reducedRef.current || isBusy()) return;
    const dur = FLOW_IN + (f.dur ?? 1.1) + FLOW_OUT; bench.current.flow = { ...f, phase: "in", t: 0, dur: f.dur ?? 1.1 }; guard(dur * 1000);
  }, [guard]);
  const flowDone = useCallback(() => { clearBusy(); }, [clearBusy]);
  const startStir = useCallback(() => { if (reducedRef.current || isBusy()) return; bench.current.stir = { t: 0, dur: 2.6 }; guard(2600); }, [guard]);
  const stirDone = useCallback(() => { clearBusy(); }, [clearBusy]);

  const report = (r) => { say(r.last.message, r.last.ok ? "ok" : "warn"); return r.last.ok; };

  // ---- apparatus actions (each = one store action; the animation is decoration) -----------------
  const measureWater = useCallback((ml) => { if (isBusy()) return false; const ok = report(act({ type: "s3/measureWater", station: "A", value: ml })); if (ok) startFlow({ kind: "water", from: "tap", to: "cylinder" }); return ok; }, [act, startFlow]); // eslint-disable-line react-hooks/exhaustive-deps
  const pourWater = useCallback(() => { if (isBusy()) return false; const ok = report(act({ type: "s3/pourWater", station: "A" })); if (ok) startFlow({ kind: "water", from: "cylinder", to: "beakerA" }); return ok; }, [act, startFlow]); // eslint-disable-line react-hooks/exhaustive-deps
  const stir = useCallback(() => { if (isBusy()) return false; const ok = report(act({ type: "s3/stir", station: "A" })); if (ok) startStir(); return ok; }, [act, scene, startStir]); // eslint-disable-line react-hooks/exhaustive-deps
  const transfer = useCallback(() => { if (isBusy()) return false; const ok = report(act({ type: "s3/transfer", station: "A" })); if (ok) startFlow({ kind: "water", from: "beakerA", to: "flaskA", dur: 1.5 }); return ok; }, [act, startFlow]); // eslint-disable-line react-hooks/exhaustive-deps
  const fillToMark = useCallback((x = "A") => { if (isBusy()) return false; const ok = report(act({ type: "s3/fillToMark", station: x })); if (ok) startFlow({ kind: "water", from: "wash", to: `flask${x}`, dur: 1.2 }); return ok; }, [act, startFlow]); // eslint-disable-line react-hooks/exhaustive-deps
  const topUp = useCallback((ml) => { if (isBusy()) return false; const ok = report(act({ type: "s3/topUp", station: "A", value: ml })); if (ok) startFlow({ kind: "water", from: "wash", to: "flaskA", dur: 0.9 }); return ok; }, [act, startFlow]); // eslint-disable-line react-hooks/exhaustive-deps
  const takeAliquot = useCallback(() => { if (isBusy()) return false; const ok = report(act({ type: "s3/takeAliquot" })); if (ok) startFlow({ kind: "water", from: "stock", to: "cylinder" }); return ok; }, [act, startFlow]); // eslint-disable-line react-hooks/exhaustive-deps
  const transferAliquot = useCallback(() => { if (isBusy()) return false; const ok = report(act({ type: "s3/transferAliquot" })); if (ok) startFlow({ kind: "water", from: "cylinder", to: "flaskA" }); return ok; }, [act, startFlow]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOpen = useCallback((x = "A") => {
    if (isBusy()) return; const st = station(x); const p = findPacket(scene(), st.packetId); if (!p) return;
    const res = act({ type: p.open ? "packet/close" : "packet/open", id: p.id }); report(res);
    send({ type: p.open ? "closed" : "opened" });
  }, [act, scene, send, station]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Why the packet cannot be poured into the beaker right now ("" if it can). */
  const pourBlock = useCallback((x = "A") => {
    const sc = scene(); const st = sc.data.stations[x]; const p = findPacket(sc, st.packetId);
    if (!p) return "The packet is not on the bench.";
    if (p.q <= 0) return "The packet is empty.";
    if (st.atMark) return "This solution is already made up.";
    if (!p.open) return "Open the zipper first: a closed packet cannot pour.";
    if (st.waterMl <= 0) return "Add water to the beaker first: the solid falls into water.";
    return "";
  }, [scene]);

  const finishPour = useCallback(() => { send({ type: "commitDone" }); send({ type: "settle" }); clearBusy(); }, [send, clearBusy]);

  /** Pour the open packet into the beaker (drag-drop or the Pour button). */
  const pourSolid = useCallback((x = "A") => {
    if (isBusy()) return false;
    const why = pourBlock(x); const sc = scene(); const st = sc.data.stations[x]; const p = findPacket(sc, st.packetId);
    if (why) { cancel(why); return false; }
    setSelectedId(p.id); send({ type: "cancel" }); send({ type: "select", id: p.id }); send({ type: "target", id: beakerId(x), valid: true, isOpen: true }); send({ type: "tilt" });
    const sn = bench.current.nodes.get(p.id); const dn = bench.current.nodes.get(beakerId(x));
    if (reducedRef.current || !sn || !dn) { send({ type: "commit" }); const r = act({ type: "s3/pour", station: x }); say(r.last.message, r.last.ok ? "ok" : "warn"); send({ type: "commitDone" }); send({ type: "settle" }); return r.last.ok; }
    bench.current.pour = { src: p.id, dst: beakerId(x), phase: "in", t: 0, dir: dn.disp.x >= sn.disp.x ? 1 : -1, duration: 1.2, movedFraction: 0, station: x }; setBusy(true);
    return true;
  }, [act, cancel, pourBlock, say, scene, send]); // eslint-disable-line react-hooks/exhaustive-deps

  /** PourDirector callback: the ONE moment the chemistry changes for a solid pour. */
  const onCommit = useCallback((pr) => {
    const before = machineRef.current; const next = send({ type: "commit" }); if (next === before) return 0;
    const sc = scene(); const st = sc.data.stations[pr.station ?? "A"]; const p = findPacket(sc, st.packetId); const q0 = p?.q ?? 0;
    const r = act({ type: "s3/pour", station: pr.station ?? "A" }); say(r.last.message, r.last.ok ? "ok" : "warn");
    return r.last.ok ? q0 / 1e9 : 0;
  }, [act, say, scene, send]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetValidity = useCallback((src, dst) => {
    const sc = scene(); const x = dst === "beakerB" ? "B" : "A"; const st = sc.data.stations[x]; const p = findPacket(sc, src);
    if (!p || !st || p.id !== st.packetId) return { valid: false, reason: "That is not a place this packet can be poured." };
    if (!dst.startsWith("beaker")) return { valid: false, reason: "Drop the packet on the beaker." };
    if (p.q <= 0) return { valid: false, reason: "That packet is empty." };
    if (st.waterMl <= 0) return { valid: false, reason: "Add water to the beaker first: the solid falls into water." };
    return { valid: true, reason: "" };
  }, [scene]);

  const handlers = useMemo(() => ({
    onPress: (id) => { setSelectedId(id); const ph = machineRef.current.phase; if (ph === "idle" || ph === "selected" || ph === "transferComplete") { send({ type: "cancel" }); send({ type: "select", id }); } },
    onClick: (id) => { send({ type: "select", id }); setSelectedId(id); },
    onDragStart: (id) => { send({ type: "select", id }); send({ type: "dragStart" }); },
    onDragOver: (id, targetId) => { if (!targetId) { send({ type: "dragOver", targetId: null, valid: false }); return { valid: false }; } const v = targetValidity(id, targetId); send({ type: "dragOver", targetId, valid: v.valid }); return v; },
    onDrop: (id, targetId, at) => {
      if (targetId) {
        const v = targetValidity(id, targetId); const p = findPacket(scene(), id);
        if (v.valid) { if (!p.open) { send({ type: "drop", isOpen: false }); cancel("The packet is closed: open the zipper, then drop it on the beaker (or press Pour)."); return; } send({ type: "drop", isOpen: true }); pourSolid(targetId === "beakerB" ? "B" : "A"); return; }
        send({ type: "drop" }); cancel(v.reason); return;
      }
      send({ type: "drop", hint: "" }); setPlacement((pl) => ({ ...pl, [id]: at })); say("Packet placed on the bench.", "ok");
    },
    onDropFailed: (id, why) => { send({ type: "drop" }); cancel(why); },
  }), [cancel, pourSolid, say, scene, send, targetValidity]);

  const resetPositions = useCallback(() => { setPlacement({}); say("Packets returned to their places.", "ok"); }, [say]);
  const pid = scene().packets.map((p) => p.id).join(",");
  useEffect(() => { const have = new Set(pid.split(",")); setPlacement((pl) => { const k = Object.keys(pl).filter((x) => !have.has(x)); if (!k.length) return pl; const n = { ...pl }; for (const x of k) delete n[x]; return n; }); setSelectedId((s) => (s && !have.has(s) ? null : s)); }, [pid]);
  useEffect(() => { cancel(); setPlacement({}); setSelectedId(null); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { bench, machine, selectedId, placement, message, busy, say, select, cancel, toggleOpen, pourSolid, pourBlock, stir, measureWater, pourWater, transfer, fillToMark, topUp, takeAliquot, transferAliquot,
    onCommit, finishPour, flowDone, stirDone, handlers, resetPositions, targetValidity };
}
