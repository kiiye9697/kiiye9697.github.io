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
  href: string;
  github: string;
};

export const siteConfig = {
  navSections: [
    { id: "about", label: "About" },
    { id: "portfolio", label: "Portfolio" },
    { id: "projects", label: "Projects" },
    { id: "posts", label: "Posts" },
    { id: "links", label: "Links" },
  ] satisfies NavSection[],
  heroActions: [
    { label: "View Portfolio", href: "#portfolio" },
    { label: "View Projects", href: "#projects" },
    { label: "Read Posts", href: "#posts" },
  ] satisfies HeroAction[],
  postsLimit: 6,
};

export const profile = {
  name: "Land1ngW",
  title: "Graphics / Engine / Systems Developer",
  subtitle: "C++ | Vulkan | Unreal | Embedded | Vision",
  summary:
    "A long-term maintainable personal site template for portfolio work, projects, technical writing, and resume content. Replace this data file and the public asset folders to personalize the entire homepage.",
  location: "Guangzhou, China",
  domain: "kiiye9697.github.io",
  email: "1738832489@qq.com",
  avatarInitials: "LW",
  currentFocus: "Realtime graphics, tooling, embedded systems, and practical AI workflows.",
  sitePosition: "Personal site / portfolio / writing archive",
  availability: "Open to collaboration, engineering roles, and technical conversations.",
};

export const skills = [
  "C / C++",
  "Vulkan",
  "ImGui",
  "Unity",
  "Python",
  "FPGA / Verilog",
  "Embedded",
  "YOLO / AI",
  "Git / GitHub",
];

export const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/LandingW",
    value: "@LandingW",
    note: "Code, experiments, and long-term archive.",
  },
  {
    label: "Email",
    href: "mailto:1738832489@qq.com",
    value: "1738832489@qq.com",
    note: "Hiring, collaboration, and technical conversations.",
  },
  {
    label: "Zhihu",
    href: "https://www.zhihu.com/people/wrm-66-76",
    value: "Zhihu Column",
    note: "Synced technical posts and article archive.",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/replace-this-profile/",
    value: "replace-this-profile",
    note: "Replace with your actual professional profile link.",
  },
  {
    label: "Other",
    href: "https://x.com/replace-this-handle",
    value: "custom channel",
    note: "Reserve for blog, Bilibili, X, or another channel.",
  },
];

export const experiences = [
  {
    kind: "Education",
    title: "Software Engineering, B.Eng.",
    org: "South China University of Technology",
    period: "2024 - Present",
    description:
      "Use this entry for school, degree, academic focus, awards, and the strongest educational signal you want to show.",
    details: [
      "Replace with your school, major, honors, competitions, and GPA if needed.",
      "Keep only the two or three strongest academic highlights instead of listing everything.",
    ],
  },
  {
    kind: "Experience",
    title: "Graphics / Engine Intern",
    org: "Tencent IEG",
    period: "2025 - Present",
    description:
      "Use this card for internship or full-time work. Focus on the technical scope, engineering depth, and the outcomes you actually shipped.",
    details: [
      "Replace with your real role name, team, and primary responsibilities.",
      "Keep two to four concrete outcomes instead of a long task list.",
    ],
  },
  {
    kind: "Direction",
    title: "Projects Across Graphics, Hardware, and AI",
    org: "Independent / Team Projects",
    period: "Ongoing",
    description:
      "Use this section for your current direction, research track, or cross-domain projects such as Vulkan tooling, embedded systems, CV workflows, or FPGA labs.",
    details: [
      "You can also merge research, competitions, and open-source work into the same timeline.",
      "Add more cards by extending this array. No component changes are required.",
    ],
  },
];

export const portfolios = [
  {
    title: "Graphics Systems Portfolio",
    summary:
      "Use this card for rendering experiments, engine tooling, and portfolio notes. The component already supports cover art, PDF preview, and downloads.",
    tags: ["Rendering", "Engine", "Slides"],
    cover: "/images/portfolio/portfolio-graphics.svg",
    previewPdf: "",
    pdf: "",
    slides: "",
  },
  {
    title: "Embedded / FPGA Showcase",
    summary:
      "Use this card for embedded boards, timing logic, hardware bring-up, and system integration work.",
    tags: ["Embedded", "FPGA", "Verilog"],
    cover: "/images/portfolio/portfolio-hardware.svg",
    previewPdf: "",
    pdf: "",
    slides: "",
  },
  {
    title: "AI Vision Deck",
    summary:
      "Use this card for detection, inference, deployment, and tooling decks. Swap the cover, PDF, and PPTX paths when you have real assets.",
    tags: ["YOLO", "Inference", "Deployment"],
    cover: "/images/portfolio/portfolio-vision.svg",
    previewPdf: "",
    pdf: "",
    slides: "",
  },
];

export const projects = [
  {
    title: "Vulkan Debug Sandbox",
    subtitle: "A compact renderer for learning, profiling, and tooling.",
    summary:
      "Replace this with your real graphics project. Describe the goal, the hard parts, the current state, and the part you personally owned.",
    tags: ["Vulkan", "C++", "RenderDoc"],
    href: "https://example.com/project/vulkan-sandbox",
    github: "https://github.com/LandingW",
  },
  {
    title: "Embedded Control Stack",
    subtitle: "Hardware bring-up, drivers, communication, and system integration.",
    summary:
      "Use this slot for MCU, sensors, drivers, communication protocols, or control systems with clear engineering scope.",
    tags: ["Embedded", "C", "UART", "RTOS"],
    href: "https://example.com/project/embedded-stack",
    github: "https://github.com/LandingW",
  },
  {
    title: "Vision Pipeline Toolkit",
    subtitle: "Training, evaluation, and deployment workflow for practical CV tasks.",
    summary:
      "Use this slot for YOLO, data pipelines, deployment scripts, or inference optimization with a clear experiment-to-production story.",
    tags: ["Python", "YOLO", "OpenCV", "Automation"],
    href: "https://example.com/project/vision-toolkit",
    github: "https://github.com/LandingW",
  },
];
