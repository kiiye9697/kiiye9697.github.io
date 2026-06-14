export const profile = {
  name: "Kiiye9697",
  nameReal: "孙浩然",
  birthday: "2006.06.21",
  location: "辽宁省大连",
  title: "PCG / 渲染向技术美术",
  subtitle: "Technical Artist focused on PCG, rendering and game production workflows.",
  email: "1916954944@qq.com",
  phone: "18640144621",
  homepage: "https://kiiye9697.cn",
  zhihu: "https://www.zhihu.com/people/he-xian-wen-lu-xian-ying",
  github: "https://github.com/kiiye9697",
  resumePdf: "/resume-2028.pdf",
  portfolioPdf: "/portfolio.pdf",
};

export const navSections = [
  { href: "/", label: "个人主页" },
  { href: "/writing/", label: "技术帖" },
  { href: "/portfolio/", label: "作品集" },
  { href: "/resume/", label: "简历" },
  { href: "/projects/", label: "项目" },
];

export const resumeSummary = [
  "大连理工大学计算机科学与技术专业本科，2024-2028，求职方向为 PCG / 渲染向技术美术实习。",
  "熟悉 Unity URP 管线，了解 UE5 蓝图、后处理效果和动画系统状态机，具备游戏项目中的 TA 实践经验。",
  "关注实时渲染、NPR、RenderFeature、AIGC 资产流程、工具脚本和技术美术生产工作流。",
];

export const education = [
  {
    school: "大连理工大学",
    badge: "本科",
    degree: "计算机科学与技术",
    period: "2024 - 2028",
  },
];

export const resumeSkills = [
  {
    category: "游戏引擎",
    items: [
      "Unity URP 管线有一定深度了解",
      "UE5 基本了解，Gamejam 中使用蓝图实现后处理与动画状态机",
    ],
  },
  {
    category: "语言与 Shader",
    items: [
      "C++ 熟练了解，专业课 90+",
      "C# 熟悉，Unity 常用，了解委托机制",
      "HLSL 了解，可书写 URP 管线 Shader 效果",
      "了解 Unreal 材质与 Shader Graph",
    ],
  },
  {
    category: "图形学",
    items: [
      "围绕涡方法论文进行流体模拟探索",
      "持续整理离线渲染、实时渲染与 GAMES 系列课程笔记",
    ],
  },
  {
    category: "其他能力",
    items: ["英语四级 608", "英语六级 500+"],
  },
];

export const experiences = [
  {
    company: "腾讯科技",
    department: "光子工作室",
    role: "技术美术实习生",
    period: "2026.05 - 2026.08",
    highlights: [
      "参与 Rendering、PCG 与技术美术相关内容，围绕实际生产需求推进学习与实践。",
      "整理项目材料、工具思路与图形方向学习笔记，形成可展示的作品主页结构。",
    ],
  },
];

export const writingLinks = [
  {
    title: "知乎技术帖主页",
    meta: "长期更新",
    excerpt: "集中整理 Rendering、PCG、TA 学习笔记和项目复盘。",
    href: profile.zhihu,
    external: true,
  },
  {
    title: "站内技术帖索引",
    meta: "Markdown-ready",
    excerpt: "GAMES101 / GAMES202 / GAMES104 课程笔记已迁入站内，支持 Markdown 与 LaTeX 渲染。",
    href: "/writing/",
    external: false,
  },
];

export const portfolioHighlights = [
  {
    title: "PDF 作品集",
    description: "完整 PDF 版本保留为主入口，适合查看已有图文版项目材料。",
    href: profile.portfolioPdf,
  },
  {
    title: "Scene Set 展示位",
    description: "作品集页面保留三个场景 Set 空位，方便逐步补充封面、视频和拆解说明。",
    href: "/portfolio/",
  },
  {
    title: "项目索引",
    description: "项目页保留平台项目、AI work 和论文工作等分类，方便持续扩展。",
    href: "/projects/",
  },
];

export const portfolioSceneSets = [
  {
    title: "Scene Set 01",
    meta: "Rendering Scene",
    description: "Reserved for environment render.",
  },
  {
    title: "Scene Set 02",
    meta: "Environment Set",
    description: "Reserved for lighting and mood study.",
  },
  {
    title: "Scene Set 03",
    meta: "Lookdev Set",
    description: "Reserved for material and lookdev study.",
  },
];

export type ProjectCategory = "dev" | "course" | "ai" | "paper";

export const projectCategories: {
  id: ProjectCategory;
  label: string;
  kicker: string;
  description: string;
}[] = [
  {
    id: "dev",
    label: "开发项目",
    kicker: "Game / Tool",
    description: "游戏项目、工具开发与技术美术流程整理。",
  },
  {
    id: "course",
    label: "学校作业课设 / 平台项目",
    kicker: "Coursework",
    description: "课程项目、平台 Demo 与阶段性工程实践。",
  },
  {
    id: "ai",
    label: "AI work",
    kicker: "AIGC",
    description: "AIGC 资产流程与 AI 辅助制作实验。",
  },
  {
    id: "paper",
    label: "论文工作",
    kicker: "Research",
    description: "涡方法论文、流体模拟探索与研究记录。",
  },
];

