// PACKET INTERACTION STATE MACHINE (spec B5), pure and framework-free.
//
//   idle -> selected -> dragging -> targetDetected -> open -> tilting -> pouring -> transferComplete -> (selected | idle)
//
// The machine only describes WHAT THE STUDENT IS DOING.  It never holds amounts: when a pour is committed the caller applies
// ONE atomic store action ("packet/pour") on the transition tilting -> pouring and the animation merely follows the store.
// Invalid or duplicate events return the SAME state object (idempotent), so double-clicks / rapid events cannot repeat a
// transfer: `txId` is incremented exactly once per committed pour and a second commit with the same txId is ignored.
//
// Keyboard / touch / button alternatives drive the SAME events (select, target, open, commit ...) -- there is no second code path.

export const PHASES = Object.freeze(["idle", "selected", "dragging", "targetDetected", "open", "tilting", "pouring", "transferComplete"]);
export const BUSY_PHASES = Object.freeze(["tilting", "pouring"]);

export const initialInteraction = () => ({ phase: "idle", packetId: null, targetId: null, needsOpen: false, returnHome: false, txId: 0, committedTx: 0, hint: "" });

const to = (s, patch) => ({ ...s, returnHome: false, hint: "", ...patch });

/**
 * @param s      machine state
 * @param e      { type, ... }
 *   select{id} deselect dragStart dragOver{targetId|null, valid} drop{valid} target{id} opened closed tilt tiltDone commit commitDone settle cancel
 * `valid` = the caller checked the destination (compatible substance, room) against the store.
 */
export function interactionReducer(s, e) {
  switch (e.type) {
    case "select": {
      if (BUSY_PHASES.includes(s.phase)) return s;                        // never change the selection mid-pour
      if (s.phase === "selected" && s.packetId === e.id) return s;
      if (s.phase === "dragging" || s.phase === "targetDetected" || s.phase === "open") return s; // finish or cancel first
      return to(s, { phase: "selected", packetId: e.id, targetId: null, needsOpen: false });
    }
    case "deselect": return s.phase === "selected" ? to(s, { phase: "idle", packetId: null }) : s;
    case "dragStart": return s.phase === "selected" ? to(s, { phase: "dragging", targetId: null }) : s;
    case "dragOver": {
      if (s.phase !== "dragging" && s.phase !== "targetDetected") return s;
      if (e.targetId && e.valid) return s.phase === "targetDetected" && s.targetId === e.targetId ? s : to(s, { phase: "targetDetected", targetId: e.targetId });
      const hint = e.targetId && !e.valid ? "That target cannot take this packet." : "";
      return s.phase === "dragging" && !s.targetId && s.hint === hint ? s : to(s, { phase: "dragging", targetId: null, hint });
    }
    case "drop": {
      if (s.phase === "dragging") return to(s, { phase: "selected", targetId: null, returnHome: true, hint: e.hint ?? "Dropped outside a valid target: the packet returned." }); // FAILED DROP: nothing changed
      if (s.phase === "targetDetected") return to(s, e.isOpen ? { phase: "open", needsOpen: false } : { phase: "targetDetected", needsOpen: true, hint: "Open the zipper to pour." });
      return s;
    }
    case "target": { // keyboard / button path: choose the destination without dragging
      if (s.phase !== "selected" && s.phase !== "dragging") return s;
      if (!e.valid) return to(s, { phase: "selected", hint: "That target cannot take this packet." });
      return to(s, e.isOpen ? { phase: "open", targetId: e.id, needsOpen: false } : { phase: "targetDetected", targetId: e.id, needsOpen: true, hint: "Open the zipper to pour." });
    }
    case "opened": return s.phase === "targetDetected" && s.needsOpen ? to(s, { phase: "open", needsOpen: false }) : s;
    case "closed": return s.phase === "open" ? to(s, { phase: "targetDetected", needsOpen: true, hint: "The zipper is closed: open it to pour." }) : s;
    case "tilt": return s.phase === "open" ? to(s, { phase: "tilting" }) : s;
    case "tiltDone": return s; // animation progress is not a state change: the commit event follows
    case "commit": {
      // the ONE place a pour is committed: only from `tilting`, only once per txId
      if (s.phase !== "tilting") return s;
      return to(s, { phase: "pouring", txId: s.txId + 1 });
    }
    case "commitDone": return s.phase === "pouring" ? to(s, { phase: "transferComplete", committedTx: s.txId }) : s;
    case "settle": return s.phase === "transferComplete" ? to(s, { phase: "idle", packetId: null, targetId: null }) : s;
    case "cancel": // interrupt anywhere: the chemistry is whatever the store says; the machine just goes home
      return s.phase === "idle" ? s : to(s, { phase: "idle", packetId: null, targetId: null, needsOpen: false, returnHome: s.phase === "dragging" || s.phase === "targetDetected" });
    default: return s;
  }
}
/** True when a pour commit would be legal in this state. */
export const canCommit = (s) => s.phase === "tilting";
/** Pour is only ever possible from an open bag. */
export const canTilt = (s) => s.phase === "open";
