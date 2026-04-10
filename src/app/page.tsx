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
const featuredPosts = postsData.articles.slice(0, siteConfig.postsLimit);
const zhihuLink =
  socialLinks.find((link) => link.label === "Zhihu")?.href ??
  "https://www.zhihu.com";

export default function Home() {
  return (
    <div className="min-h-screen bg-transparent text-[var(--text-main)]">
      <SiteNav />

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <HeroSection />

        <section id="about" className="section-shell">
          <SectionTitle
            eyebrow="About"
            title="Profile, core skills, and the main editing surface"
            description="This section keeps the most frequently changed static content in one place. Name, summary, skills, social links, timeline items, projects, and portfolio entries all come from the same data file."
          />

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="surface-card rounded-[28px] p-7 sm:p-8">
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
                <InfoBlock
                  label="Site Use"
                  value="Portfolio, projects, writing, and resume timeline"
                />
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
                title="Social links and contact channels"
                description="GitHub, email, Zhihu, LinkedIn, and one custom channel are already wired in. Add or replace entries by editing only the data array."
              />
              <SocialLinks links={socialLinks} />
            </div>
          </div>
        </section>

        <section id="experience" className="section-shell">
          <SectionTitle
            eyebrow="Experience"
            title="Education and experience timeline"
            description="Use the same timeline for school, work, research direction, or major project tracks. To add more entries, extend the array only."
          />
          <ExperienceTimeline items={experiences} />
        </section>

        <section id="portfolio" className="section-shell">
          <SectionTitle
            eyebrow="Portfolio"
            title="Portfolio cards and downloadable material"
            description="Each card already supports a cover image, PDF preview, PDF download, and PPTX download. After uploading files, only update the paths in the data layer."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {portfolios.map((item) => (
              <PortfolioCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section id="projects" className="section-shell">
          <SectionTitle
            eyebrow="Projects"
            title="Projects and engineering work"
            description="These cards are structured for long-term maintenance with title, subtitle, summary, tags, detail link, and GitHub link."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.title} project={project} />
            ))}
          </div>
        </section>

        <section id="posts" className="section-shell">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <SectionTitle
              eyebrow="Posts"
              title="Zhihu post sync"
              description="This section still reads from data/articles.json. The site only consumes the synced static article data while the existing GitHub Actions and scraper remain intact."
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
              No article data has been synced yet. Once the existing Zhihu workflow runs successfully, posts will appear here automatically.
            </div>
          )}
        </section>
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
