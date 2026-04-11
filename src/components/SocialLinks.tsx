import type { SocialLink } from "@/lib/resume";

type SocialLinksProps = {
  links: SocialLink[];
};

export default function SocialLinks({ links }: SocialLinksProps) {
  return (
    <div className="grid gap-4">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target={link.href.startsWith("http") ? "_blank" : undefined}
          rel={link.href.startsWith("http") ? "noreferrer" : undefined}
          className="surface-card social-card group block rounded-[24px] p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--text-dim)]">
                {link.label}
              </p>
              <p className="mt-2 text-base font-medium text-[var(--text-main)]">
                {link.value}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                {link.note}
              </p>
            </div>
            <span className="social-link-arrow text-lg text-[var(--brand-red)] transition-transform duration-200 group-hover:translate-x-1">
              +
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
