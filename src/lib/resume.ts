export const profile = {
  name: "Kiiye9697",
  nameReal: "孙浩然",
  title: "Rendering / PCG / TA",
  subtitle: "Technical art notes, project breakdowns, and portfolio staging.",
  summary:
    "聚焦实时渲染、程序化内容生成与技术美术工作流，把课程笔记、项目材料和作品集持续整理成可展示、可投递、可复盘的站点。",
  email: "1916954944@qq.com",
  phone: "18640144621",
  location: "China",
  birthday: "2006.01",
  availability: "2028 Intern Track",
  avatarInitials: "SH",
  currentFocus: "Rendering / PCG / TA pipeline practice",
  sitePosition: "Liverpool-style personal portfolio",
  domain: "kiiye9697.github.io",
  homepage: "https://kiiye9697.github.io",
  zhihu: "https://www.zhihu.com/people/he-xian-wen-lu-xian-ying",
  github: "https://github.com/kiiye9697",
  resumePdf: "/resume/",
  resumePdfDirect: "/pdfs/resume.pdf",
  portfolioPdf: "/pdfs/portfolio.pdf",
};

export const navSections = [
  { id: "home", label: "Home", href: "/" },
  { id: "projects", label: "Projects", href: "/projects/" },
  { id: "resume", label: "Resume", href: "/resume/" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio/" },
  { id: "articles", label: "Writing", href: "/writing/" },
];

export const education: {
  school: string;
  badge: string;
  degree: string;
  period: string;
}[] = [
  {
    school: "大连理工大学",
    badge: "计算机方向",
    degree: "本科 · 计算机科学与技术",
    period: "2024 - 2028",
  },
];

export const resumeSummary = [
  "目前正在围绕 Rendering、PCG 与技术美术方向持续积累作品、课程输出与可复用工作流。",
  "主页会承担两个职责：作为公开展示入口，以及作为后续投递时可快速替换和扩展的材料库。",
  "页面中的占位区域已经为项目封面、场景拆解、视频说明和更完整的经历信息预留结构。",
];

export const experiences = [
  {
    company: "腾讯科技",
    department: "光子工作室",
    role: "技术美术实习生",
    period: "2026.05 - 2026.08",
    icon: null,
    iconWidth: 0,
    iconHeight: 0,
    iconDisplayHeight: 0,
    highlights: [
      "参与 Rendering、PCG 与技术美术相关内容，围绕实际生产需求推进学习与实践。",
      "持续整理作品、能力标签与对外展示材料，便于后续投递和交流。",
    ],
  },
  {
    company: "个人方向",
    department: "Rendering / PCG / TA",
    role: "图形与技术美术实践",
    period: "持续进行中",
    icon: null,
    iconWidth: 0,
    iconHeight: 0,
    iconDisplayHeight: 0,
    highlights: [
      "重点关注实时渲染、程序化内容生成、技术美术工作流与实用型工具支持。",
      "通过知乎文章、课程笔记和个人主页，持续沉淀学习理解与项目材料。",
    ],
  },
];

export const resumeSkills = [
  {
    category: "Core Focus",
    items: ["Rendering", "PCG", "Technical Art", "Realtime Workflow"],
  },
  {
    category: "Tooling",
    items: ["Python", "Git / GitHub", "Pipeline Support", "Debug Practice"],
  },
  {
    category: "Interests",
    items: ["LookDev", "Shader Analysis", "Procedural Workflow", "AIGC Support"],
  },
];

export const skills = resumeSkills;

export const writingLinks = [
  {
    title: "站内课程笔记",
    href: "/writing/",
    meta: "Astro Content",
    excerpt: "GAMES101 / GAMES202 / GAMES104 的 Markdown 笔记已接入站内。",
    external: false,
  },
  {
    title: "知乎技术帖",
    href: profile.zhihu,
    meta: "Zhihu",
    excerpt: "对外公开的技术整理入口，可继续同步文章摘要或精选列表。",
    external: true,
  },
];

export const portfolioSceneSets = [
  {
    title: "Scene Set 01",
    meta: "Hero Environment",
    description: "适合放主场景封面、主镜头截图、制作目标与关键词。",
  },
  {
    title: "Scene Set 02",
    meta: "Lookdev Breakdown",
    description: "适合放材质、灯光、渲染对比图，以及关键节点拆解。",
  },
  {
    title: "Scene Set 03",
    meta: "Workflow / Video",
    description: "适合放流程图、节点图、演示视频封面或 GIF 入口。",
  },
];

export const portfolioHighlights = [
  {
    title: "完整作品集 PDF",
    description: "用于投递和交流的集中版本，适合承载完整图文与视频跳转链接。",
    href: profile.portfolioPdf,
  },
  {
    title: "项目分类入口",
    description: "把作品集里的项目拆成独立详情页，便于单独展示技术亮点。",
    href: "/projects/",
  },
  {
    title: "技术笔记入口",
    description: "把课程理解、图形学笔记与项目反思挂到作品旁边，增强完整度。",
    href: "/writing/",
  },
];

export const projectCategories = [
  {
    id: "development",
    kicker: "Dev Track",
    label: "开发项目",
    description: "偏工具、流程、系统和工程侧的项目集合。",
  },
  {
    id: "coursework",
    kicker: "Course Work",
    label: "学校作业 / 课设",
    description: "课程驱动的实现、作业和实验内容，适合补完整个学习轨迹。",
  },
  {
    id: "ai-work",
    kicker: "AI Work",
    label: "AI Work",
    description: "AIGC、检测、自动化辅助或模型接入相关项目。",
  },
  {
    id: "research",
    kicker: "Research",
    label: "论文 / 技术研究",
    description: "图形学、渲染、引擎或方法验证类的研究整理。",
  },
];

export const activeProjects = [
  {
    slug: "deep-shield",
    category: "ai-work",
    eyebrow: "AI Work",
    status: "In Progress",
    title: "Deep Shield",
    summary: "围绕伪造检测与模型接入整理的项目入口，适合作为 AI work 栏目的主卡片。",
    cover: "/images/portfolio/portfolio-vision.svg",
    tags: ["AI", "Detection", "Python"],
    highlights: [
      "用于承接伪造检测、推理结果展示与实验过程整理。",
      "后续可补充模型结构图、输入输出案例与部署方式。",
      "适合在作品集中作为 AI 方向代表项目重点展开。",
    ],
    links: [
      { label: "返回项目列表", href: "/projects/#ai-work" },
      { label: "查看作品集", href: "/portfolio/" },
    ],
  },
  {
    slug: "graphics-notes-hub",
    category: "research",
    eyebrow: "Research",
    status: "Ongoing",
    title: "Graphics Notes Hub",
    summary: "把 GAMES 系列课程笔记与图形学研究输出整理成结构化内容入口。",
    cover: "/images/portfolio/portfolio-graphics.svg",
    tags: ["Rendering", "Notes", "Research"],
    highlights: [
      "已接入 Astro Content，支持站内浏览、索引和后续归档。",
      "适合继续扩充关键图、公式说明和项目反思之间的关联。",
      "可作为技术深度的长期展示区，而不是只放链接。",
    ],
    links: [
      { label: "阅读技术帖", href: "/writing/" },
      { label: "返回项目列表", href: "/projects/#research" },
    ],
  },
];

export const siteConfig = {
  navSections: [
    { id: "home", label: "Home" },
    { id: "projects", label: "Projects" },
    { id: "experience", label: "Experience" },
    { id: "skills", label: "Skills" },
    { id: "articles", label: "Writing" },
  ],
  heroActions: [
    { label: "Open Portfolio", href: "/portfolio/" },
    { label: "Browse Projects", href: "/projects/" },
    { label: "Read Writing", href: "/writing/" },
  ],
};
