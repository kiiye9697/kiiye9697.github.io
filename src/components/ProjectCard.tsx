import type { Project } from "@/lib/resume";

type ProjectCardProps = {
  project: Project;
};

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="surface-card rounded-[28px] p-6">
      <div className="flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <span key={tag} className="meta-pill">
            {tag}
          </span>
        ))}
      </div>
      <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-main)]">
        {project.title}
      </h3>
      <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[var(--brand-green-soft)]">
        {project.subtitle}
      </p>
      <p className="mt-4 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
        {project.summary}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={project.href}
          target="_blank"
          rel="noreferrer"
          className="action-button action-button-primary"
        >
          Project Details
        </a>
        <a
          href={project.github}
          target="_blank"
          rel="noreferrer"
          className="action-button action-button-secondary"
        >
          GitHub
        </a>
      </div>
    </article>
  );
}
