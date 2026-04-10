/* eslint-disable @next/next/no-img-element */
import type { PortfolioItem } from "@/lib/resume";

type PortfolioCardProps = {
  item: PortfolioItem;
};

export default function PortfolioCard({ item }: PortfolioCardProps) {
  const hasAssets = Boolean(item.previewPdf || item.pdf || item.slides);

  return (
    <article className="surface-card overflow-hidden rounded-[28px]">
      <div className="aspect-[16/10] border-b border-white/8 bg-[var(--panel-strong)]">
        <img
          src={item.cover}
          alt={item.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-6">
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag} className="meta-pill">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-main)]">
          {item.title}
        </h3>
        <p className="mt-3 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
          {item.summary}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {item.previewPdf ? (
            <a
              href={item.previewPdf}
              target="_blank"
              rel="noreferrer"
              className="action-button action-button-primary"
            >
              Preview PDF
            </a>
          ) : null}
          {item.pdf ? (
            <a href={item.pdf} className="action-button action-button-secondary">
              Download PDF
            </a>
          ) : null}
          {item.slides ? (
            <a
              href={item.slides}
              className="action-button action-button-secondary"
            >
              Download PPTX
            </a>
          ) : null}
          {!hasAssets ? (
            <span className="action-button action-button-disabled">
              Add files under public/pdfs and public/slides, then fill the paths
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
