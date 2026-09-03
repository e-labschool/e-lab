export default function StimulusTable({ table }) {
  return (
    <table className="w-full max-w-sm border-collapse text-sm">
      <thead>
        <tr>
          {table.headers.map((h) => (
            <th key={h} className="border border-[var(--color-line)] px-2.5 py-1.5 text-left font-medium text-[var(--color-ink)]">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="border border-[var(--color-line)] px-2.5 py-1.5 text-[var(--color-ink-soft)]">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
