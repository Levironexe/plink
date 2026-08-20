const STATS = [
  { value: "4.2M", label: "creators on Plink" },
  { value: "180M", label: "links tapped each month" },
  { value: "$92M", label: "earned by creators" },
  { value: "2 min", label: "median setup time" },
];

export function StatStrip() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
      {STATS.map((s) => (
        <div key={s.label} className="bg-surface px-6 py-8 text-center">
          <p className="text-[32px] leading-10 font-semibold tracking-[-0.04em] text-ink sm:text-[40px]">
            {s.value}
          </p>
          <p className="mt-2 font-mono text-[12px] leading-4 text-ink-muted">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
