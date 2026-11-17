import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialInteraction, interactionReducer } from "../../engine/interaction.js";
import { findPacket, pourPacket } from "../../engine/packetOps.js";

/**
 * Stages 4, 5 and 6: the Phase-1 packet interaction (select / open / split / combine / drag / pour) with ONE extra kind of
 * destination, the apparatus (gas chamber or reaction zone).  Dropping a packet on the apparatus, or pressing the Pour / Release
 * button, commits ONE generic `packet/pour` into the vessel at the tilting -> pouring transition (guarded by the state machine, so a
 * repeated click or an interrupted animation cannot move material twice).  The drawing only reads the store.
 *   `gate(srcPacket)` returns "" or a reason the pour is not allowed yet (e.g. the prediction has not been answered).
 */
export default function useZoneInteraction({ getState, dispatch, stage, vesselId, reduced, gate, resetKey = 0 }) {
  const bench = useRef({ nodes: new Map(), drag: null, pour: null });
  const [machine, setMachine] = useState(initialInteraction);
  const machineRef = useRef(machine);
  const [selectedId, setSelectedId] = useState(null);
  const [placement, setPlacement] = useState({});
  const [message, setMessage] = useState({ text: "", tone: "info", nonce: 0 });
  const stageRef = useRef(stage); stageRef.current = stage;
  const selRef = useRef(selectedId); selRef.current = selectedId;
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const gateRef = useRef(gate); gateRef.current = gate;
  const isZone = (id) => typeof id === "string" && (id === vesselId || id.startsWith(`${vesselId}#`));

  const send = useCallback((e) => { const next = interactionReducer(machineRef.current, e); if (next !== machineRef.current) { machineRef.current = next; setMachine(next); } return next; }, []);
  const say = useCallback((text, tone = "info") => setMessage((m) => ({ text, tone, nonce: m.nonce + 1 })), []);
  const scene = useCallback(() => getState().scenes[stageRef.current], [getState]);
  const act = useCallback((a) => dispatch({ ...a, stage: stageRef.current }), [dispatch]);

  const targetValidity = useCallback((src, dst) => {
    const sc = scene(); const s = findPacket(sc, src);
    if (!s) return { valid: false, reason: "That is not a packet." };
    if (s.q <= 0) return { valid: false, reason: "That packet is empty." };
    if (isZone(dst)) {
      const g = gateRef.current?.(s); if (g) return { valid: false, reason: g };
      const v = sc.vessels.find((x) => x.id === vesselId);
      if (!v || !v.accepts.includes(s.substanceId)) return { valid: false, reason: "That substance does not go in here." };
      const r = pourPacket(sc, src, vesselId); if (!r.notice.ok && r.notice.code !== "closed") return { valid: false, reason: r.notice.message };
      return { valid: true, reason: "" };
    }
    const d = findPacket(sc, dst);
    if (!d) return { valid: false, reason: "Drop the packet on the apparatus." };
    if (src === dst) return { valid: false, reason: "Choose a different packet." };
    if (s.substanceId !== d.substanceId) return { valid: false, reason: "Different substances cannot be poured together." };
    if (d.q >= 1e9) return { valid: false, reason: "That packet is full: one mole is the most a packet holds." };
    return { valid: true, reason: "" };
  }, [scene, vesselId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = useCallback((why) => { bench.current.drag = null; bench.current.pour = null; send({ type: "cancel" }); if (why) say(why, "info"); }, [send, say]);
  const select = useCallback((id) => { if (bench.current.pour) return; setSelectedId(id); send({ type: "cancel" }); if (id) send({ type: "select", id }); }, [send]);
  const toggleOpen = useCallback((id) => {
    if (bench.current.pour) return; const p = findPacket(scene(), id); if (!p) return;
    const res = act({ type: p.open ? "packet/close" : "packet/open", id }); say(res.last.message, res.last.ok ? "ok" : "warn"); send({ type: p.open ? "closed" : "opened" });
  }, [act, scene, say, send]);
  const split = useCallback((id) => { if (bench.current.pour) return; const res = act({ type: "packet/split", id }); say(res.last.message, res.last.ok ? "ok" : "warn"); if (res.last.ok && res.last.newId) setSelectedId(res.last.newId); }, [act, say]);
  const combine = useCallback((id) => {
    if (bench.current.pour) return; const sc = scene(); const a = findPacket(sc, id); if (!a) return;
    const others = sc.packets.filter((p) => p.id !== id && p.substanceId === a.substanceId && p.role === a.role && p.q > 0);
    if (!others.length) { say("There is no other packet of this substance to combine with.", "warn"); return; }
    const res = a.q < 1e9 ? act({ type: "packet/combine", aId: id, bId: others[0].id }) : act({ type: "packet/compact", substanceId: a.substanceId });
    say(res.last.message, res.last.ok ? "ok" : "warn");
  }, [act, scene, say]);
  const finishPour = useCallback(() => { send({ type: "commitDone" }); send({ type: "settle" }); }, [send]);

  /** Pour packet `src` into the apparatus (drag-drop or the Release / Add button). */
  const pour = useCallback((src) => {
    if (bench.current.pour) return false;
    const sc = scene(); const s = findPacket(sc, src);
    if (!s) { cancel("Choose a packet on the bench."); return false; }
    if (!s.open) { cancel("The packet is closed: open the zipper before pouring."); return false; }
    const v = targetValidity(src, vesselId); if (!v.valid) { cancel(v.reason); return false; }
    setSelectedId(src); send({ type: "cancel" }); send({ type: "select", id: src }); send({ type: "target", id: vesselId, valid: true, isOpen: true }); send({ type: "tilt" });
    const sn = bench.current.nodes.get(src); const dn = bench.current.nodes.get(vesselId);
    if (reducedRef.current || !sn || !dn) {
      send({ type: "commit" }); const r = act({ type: "packet/pour", sourceId: src, destId: vesselId }); say(r.last.message, r.last.ok ? "ok" : "warn"); finishPour(); return r.last.ok;
    }
    bench.current.pour = { src, dst: vesselId, phase: "in", t: 0, dir: dn.disp.x >= sn.disp.x ? 1 : -1, duration: 1.0, movedFraction: 0 };
    return true;
  }, [act, cancel, finishPour, say, scene, send, targetValidity, vesselId]);

  const onCommit = useCallback((p) => {
    const before = machineRef.current; const next = send({ type: "commit" }); if (next === before) return 0;
    const sc = scene(); const dry = pourPacket(sc, p.src, p.dst); const r = act({ type: "packet/pour", sourceId: p.src, destId: p.dst });
    say(r.last.message, r.last.ok ? "ok" : "warn");
    return dry.notice.ok ? (dry.notice.movedQ ?? 0) / 1e9 : 0;
  }, [act, say, scene, send]);

  const handlers = useMemo(() => ({
    onPress: (id) => { setSelectedId(id); const ph = machineRef.current.phase; if (ph === "idle" || ph === "selected" || ph === "transferComplete") { send({ type: "cancel" }); send({ type: "select", id }); } },
    onClick: (id) => { send({ type: "select", id }); setSelectedId(id); },
    onDragStart: (id) => { send({ type: "select", id }); send({ type: "dragStart" }); },
    onDragOver: (id, targetId) => { if (!targetId) { send({ type: "dragOver", targetId: null, valid: false }); return { valid: false }; } const v = targetValidity(id, targetId); send({ type: "dragOver", targetId: isZone(targetId) ? vesselId : targetId, valid: v.valid }); return v; },
    onDrop: (id, targetId, at) => {
      if (targetId) {
        const v = targetValidity(id, targetId); const p = findPacket(scene(), id);
        if (v.valid) {
          if (!p.open) { send({ type: "drop", isOpen: false }); cancel("The packet is closed: open the zipper, then drop it on the apparatus (or press the Add button)."); return; }
          send({ type: "drop", isOpen: true });
          if (isZone(targetId)) pour(id); else { const d = findPacket(scene(), targetId); if (d && !d.open) act({ type: "packet/open", id: targetId }); const r = act({ type: "packet/pour", sourceId: id, destId: targetId }); say(r.last.message, r.last.ok ? "ok" : "warn"); finishPour(); }
          return;
        }
        send({ type: "drop" }); cancel(v.reason); return;
      }
      send({ type: "drop", hint: "" }); setPlacement((pl) => ({ ...pl, [id]: at })); say("Packet placed on the bench.", "ok");
    },
    onDropFailed: (id, why) => { send({ type: "drop" }); cancel(why); },
  }), [act, cancel, finishPour, pour, say, scene, send, targetValidity, vesselId]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPositions = useCallback(() => { setPlacement({}); say("Packets returned to their places.", "ok"); }, [say]);
  const ids = scene().packets.map((p) => p.id).join(",");
  useEffect(() => {
    const have = new Set(ids.split(",")); setPlacement((pl) => { const k = Object.keys(pl).filter((x) => !have.has(x)); if (!k.length) return pl; const n = { ...pl }; for (const x of k) delete n[x]; return n; });
    if (selRef.current && !have.has(selRef.current)) setSelectedId(null);
  }, [ids]);
  useEffect(() => { cancel(); setPlacement({}); setSelectedId(null); }, [stage, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { bench.current.pour = null; bench.current.drag = null; }, []);

  return { bench, machine, selectedId, placement, message, select, toggleOpen, split, combine, pour, cancel, onCommit, finishPour, handlers, resetPositions, targetValidity, say };
}
