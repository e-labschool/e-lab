import QBuilderApp from "./qbuilder/QBuilderApp.jsx";

// The Q Builder tab now renders the full Version 1 workspace. This file
// stays the route's entry point per the existing router pattern — all
// actual Q Builder logic/UI lives under ./qbuilder/ to keep it modular and
// self-contained from the rest of the Teacher area.
export default function QBuilder() {
  return <QBuilderApp />;
}
