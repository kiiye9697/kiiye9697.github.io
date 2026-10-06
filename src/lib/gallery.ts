import { activeProjects } from "./resume";

// Presentation is independent of factual completion status in resume.ts.
export type GalleryEntry =
  | {
      mode: "featured" | "study";
      slug: string;
      displayLines?: [string, string];
    }
  | { mode: "upcoming"; label: string; note: string };

// Add featured works here. All remaining projects automatically enter the index.
const featuredEntries: GalleryEntry[] = [
  {
    mode: "featured",
    slug: "classic-sponza-urp",
    displayLines: ["Classic", "Sponza."],
  },
];
const featuredSlugs = new Set(
  featuredEntries.flatMap((entry) =>
    entry.mode === "featured" ? [entry.slug] : [],
  ),
);
export const galleryEntries: GalleryEntry[] = [
  ...featuredEntries,
  ...activeProjects
    .filter((project) => !featuredSlugs.has(project.slug))
    .map((project) => ({ mode: "study" as const, slug: project.slug })),
  { mode: "upcoming", label: "下一件作品", note: "创作中" },
];
export const galleryProjects = galleryEntries.flatMap((entry) => {
  if (entry.mode === "upcoming") return [];
  const project = activeProjects.find((project) => project.slug === entry.slug);
  if (!project) throw new Error(`Unknown gallery project: ${entry.slug}`);
  return [
    { ...project, displayMode: entry.mode, displayLines: entry.displayLines },
  ];
});
export const upcomingEntries = galleryEntries.filter(
  (entry) => entry.mode === "upcoming",
);
