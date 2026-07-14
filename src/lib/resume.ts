export const profile = {
  name: "Kiiye9697",
  nameReal: "孙浩然",
  title: "综合向技术美术 / 引擎-渲染开发",
  subtitle: "Technical art notes, project breakdowns, and portfolio staging.",
  summary:
    "综合向技术美术，聚焦引擎渲染开发与程序化内容生成。",
  email: "1916954944@qq.com",
  phone: "18640144621",
  location: "China",
  birthday: "2006.01",
  availability: "2028 Intern Track",
  avatarInitials: "SH",
  currentFocus: "综合向技术美术 / 引擎-渲染开发",
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
    school: "大连理工大学（985）",
    badge: "计算机方向",
    degree: "本科 · 计算机科学与技术",
    period: "2024 - 2028",
  },
];

export const resumeSummary = [
  "综合向技术美术，聚焦引擎渲染开发与程序化内容生成。",
  "大连理工大学计算机科学与技术本科在读，2028 届。",
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
      "S工作室：支持和平精英以及3A预研项目。",
      "支持类三角洲的端手一体地形方案，解决 weightmap-splatmap-idmap 工作流中的算法损失问题。",
      "整理项目中材质分类评估性能开销，根据预算优化材质。",
    ],
  },
];

export const resumeSkills = [
  {
    category: "语言",
    items: ["C# / C++", "Python", "GLSL / HLSL"],
  },
  {
    category: "使用引擎",
    items: ["Unity", "Unreal", "Mitsuba"],
  },
  {
    category: "DCC",
    items: ["Houdini"],
  },
];

export const skills = resumeSkills;

export const writingLinks = [
  {
    title: "个人博客",
    href: "/writing/",
    meta: "Blog",
    excerpt: "GAMES101 / GAMES202 / GAMES104 课程笔记与图形学技术整理。",
    external: false,
  },
  {
    title: "知乎技术帖",
    href: profile.zhihu,
    meta: "Zhihu",
    excerpt: "对外公开的技术整理入口。",
    external: true,
  },
];

export const portfolioSceneSets = [
  {
    title: "Scene Set 01",
    meta: "待补充",
    description: "",
  },
  {
    title: "Scene Set 02",
    meta: "待补充",
    description: "",
  },
  {
    title: "Scene Set 03",
    meta: "待补充",
    description: "",
  },
];

export const portfolioHighlights = [
  {
    title: "作品集 PDF",
    description: "投递与交流用的完整版本。",
    href: profile.portfolioPdf,
  },
  {
    title: "项目",
    description: "按游戏、作品集、研究分类的项目库。",
    href: "/projects/",
  },
  {
    title: "技术笔记",
    description: "课程笔记与图形学研究。",
    href: "/writing/",
  },
];

export const projectCategories = [
  {
    id: "game",
    kicker: "Game",
    label: "游戏项目",
    description: "参与或主导的游戏项目。",
  },
  {
    id: "portfolio",
    kicker: "Portfolio",
    label: "作品集用",
    description: "用于作品集展示的工程项目。",
  },
  {
    id: "research",
    kicker: "Research",
    label: "论文以及探索/研究项目",
    description: "论文、技术研究和探索性项目。",
  },
];

