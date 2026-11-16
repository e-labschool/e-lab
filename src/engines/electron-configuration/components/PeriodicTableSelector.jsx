import ElementSearch from "./ElementSearch.jsx";
import PeriodicTable from "./PeriodicTable.jsx";

// Kept for other pages that embed the picker (e.g. the student periodic-table tool): a thin wrapper over the
// accessible, compact PeriodicTable + combobox search. The old 118-button role="grid" was invalid ARIA.
export default function PeriodicTableSelector({ selectedAtomicNumber, onSelect }) {
  return (
    <div className="flex flex-col gap-3">
      <ElementSearch onSelect={onSelect} />
      <PeriodicTable selected={selectedAtomicNumber} onSelect={onSelect} />
    </div>
  );
}
