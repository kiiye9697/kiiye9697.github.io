import HeroSection from "@/components/HeroSection";
import PortfolioCard from "@/components/PortfolioCard";
import PostCard from "@/components/PostCard";
import ProjectCard from "@/components/ProjectCard";
import SectionTitle from "@/components/SectionTitle";
import SiteNav from "@/components/SiteNav";
import SkillChips from "@/components/SkillChips";
import SocialLinks from "@/components/SocialLinks";
import ExperienceTimeline from "@/components/ExperienceTimeline";
import {
  experiences,
  portfolios,
  profile,
  projects,
  siteConfig,
  skills,
  socialLinks,
} from "@/lib/resume";
import articlesData from "../../data/articles.json";

type Article = {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  voteup_count: number;
  comment_count: number;
  created: number;
  updated?: number;
  thumbnail?: string | null;
};

type ArticlesData = {
  updated_at: string;
  articles: Article[];
};

const postsData = articlesData as unknown as ArticlesData;
const hasZhihuFeed =
  siteConfig.postsLimit > 0 &&
  socialLinks.some((link) => link.label === "Zhihu");
const featuredPosts = hasZhihuFeed
  ? postsData.articles.slice(0, siteConfig.postsLimit)
  : [];
const zhihuLink =
  socialLinks.find((link) => link.label === "Zhihu")?.href ??
  "https://www.zhihu.com";

export default function Home() {
  return (
    <div className="page-shell min-h-screen bg-transparent text-[var(--text-main)]">
      <SiteNav />

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <HeroSection />

        <section id="about" className="section-shell section-frame">
          <SectionTitle
            eyebrow="About"
            title="Profile, focus, and contact"
            description="Rendering, procedural workflows, and technical art practice across portfolio work, writing, and selected projects."
          />

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="surface-card profile-card rounded-[28px] p-7 sm:p-8">
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--text-dim)]">
                Profile
              </p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-main)]">
                {profile.title}
              </h3>
              <p className="mt-4 text-base leading-8 text-[var(--text-muted)]">
                {profile.summary}
              </p>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <InfoBlock label="Location" value={profile.location} />
                <InfoBlock label="Domain" value={profile.domain} />
                <InfoBlock label="Email" value={profile.email} />
                <InfoBlock label="Focus" value={profile.sitePosition} />
              </div>

              <div className="mt-8">
                <p className="text-sm uppercase tracking-[0.22em] text-[var(--text-dim)]">
                  Tech Stack
                </p>
                <div className="mt-4">
                  <SkillChips skills={skills} />
                </div>
              </div>
            </article>

            <div id="links">
              <SectionTitle
                eyebrow="Links"
                title="Channels and contact"
                description="Code, writing, and direct contact in one place."
              />
              <SocialLinks links={socialLinks} />
            </div>
          </div>
        </section>

        <section id="experience" className="section-shell section-frame">
          <SectionTitle
            eyebrow="Experience"
            title="Experience and ongoing direction"
            description="Internship work, long-term study focus, and public technical writing."
          />
          <ExperienceTimeline items={experiences} />
        </section>

        <section id="portfolio" className="section-shell section-frame">
          <SectionTitle
            eyebrow="Portfolio"
            title="Portfolio and resume"
            description="Selected materials for review, download, and application use."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {portfolios.map((item, index) => (
              <div
                key={item.title}
                className={index === 0 ? "lg:col-span-2" : ""}
              >
                <PortfolioCard item={item} />
              </div>
            ))}
          </div>
        </section>

        <section id="projects" className="section-shell section-frame">
          <SectionTitle
            eyebrow="Projects"
            title="Project directions"
            description="Current areas of work across rendering, PCG, and technical art tooling."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.title} project={project} />
            ))}
          </div>
        </section>

        {hasZhihuFeed ? (
          <section id="posts" className="section-shell section-frame">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <SectionTitle
                eyebrow="Posts"
                title="Zhihu writing"
                description="Recent technical posts synced from the linked Zhihu profile."
              />
              <div className="pb-2 text-sm text-[var(--text-dim)]">
                <p>Last sync: {postsData.updated_at || "Waiting for first sync"}</p>
                <a
                  href={zhihuLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-[var(--brand-green-soft)] underline-offset-4 hover:underline"
                >
                  Open Zhihu profile
                </a>
              </div>
            </div>

            {featuredPosts.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {featuredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="surface-card rounded-[28px] p-8 text-base leading-8 text-[var(--text-muted)]">
                Waiting for the first sync from Zhihu. Once the workflow runs successfully, recent posts will appear here.
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-dim)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
        {value}
      </p>
    </div>
  );
}