export const activeProjects = [
  {
    slug: "classic-sponza-urp",
    category: "portfolio",
    eyebrow: "Rendering",
    status: "Completed",
    title: "Classic Sponza URP 渲染管线扩展",
    summary: "基于 Unity URP，在 Classic Sponza 场景中从零实现 GTAO、SSR、TAA、体积光、Bloom、高度雾 6 个高级渲染特性。",
    cover: "https://kiiyeblog.oss-cn-beijing.aliyuncs.com/SponzaShowcase.png",
    tags: ["Unity URP", "C#", "HLSL", "Compute Shader"],
    highlights: [
      "GTAO：Compute Shader 实现地面真值环境光遮蔽，GBuffer 后延迟光前运行，支持多反弹 SSDO 合成与调试视图。",
      "SSR：Hi-Z Ray Marching 屏幕空间反射，Interleaved Gradient 抖动去噪，ARGBHalf 精度，支持 Downsample 与 HitMask 调试。",
      "TAA：Intel TAA 完整实现，Halton 序列抖动 + AABB 历史帧收紧 + 速度拒绝防残影 + 相机切换自动重置历史帧。",
      "体积光：Ray Marching + Henyey-Greenstein 相位函数各向异性散射 + 高度雾遮罩 + 降采样双边模糊。",
      "Bloom：多级金字塔泛光，Prefilter → Downsample → Upsample → Composite 四阶段管线。",
      "高度雾：后处理高度雾 + 方向光散射 + 天空盒地平线过渡 + 近距离淡出。",
    ],
    links: [
      { label: "GTAO 技术贴", href: "/writing/24-gtao-implementation/" },
      { label: "返回项目列表", href: "/projects/#portfolio" },
    ],
    techPosts: [
      { title: "Unity URP：GTAO实现（Plus：Multi-Bounce&SSDO）", href: "/writing/24-gtao-implementation/" },
      { title: "Unity URP：SSR 实现", href: "/writing/25-ssr-implementation/" },
    ],
  },
  {
    slug: "sdf-baker",
    category: "research",
    eyebrow: "Research",
    status: "Completed",
    title: "SDF Baker — Signed Heat Method 工程化复现",
    summary: "基于 SIGGRAPH 2024 论文（Feng & Crane），将 Signed Heat Method 从 Python 原型落地为可独立分发的 Windows 桌面应用，支持 2D 图像与 3D 网格/点云输入，产出游戏引擎可直接载入的体积纹理（DDS/KTX）。",
    cover: "/images/portfolio/portfolio-graphics.svg",
    tags: ["SDF", "SHM", "C++", "Vulkan", "Eigen"],
    highlights: [
      "2D 域实现 4 种算法（暴力法 / Saito EDT / 8SSEDT / SHM 2D），3D 域包装 signed-heat-3d，支持点云、开曲面、自相交网格。",
      "GPU Vulkan compute 加速 Yukawa 卷积（空间哈希截断 + binning），CPU 自动回退。",
      "Step 3 从 KKT 鞍点 LU 分解降级为 CG 解无约束泊松方程，64³ 从 >120s 降至 ~1.3s。",
    ],
    links: [
      { label: "GitHub 仓库", href: "https://github.com/kiiye9697/SDF-Generator" },
      { label: "技术帖", href: "/writing/23-signed-heat-method/" },
      { label: "返回项目列表", href: "/projects/#research" },
    ],
  },
  {
    slug: "graphics-notes-hub",
    category: "research",
    eyebrow: "Research",
    status: "Ongoing",
    title: "Graphics Notes Hub",
    summary: "GAMES 系列课程笔记与图形学研究输出。",
    cover: "/images/portfolio/portfolio-graphics.svg",
    tags: ["Rendering", "Notes", "Research"],
    highlights: [
      "GAMES101 / GAMES202 / GAMES104 课程笔记。",
      "支持站内浏览、LaTeX 公式与代码块。",
    ],
    links: [
      { label: "阅读技术帖", href: "/writing/" },
      { label: "返回项目列表", href: "/projects/#research" },
    ],
  },
  {
    slug: "deepshield",
    category: "research",
    eyebrow: "AI",
    status: "Completed",
    title: "DeepShield — 深度伪造检测平台",
    summary: "基于深度学习的图像/视频伪造检测可视化平台。",
    cover: "/images/portfolio/portfolio-vision.svg",
    tags: ["AI", "Detection", "Deep Learning", "HuggingFace"],
    highlights: [
      "基于深度学习的伪造检测模型。",
      "HuggingFace Spaces 在线演示平台。",
    ],
    links: [
      { label: "在线演示", href: "https://huggingface.co/spaces/kiiye/deepshield" },
      { label: "返回项目列表", href: "/projects/#research" },
    ],
  },
  {
    slug: "huaqi",
    category: "research",
    eyebrow: "Visualization",
    status: "Completed",
    title: "HuaQi — 波动率可视化与风险预测系统",
    summary: "金融波动率可视化与风险预测的交互式平台。",
    cover: "/images/portfolio/portfolio-vision.svg",
    tags: ["Visualization", "Finance", "HuggingFace"],
    highlights: [
      "波动率可视化与风险预测。",
      "HuggingFace Spaces 在线演示平台。",
    ],
    links: [
      { label: "在线演示", href: "https://huggingface.co/spaces/kiiye/HuaQi" },
      { label: "返回项目列表", href: "/projects/#research" },
    ],
  },
  {
    slug: "liner-backwards",
    category: "research",
    eyebrow: "Visualization",
    status: "Completed",
    title: "LinerBackwards — 线性模型反向传播可视化",
    summary: "线性模型反向传播过程的交互式可视化工具。",
    cover: "/images/portfolio/portfolio-vision.svg",
    tags: ["Visualization", "Education", "HuggingFace"],
    highlights: [
      "线性模型反向传播过程可视化。",
      "HuggingFace Spaces 在线演示平台。",
    ],
    links: [
      { label: "在线演示", href: "https://huggingface.co/spaces/kiiye/LinerBackwards" },
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
