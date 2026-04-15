export const profile = {
  name: "Kiiye9697",
  nameReal: "Kiiye",
  title: "Rendering / PCG TA",
  subtitle: "Graphic Lover · TA Engineer",
  email: "1916954944@qq.com",
  phone: "",
  zhihu: "https://www.zhihu.com/people/he-xian-wen-lu-xian-ying",
  github: "https://github.com/kiiye9697",
};

export const education: {
  school: string;
  badge: string;
  degree: string;
  period: string;
}[] = [];

export const experiences = [
  {
    company: "腾讯科技",
    department: "光子工作室",
    role: "技术美术实习生",
    period: "2026.05 — 2026.08",
    icon: "/company-icons/tencent.png",
    iconWidth: 420,
    iconHeight: 208,
    iconDisplayHeight: 34,
    highlights: [
      {
        title: "技术美术方向实习",
        desc: "参与 Rendering、PCG 与技术美术相关内容，围绕实际生产需求推进学习与实践。",
      },
      {
        title: "作品与能力持续整理中",
        desc: "当前主页用于集中整理个人作品集、简历、知乎文章与后续项目沉淀。",
      },
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
      {
        title: "关注方向",
        desc: "重点关注实时渲染、程序化内容生成、技术美术工作流与实用型工具支持。",
      },
      {
        title: "公开输出",
        desc: "通过知乎文章和个人主页持续整理学习笔记、技术理解与项目材料。",
      },
    ],
  },
];

export const skills = [
  {
    category: "Core Focus",
    items: ["Rendering", "PCG", "Technical Art", "Realtime Workflow"],
  },
  {
    category: "Tools",
    items: ["Python", "Git / GitHub", "Pipeline Support", "Debug Practice"],
  },
  {
    category: "Interests",
    items: ["LookDev", "Shader Analysis", "Procedural Workflow", "Content Production"],
  },
];

export const navSections = [
  { id: "home", label: "Home" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "articles", label: "Writing" },
];