export const projects = [
  {
    slug: "deep-shield",
    category: "course" as ProjectCategory,
    title: "DeepShield 多模态伪造检测平台",
    eyebrow: "Hugging Face Space / Gradio",
    summary: "面向比赛展示的多模态伪造检测 Gradio 平台，集成图像与音频两条推理分支。",
    cover: "/background1.jpg",
    tags: ["Gradio", "PyTorch", "SAFE", "AASIST", "Forgery Detection"],
    status: "平台项目",
    highlights: [
      "公开 Space 元数据与文件显示该项目使用 Gradio SDK，主入口为 app.py，运行在 CPU Basic。",
      "图像分支接入 SAFE，使用 checkpoint-best.pth 进行合成图像检测；音频分支接入 AASIST，使用 AASIST.pth 做音频反欺骗分析。",
      "app.py 中包含图像/音频输入校验、预处理、分支推理、跨模态融合和证据报告模块；融合策略围绕 fake_score 进行多模态风险汇总。",
      "界面包含 Fusion Decision Overview、Per-Modality Risk Bars、Evidence Panel、Inference Process Animation 和 Batch Image Review，展示效果偏学术安全仪表盘。",
      "依赖栈包括 torch、torchvision、kornia、pywavelets、scipy、soundfile、Pillow、numpy 和 Gradio，适合展示 AI 安全与工程部署能力。",
    ],
    links: [
      { label: "Hugging Face Space", href: "https://huggingface.co/spaces/kiiye/deepshield" },
      { label: "在线应用", href: "https://kiiye-deepshield.hf.space" },
    ],
  },
  {
    slug: "huaqi-volatility-risk",
    category: "course" as ProjectCategory,
    title: "HuaQi 波动率可视化与风险预测系统",
    eyebrow: "Hugging Face Space / Gradio Dashboard",
    summary: "基于 Gradio、Plotly 和 ResCNN-Autoformer 展示思路的金融风险可视化驾驶舱。",
    cover: "/background1.jpg",
    tags: ["Gradio", "Plotly", "Pandas", "ResCNN-Autoformer", "Risk Dashboard"],
    status: "平台项目",
    highlights: [
      "公开 README 显示项目定位为商业展示版 Gradio Space，包含动态驾驶舱与权重上云演示模式。",
      "app.py 使用 pandas / numpy 读取 data.json，使用 Plotly 构建波动率主视图、季度视图、3D 风险地形图、因子流图与特征贡献可视化。",
      "模型展示部分比较 XGBoost + ResCNN、LightGBM + ResCNN、ResCNN + GRU、ResCNN + Autoformer 等方案，突出 ResCNN-Autoformer 的 AUC 表现。",
      "系统包含风险阈值分位数、风险雷达榜、季度滚动剖面、云端推理资源签名、智能预测输入和贡献分解，展示效果是完整的数据驾驶舱。",
      "依赖栈为 Gradio 5.31、pandas、numpy、plotly，并带 ResCNN_Autoformer.pth 演示权重，适合放在学校/平台类项目中展示数据可视化能力。",
    ],
    links: [
      { label: "Hugging Face Space", href: "https://huggingface.co/spaces/kiiye/HuaQi" },
      { label: "在线应用", href: "https://kiiye-huaqi.hf.space" },
    ],
  },
  {
    slug: "linear-showcase",
    category: "course" as ProjectCategory,
    title: "LinearShowcase 线性回归教学演示平台",
    eyebrow: "Hugging Face Docker Space / Flask",
    summary: "面向线性回归教学的 Docker Space，包含登录、学习进度、AI 助教和数据生成接口。",
    cover: "/background1.jpg",
    tags: ["Docker", "Flask", "JavaScript", "Volcengine Ark", "Education Tool"],
    status: "平台项目",
    highlights: [
      "公开 Space 元数据显示该项目使用 Docker SDK，app_port 为 7860，文件包含 Dockerfile、Flask app、templates、static 和 start.py。",
      "README 将项目描述为基于 Flask 的线性回归教学演示项目，可直接部署到 Hugging Face Docker Space。",
      "app.py 提供登录、登出、学习进度读写、AI 对话、AI 生成线性回归数据、原始数据格式化和 health check 等接口。",
      "AI 助教通过火山方舟/Ark Chat Completions 接口工作，默认模型为 deepseek-v3-2-251201，并设置了线性回归教学系统提示词。",
      "依赖栈为 Flask、gunicorn、requests；前端由 templates/index.html、static/app.js、static/styles.css 组织，适合展示完整 Web 应用部署与教学工具设计。",
    ],
    links: [
      { label: "Hugging Face Space", href: "https://huggingface.co/spaces/kiiye/LinerBackwards" },
      { label: "在线应用", href: "https://kiiye-linerbackwards.hf.space" },
    ],
  },
  {
    slug: "vortex-simulation",
    category: "paper" as ProjectCategory,
    title: "涡方法论文：流体模拟探索",
    eyebrow: "Research / The Graphic Forum 2026",
    summary: "围绕拉格朗日涡方法与多体问题加速展开的流体模拟研究探索。",
    cover: "/back.jpg",
    tags: ["Fluid Simulation", "Vortex Method", "Nested Grid", "Research"],
    status: "科研方向",
    highlights: [
      "研究重点放在拉格朗日涡方法、多体问题加速与嵌套网格判据设计。",
      "展示内容包括涡环对撞、三维蛙跳、二维泰勒涡和加速效果对比。",
      "该条目作为论文工作栏目中的核心图形学研究线索保留。",
    ],
    links: [
      { label: "作品集 PDF", href: profile.portfolioPdf },
      { label: "论文工作分类", href: "/projects/#paper" },
    ],
  },
];

export const activeProjects = projects;
