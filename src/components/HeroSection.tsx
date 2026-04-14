import { profile, siteConfig } from "@/lib/resume";

export default function HeroSection() {
  return (
    <section
      id="home"
      className="section-shell grid gap-6 pt-10 lg:grid-cols-[1.35fr_0.9fr] lg:items-stretch"
    >
      <div className="surface-card hero-primary rounded-[32px] p-7 sm:p-10">
        <span className="status-pill">{profile.availability}</span>
        <p className="mt-6 text-sm uppercase tracking-[0.28em] text-[var(--brand-green-soft)]">
          {profile.subtitle}
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--text-main)] sm:text-5xl lg:text-6xl">
          {profile.name}
        </h1>
        <p className="mt-5 max-w-3xl text-xl leading-9 text-[var(--text-main)] sm:text-2xl">
          {profile.title}
        </p>
        <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--text-muted)] sm:text-lg">
          {profile.summary}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {siteConfig.heroActions.map((action, index) => (
            <a
              key={action.label}
              href={action.href}
              className={`action-button ${
                index === 0
                  ? "action-button-primary"
                  : "action-button-secondary"
              }`}
            >
              {action.label}
            </a>
          ))}
        </div>

        <div className="hero-meter-grid mt-10">
          <HeroMeter label="Focus" value="Rendering / PCG / TA" />
          <HeroMeter label="Location" value={profile.location} />
          <HeroMeter label="Contact" value={profile.email} />
        </div>
      </div>

      <aside className="grid gap-6">
        <div className="surface-card hero-side rounded-[32px] p-7 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="avatar-mark">{profile.avatarInitials}</div>
            <span className="hero-side-tag">Profile Node</span>
          </div>
          <div className="mt-8 space-y-5">
            <MetaRow label="Current Focus" value={profile.currentFocus} />
            <MetaRow label="Site Position" value={profile.sitePosition} />
            <MetaRow label="Location" value={profile.location} />
          </div>
        </div>

        <div className="surface-card terminal-card rounded-[32px] p-7 sm:p-8">
          <div className="terminal-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="mt-6 space-y-4 font-mono text-sm leading-7 text-[var(--text-muted)]">
            <MetaRow
              label="Domain"
              value={
                <a
                  href="#home"
                  className="text-[var(--text-main)] underline-offset-4 hover:underline"
                >
                  {profile.domain}
                </a>
              }
            />
            <MetaRow
              label="Contact"
              value={
                <a
                  href={`mailto:${profile.email}`}
                  className="text-[var(--text-main)] underline-offset-4 hover:underline"
                >
                  {profile.email}
                </a>
              }
            />
          </div>
        </div>
      </aside>
    </section>
  );
}

function HeroMeter({ label, value }: { label: string; value: string }) {
  return (
    <div className="hero-meter">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/8 pb-5 last:border-b-0 last:pb-0">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">
        {label}
      </p>
      <div className="mt-2 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
        {value}
      </div>
    </div>
  );
}
