import ParticleControl from "./ParticleControl.jsx";

export default function ParticleControls({ protons, neutrons, electrons, onChange }) {
  return (
    <div className="flex flex-col gap-2.5">
      <ParticleControl type="proton" count={protons} onAdd={() => onChange("proton", 1)} onRemove={() => onChange("proton", -1)} canRemove={protons > 0} />
      <ParticleControl type="neutron" count={neutrons} onAdd={() => onChange("neutron", 1)} onRemove={() => onChange("neutron", -1)} canRemove={neutrons > 0} />
      <ParticleControl type="electron" count={electrons} onAdd={() => onChange("electron", 1)} onRemove={() => onChange("electron", -1)} canRemove={electrons > 0} />
    </div>
  );
}
