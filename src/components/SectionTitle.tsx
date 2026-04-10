type SectionTitleProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export default function SectionTitle({
  eyebrow,
  title,
  description,
}: SectionTitleProps) {
  return (
    <div className="mb-8 max-w-3xl">
      <p className="section-kicker">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-main)] sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-8 text-[var(--text-muted)] sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}
