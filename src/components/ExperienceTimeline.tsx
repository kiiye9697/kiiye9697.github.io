import type { Experience } from "@/lib/resume";

type ExperienceTimelineProps = {
  items: Experience[];
};

export default function ExperienceTimeline({
  items,
}: ExperienceTimelineProps) {
  return (
    <div className="relative pl-4 sm:pl-8">
      <div className="absolute bottom-4 left-[11px] top-4 w-px bg-white/10 sm:left-[19px]" />
      <div className="grid gap-6">
        {items.map((item) => (
          <article key={`${item.org}-${item.title}`} className="relative">
            <span className="absolute left-[-4px] top-8 h-4 w-4 rounded-full border border-white/15 bg-[var(--brand-red)] shadow-[0_0_0_6px_rgba(200,16,46,0.12)] sm:left-[-18px]" />
            <div className="surface-card rounded-[24px] p-6 sm:p-8">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--brand-green-soft)]">
                    {item.kind}
                  </span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-main)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-base text-[var(--text-muted)]">
                    {item.org}
                  </p>
                </div>
                <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-dim)]">
                  {item.period}
                </p>
              </div>
              <p className="mt-5 text-base leading-8 text-[var(--text-muted)]">
                {item.description}
              </p>
              <div className="mt-5 grid gap-3">
                {item.details.map((detail) => (
                  <p
                    key={detail}
                    className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-[var(--text-subtle)]"
                  >
                    {detail}
                  </p>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
