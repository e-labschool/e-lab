import { createPortal } from "react-dom";

/** Render children into one of the dashboard's columns (controls / graph / explain). The stage keeps ONE component tree and its own hooks;
 * the shell keeps ONE dashboard, so switching stage never remounts the header, the tabs or the playback bar. */
export default function Slot({ target, children }) {
  return target ? createPortal(children, target) : null;
}
