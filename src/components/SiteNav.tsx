import { profile, siteConfig } from "@/lib/resume";

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[rgba(11,11,11,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <a
          href="#home"
          className="nav-brand shrink-0"
        >
          <span className="nav-brand-mark" />
          <span>
            <strong>{profile.name}</strong>
            <em>{profile.title}</em>
          </span>
        </a>
        <nav className="hide-scrollbar flex flex-1 items-center justify-end gap-2 overflow-x-auto">
          {siteConfig.navSections.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="top-nav-link">
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
