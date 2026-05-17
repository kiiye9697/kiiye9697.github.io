export interface Project {
  id: string;
  title: string;
  category: "Rendering" | "PCG" | "Tool" | "Research";
  period: string;
  description: string;
  tags: string[];
  status: "completed" | "ongoing";
  github?: string;
  demo?: string;
  images?: string[];
}

export const projects: Project[] = [
  // Rendering
  {
    id: "pbr-shader",
    title: "PBR Shader 分析与实现",
    category: "Rendering",
    period: "2024",
    description: "基于物理的渲染管线学习，从理论到 UE5/Houdini 实现",
    tags: ["PBR", "UE5", "Houdini", "GLSL"],
    status: "completed",
  },
  {
    id: "raytracing",
    title: "实时光线追踪研究",
    category: "Rendering",
    period: "2024",
    description: "GAMES202 课程笔记与实践，RTX 光追管线探索",
    tags: ["Ray Tracing", "RTX", "GLSL"],
    status: "completed",
  },
  {
    id: "gi-algorithm",
    title: "全局光照算法对比",
    category: "Rendering",
    period: "2024",
    description: "SSAO, LOD, Light Probe 等 GI 技术研究与实现",
    tags: ["GI", "SSAO", "Light Probe"],
    status: "completed",
  },
  // PCG
  {
    id: "procedural-terrain",
    title: "程序化地形生成",
    category: "PCG",
    period: "2024",
    description: "基于噪声的程序化地形与材质生成系统",
    tags: ["PCG", "Noise", "Houdini", "Terrain"],
    status: "completed",
  },
  {
    id: "foliage-system",
    title: "程序化植物系统",
    category: "PCG",
    period: "2024",
    description: "L-system 与程序化分布的植被生成方案",
    tags: ["L-system", "Procedural", "Houdini"],
    status: "completed",
  },
  // Tool
  {
    id: "ta-pipeline",
    title: "TA 工具链搭建",
    category: "Tool",
    period: "2024",
    description: "自动化资产检查、Shader 管理、文档生成等 Pipeline 工具",
    tags: ["Python", "Pipeline", "Automation"],
    status: "ongoing",
  },
  // Research
  {
    id: "games101",
    title: "GAMES101 图形学基础",
    category: "Research",
    period: "2024",
    description: "计算机图形学系统学习，完成全部 16 讲笔记与作业",
    tags: ["CG Basics", "Notes", "Homework"],
    status: "completed",
    link: "https://zhuanlan.zhihu.com/p/xxx",
  },
  {
    id: "games104",
    title: "GAMES104 游戏引擎原理",
    category: "Research",
    period: "2024",
    description: "游戏引擎架构、渲染管线与物理系统深入学习",
    tags: ["Game Engine", "Architecture"],
    status: "completed",
  },
];

export const categoryColors: Record<Project["category"], string> = {
  Rendering: "#C8102E",
  PCG: "#004170",
  Tool: "#34d399",
  Research: "#a78bfa",
};
