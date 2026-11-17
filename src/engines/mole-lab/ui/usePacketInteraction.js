import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialInteraction, interactionReducer } from "../engine/interaction.js";
import { findPacket, pourPacket } from "../engine/packetOps.js";
import { PACKET_CAPACITY_Q } from "../engine/packets.js";

/**
 * Wires the pure interaction state machine (engine/interaction.js) to the store and to the 3D bench.  Mouse, touch and
 * keyboard / buttons all go through the SAME functions here:
 *   select / toggleOpen / split / combine / pour / cancel / resetPositions   (buttons)
 *   handlers.{onPress,onClick,onDragStart,onDragOver,onDrop,onDropFailed}     (pointer, via PointerController)
 *
 * Chemistry changes ONLY through `dispatch` (store actions); the machine, the bench ref and the animations never hold amounts.
 */
export default function usePacketInteraction({ getState, dispatch, stage, reduced, resetKey = 0 }) {
  const bench = useRef({ nodes: new Map(), drag: null, pour: null });
  const [machine, setMachine] = useState(initialInteraction);
  const machineRef = useRef(machine);
  const [selectedId, setSelectedId] = useState(null);
  const [placement, setPlacement] = useState({});
  const [message, setMessage] = useState({ text: "", tone: "info", nonce: 0 });
  const stageRef = useRef(stage); stageRef.current = stage;
  const selRef = useRef(selectedId); selRef.current = selectedId;
  const reducedRef = useRef(reduced); reducedRef.current = reduced;

  const send = useCallback((e) => { const next = interactionReducer(machineRef.current, e); if (next !== machineRef.current) { machineRef.current = next; setMachine(next); } return next; }, []);
  const say = useCallback((text, tone = "info") => setMessage((m) => ({ text, tone, nonce: m.nonce + 1 })), []);
  const scene = useCallback(() => getState().scenes[stageRef.current], [getState]);
  const act = useCallback((a) => dispatch({ ...a, stage: stageRef.current }), [dispatch]);

  /** Can `src` pour into `dst` at all (same substance, room)?  Open/closed is checked separately. */
  const targetValidity = useCallback((src, dst) => {
    const sc = scene(); const s = findPacket(sc, src); const d = findPacket(sc, dst);
    if (!s || !d) return { valid: false, reason: "That target is not a packet." };
    if (src === dst) return { valid: false, reason: "Choose a different packet." };
    if (s.substanceId !== d.substanceId) return { valid: false, reason: "Different substances cannot be poured together." };
    if (d.q >= PACKET_CAPACITY_Q) return { valid: false, reason: "That packet is full: one mole is the most a packet holds." };
    if (s.q <= 0) return { valid: false, reason: "That packet is empty." };
    return { valid: true, reason: "" };
  }, [scene]);

  const cancel = useCallback((why) => {
    bench.current.drag = null; bench.current.pour = null; send({ type: "cancel" }); if (why) say(why, "info");
  }, [send, say]);

  const select = useCallback((id) => { if (bench.current.pour) return; setSelectedId(id); send({ type: "cancel" }); if (id) send({ type: "select", id }); }, [send]);

  const toggleOpen = useCallback((id) => {
    if (bench.current.pour) return; const p = findPacket(scene(), id); if (!p) return;
    const res = act({ type: p.open ? "packet/close" : "packet/open", id }); say(res.last.message, res.last.ok ? "ok" : "warn");
    send({ type: p.open ? "closed" : "opened" });
  }, [act, scene, say, send]);

  const split = useCallback((id) => {
    if (bench.current.pour) return; const res = act({ type: "packet/split", id }); say(res.last.message, res.last.ok ? "ok" : "warn");
    if (res.last.ok && res.last.newId) setSelectedId(res.last.newId);
  }, [act, say]);

  /** Combine `id` with the next compatible packet that has room (or, if `id` is full, pour that packet's contents into others). */
  const combine = useCallback((id) => {
    if (bench.current.pour) return; const sc = scene(); const a = findPacket(sc, id); if (!a) return;
    const others = sc.packets.filter((p) => p.id !== id && p.substanceId === a.substanceId && p.q > 0);
    if (!others.length) { say("There is no other packet of this substance to combine with.", "warn"); return; }
    const withRoom = a.q < PACKET_CAPACITY_Q ? others.find(() => true) : null;
    const res = withRoom ? act({ type: "packet/combine", aId: id, bId: withRoom.id }) : act({ type: "packet/compact", substanceId: a.substanceId });
    say(res.last.message, res.last.ok ? "ok" : "warn");
  }, [act, scene, say]);

  const finishPour = useCallback(() => { send({ type: "commitDone" }); send({ type: "settle" }); }, [send]);

  /** Begin a pour (drag-drop or the Pour button).  Returns true when the pour was accepted. */
  const pour = useCallback((src, dst) => {
    if (bench.current.pour) return false;                       // one transfer at a time: rapid repeats are ignored
    const sc = scene(); const s = findPacket(sc, src); const d = findPacket(sc, dst);
    if (!s || !d) { cancel("Choose two packets on the bench."); return false; }
    if (!s.open) { cancel("The packet is closed: open the zipper before pouring."); return false; }
    const v = targetValidity(src, dst); if (!v.valid) { cancel(v.reason); return false; }
    if (!d.open) act({ type: "packet/open", id: dst });         // a valid destination is opened to receive the material
    setSelectedId(src); send({ type: "cancel" }); send({ type: "select", id: src }); send({ type: "target", id: dst, valid: true, isOpen: true }); send({ type: "tilt" });
    const sn = bench.current.nodes.get(src); const dn = bench.current.nodes.get(dst);
    const dir = dn && sn ? (dn.disp.x >= sn.disp.x ? 1 : -1) : 1;
    if (reducedRef.current || !sn || !dn) {
      send({ type: "commit" }); const r = act({ type: "packet/pour", sourceId: src, destId: dst }); say(r.last.ok ? `${r.last.message}` : r.last.message, r.last.ok ? "ok" : "warn"); finishPour(); return r.last.ok;
    }
    bench.current.pour = { src, dst, phase: "in", t: 0, dir, duration: 1.0, movedFraction: 0 };
    return true;
  }, [act, cancel, finishPour, say, scene, send, targetValidity]);

  /** PourDirector callback: the ONE moment the chemistry changes. Returns the moved fraction for the stream. */
  const onCommit = useCallback((p) => {
    const before = machineRef.current; const next = send({ type: "commit" }); if (next === before) return 0; // not in `tilting`: nothing to commit
    const sc = scene(); const dry = pourPacket(sc, p.src, p.dst);
    const r = act({ type: "packet/pour", sourceId: p.src, destId: p.dst });
    say(r.last.message, r.last.ok ? "ok" : "warn");
    return dry.notice.ok ? (dry.notice.movedQ ?? 0) / 1e9 : 0;
  }, [act, say, scene, send]);

  // ---- pointer handlers (PointerController) ----
  const handlers = useMemo(() => ({
    onPress: (id) => { setSelectedId(id); if (machineRef.current.phase === "idle" || machineRef.current.phase === "selected" || machineRef.current.phase === "transferComplete") { send({ type: "cancel" }); send({ type: "select", id }); } },
    onClick: (id) => { send({ type: "select", id }); setSelectedId(id); },
    onDragStart: (id) => { send({ type: "select", id }); send({ type: "dragStart" }); },
    onDragOver: (id, targetId) => {
      if (!targetId) { send({ type: "dragOver", targetId: null, valid: false }); return { valid: false }; }
      const v = targetValidity(id, targetId); send({ type: "dragOver", targetId, valid: v.valid }); return v;
    },
    onDrop: (id, targetId, at) => {
      if (targetId) {
        const v = targetValidity(id, targetId); const p = findPacket(scene(), id);
        if (v.valid) {
          if (!p.open) { send({ type: "drop", isOpen: false }); cancel("The packet is closed: open the zipper, then drop it on the other packet (or press Pour)."); return; }
          send({ type: "drop", isOpen: true }); pour(id, targetId); return;
        }
        send({ type: "drop" }); cancel(v.reason); return;
      }
      send({ type: "drop", hint: "" }); setPlacement((pl) => ({ ...pl, [id]: at })); say("Packet placed on the bench.", "ok");
    },
    onDropFailed: (id, why) => { send({ type: "drop" }); cancel(why); },
  }), [cancel, pour, say, scene, send, targetValidity]);

  const resetPositions = useCallback(() => { setPlacement({}); say("Packets returned to their places.", "ok"); }, [say]);

  // forget placement / selection of packets that no longer exist, and cancel anything in flight when the stage changes
  const ids = scene().packets.map((p) => p.id).join(",");
  useEffect(() => {
    const have = new Set(ids.split(",")); setPlacement((pl) => { const k = Object.keys(pl).filter((x) => !have.has(x)); if (!k.length) return pl; const n = { ...pl }; for (const x of k) delete n[x]; return n; });
    if (selRef.current && !have.has(selRef.current)) setSelectedId(null);
  }, [ids]);
  useEffect(() => { cancel(); setPlacement({}); setSelectedId(null); }, [stage, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { bench, machine, selectedId, placement, message, select, toggleOpen, split, combine, pour, cancel, onCommit, finishPour, handlers, resetPositions, targetValidity, say };
}
