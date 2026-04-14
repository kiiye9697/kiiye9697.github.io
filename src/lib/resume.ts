export type NavSection = {
  id: string;
  label: string;
};

export type HeroAction = {
  label: string;
  href: string;
};

export type SocialLink = {
  label: string;
  href: string;
  value: string;
  note: string;
};

export type Experience = {
  kind: string;
  title: string;
  org: string;
  period: string;
  description: string;
  details: string[];
};

export type PortfolioItem = {
  title: string;
  summary: string;
  tags: string[];
  cover: string;
  previewPdf: string;
  pdf: string;
  slides: string;
};

export type Project = {
  title: string;
  subtitle: string;
  summary: string;
  tags: string[];
  href?: string;
  github?: string;
};

// Site structure and hero buttons.
export const siteConfig = {
  navSections: [
    { id: "about", label: "About" },
    { id: "experience", label: "Experience" },
    { id: "portfolio", label: "Portfolio" },
    { id: "projects", label: "Projects" },
    { id: "posts", label: "Posts" },
    { id: "links", label: "Links" },
  ] satisfies NavSection[],
  heroActions: [
    { label: "View Portfolio", href: "#portfolio" },
    { label: "View Experience", href: "#experience" },
    { label: "View Projects", href: "#projects" },
    { label: "Read Posts", href: "#posts" },
  ] satisfies HeroAction[],
  postsLimit: 6,
};

// Core profile content shown in the hero and about sections.
export const profile = {
  name: "Kiiye9697",
  title: "Rendering / PCG TA",
  subtitle: "Graphic Lover | TA Engineer",
  summary:
    "Technical artist focused on rendering, procedural content generation, and practical workflow support for real-time production.",
  location: "Dalian, Liaoning, China",
  domain: "kiiye9697.github.io",
  email: "1916954944@qq.com",
  avatarInitials: "KY",
  currentFocus: "Realtime rendering, PCG workflows, and TA-side production tooling.",
  sitePosition: "Portfolio, writing archive, and selected work.",
  availability: "Open to rendering and technical art opportunities.",
};

// Primary skills shown in the profile section.
export const skills = [
  "Rendering",
  "PCG",
  "Technical Art",
  "Realtime Graphics",
  "Python",
  "Shader Debugging",
  "LookDev",
  "Pipeline Tools",
  "Git / GitHub",
];

// Contact and social channels.
export const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/kiiye9697",
    value: "@kiiye9697",
    note: "Code, experiments, and long-term archive.",
  },
  {
    label: "Email",
    href: "mailto:1916954944@qq.com",
    value: "1916954944@qq.com",
    note: "For portfolio, collaboration, and technical conversations.",
  },
  {
    label: "Zhihu",
    href: "https://www.zhihu.com/people/he-xian-wen-lu-xian-ying",
    value: "he-xian-wen-lu-xian-ying",
    note: "Technical posts and article archive.",
  },
];

// Education, work, and long-term direction timeline.
export const experiences = [
  {
    kind: "Experience",
    title: "Technical Artist Intern",
    org: "Tencent Technology, Photon Studio Group",
    period: "2026.05 - 2026.08",
    description:
      "Internship focused on technical art practice across rendering and PCG-related workflows in a production environment.",
    details: [
      "Worked as a TA intern on rendering and content-side technical workflows.",
      "This section can be expanded later with project details that are suitable for a public portfolio.",
    ],
  },
  {
    kind: "Direction",
    title: "Rendering / PCG / TA Practice",
    org: "Personal Study and Portfolio Work",
    period: "Ongoing",
    description:
      "A personal track centered on rendering quality, procedural content generation, and technical art problem solving.",
    details: [
      "Continuing to build portfolio material around real-time graphics, procedural workflows, and TA-side tooling.",
      "Additional school, competition, or studio experience can be added here later without changing the components.",
    ],
  },
  {
    kind: "Writing",
    title: "Zhihu Technical Writing",
    org: "Zhihu",
    period: "Ongoing",
    description:
      "Writing notes and long-form posts around rendering, graphics learning, and technical problem solving.",
    details: [
      "Articles are synced to this site from the linked Zhihu profile.",
      "Recent posts appear automatically after the scraper workflow runs.",
    ],
  },
];

// Portfolio cards with optional PDF and slide assets.
export const portfolios = [
  {
    title: "Selected Portfolio",
    summary:
      "Collected work focused on rendering, PCG, and technical art practice.",
    tags: ["Portfolio", "Rendering", "PCG"],
    cover: "/images/portfolio/portfolio-graphics.svg",
    previewPdf: "/pdfs/portfolio.pdf",
    pdf: "/pdfs/portfolio.pdf",
    slides: "",
  },
  {
    title: "Resume",
    summary:
      "Current resume for internship and full-time application contexts.",
    tags: ["Resume", "Profile", "PDF"],
    cover: "/images/portfolio/portfolio-hardware.svg",
    previewPdf: "/pdfs/resume.pdf",
    pdf: "/pdfs/resume.pdf",
    slides: "",
  },
];

// Project cards with live/demo and GitHub links.
export const projects = [
  {
    title: "Rendering Research and Breakdown",
    subtitle: "Rendering analysis, look development, and real-time visual problem solving.",
    summary:
      "A growing body of graphics-focused study and production-side analysis around rendering quality, visual debugging, and practical implementation details.",
    tags: ["Rendering", "Shader", "TA"],
    github: "https://github.com/kiiye9697",
  },
  {
    title: "PCG Workflow Experiments",
    subtitle: "Procedural generation tests for content building and iteration.",
    summary:
      "Experiments around procedural workflows that support content creation, reusable setup, and faster iteration in production-like environments.",
    tags: ["PCG", "Workflow", "Tools"],
    github: "https://github.com/kiiye9697",
  },
  {
    title: "TA Utility Scripts",
    subtitle: "Small tools for pipeline support and day-to-day production work.",
    summary:
      "A place for Python and workflow utilities that improve asset handling, iteration speed, and communication between art and engineering.",
    tags: ["Python", "Tools", "Pipeline"],
    github: "https://github.com/kiiye9697",
  },
];
