export function LegalPage({
  title, updated, intro, sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-16 pb-28 sm:pt-24">
      <p className="text-[13px] font-bold tracking-wider text-brand-600 uppercase">Legal</p>
      <h1 className="mt-3 text-[clamp(2.2rem,5vw,3rem)] leading-tight font-semibold text-ink">{title}</h1>
      <p className="mt-3 text-[14px] text-ink-muted">Last updated {updated}</p>
      <p className="mt-8 text-[17.5px] leading-relaxed text-ink-soft">{intro}</p>

      <div className="mt-12 space-y-10">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-[20px] font-bold text-ink">{s.heading}</h2>
            <div className="mt-3 space-y-3">
              {s.body.map((p, i) => (
                <p key={i} className="text-[16px] leading-relaxed text-ink-soft">{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
