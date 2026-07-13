# CodeBuddy 项目指令 — kiiye9697.github.io

> 本文件是 CodeBuddy 在此项目中的行为规范。每次用户要求添加/修改内容时，严格遵循以下流程。

## 项目概述

孙浩然的个人主页 / 技术博客 / 作品集站点。纯 Astro 5 静态站点，部署在 GitHub Pages。
域名：kiiye9697.github.io

## 技术栈

- Astro 5（`output: "static"`）
- KaTeX + remark-math（LaTeX 公式渲染）
- 无 React / 无前端框架运行时（.tsx 文件是遗留物，不参与构建）
- 部署：GitHub Actions → Node 22 → `npm ci` → `astro build` → GitHub Pages

## 内容维护工作流

当用户提供一个 MD 文件或口头描述要添加的内容时，按以下步骤执行：

### 第 1 步：解析用户内容

用户内容按 `## 模块名` 分段。识别涉及的模块：

| 模块关键字 | 对应操作 |
|-----------|---------|
| 个人信息 / 简历 / 经历 / 技能 | 修改 `src/lib/resume.ts` |
| 项目 / project | 在 `src/lib/resume.ts` → `activeProjects` 数组添加条目 |
| 作品集 / portfolio / scene | 修改 `src/lib/resume.ts` → `portfolioSceneSets` |
| 技术笔记 / writing / 笔记 | 在 `src/content/writing/` 创建 `.md` 文件 |
| About / 关于 | 修改 `src/pages/about.astro` |
| Work | 修改或删除 `src/content/work/` |

### 第 2 步：处理资源文件

- 用户提供的图片 → 移到 `public/images/projects/` 或 `public/images/portfolio/`
- 用户提供 PDF → 移到 `public/pdfs/`
- 用户提供的视频 → 如果 <50MB 放 `public/videos/`；如果太大，建议传 B站/YouTube，站上只放封面图+链接
- 图片引用路径在代码里用 `/images/projects/xxx.jpg` 格式（以 public/ 为根）

### 第 3 步：修改代码

严格按数据结构修改，不要重构无关代码。每个模块的精确字段见下方"数据结构参考"。

### 第 4 步：本地构建验证

```powershell
$env:PATH = "$env:USERPROFILE\.workbuddy\binaries\node\versions\22.12.0;$env:PATH"
$env:NODE_ENV = "production"
npm.cmd run build
```

构建必须零错误。如果报错，修复后重新构建。

### 第 5 步：提交（仅在用户明确要求时）

- 不要自动提交
- 用户说"提交"/"push"/"上线"时才执行 git add + commit + push
- commit message 格式：`content: 添加/更新 xxx`

## 数据结构参考

### resume.ts — 核心数据文件

```typescript
// 个人信息
profile = {
  name, nameReal, title, subtitle, summary,
  email, phone, location, birthday, availability,
  avatarInitials, currentFocus, sitePosition, domain,
  homepage, zhihu, github,
  resumePdf, resumePdfDirect, portfolioPdf
}

// 教育经历
education: { school, badge, degree, period }[]

// 工作经历
experiences: { company, department, role, period, highlights: string[] }[]

// 技能
resumeSkills: { category, items: string[] }[]

// 项目分类（3个分类）
projectCategories: { id, kicker, label, description }[]
// id 可选值: "game" | "portfolio" | "research"

// 项目列表
activeProjects: {
  slug,           // URL 路径，如 "classic-sponza-urp"
  category,       // 对应 projectCategories.id
  eyebrow,        // 小标签，如 "Rendering"
  status,         // "In Progress" | "Completed" | "Ongoing"
  title,
  summary,        // 一句话简介
  cover,          // 图片路径，如 "/images/icon.jpg"
  tags: string[],
  highlights: string[],  // 技术要点
  links: { label, href }[]  // 底部按钮链接
}[]

// 作品集场景占位（3个）
portfolioSceneSets: { title, meta, description }[]

// 作品集高亮列表
portfolioHighlights: { title, description, href }[]

// 技术帖外部链接
writingLinks: { title, href, meta, excerpt, external }[]
```

### writing 内容集合

文件位置：`src/content/writing/*.md`

```yaml
---
title: "笔记标题"
course: "GAMES101 现代计算机图形学入门"  # 相同 course 自动分组
source: "可选，原始来源"                    # 可选
order: 8                                    # 排序，数字越小越靠前
---
```

文件名格式：`序号-课程名-标题.md`（如 `08-games101-0.md`）

### work 内容集合（模板遗留，待清理）

文件位置：`src/content/work/*.md`

```yaml
---
title: "标题"
publishDate: 2019-12-01 00:00:00
img: /assets/stock-2.jpg
img_alt: "图片描述"
description: "一句话描述"
tags: ["Dev", "Branding"]
---
```

> 注意：work 页面和 about 页面目前是 Astro 官方模板内容，尚未个性化。

## 页面与数据源映射

| 页面 | URL | 数据源 | 状态 |
|------|-----|--------|------|
| 首页 | `/` | resume.ts（所有预览组件） | ✅ 个性化 |
| 简历 | `/resume/` | resume.ts | ✅ 个性化 |
| 项目列表 | `/projects/` | resume.ts → activeProjects, projectCategories | ✅ 个性化 |
| 项目详情 | `/projects/[slug]/` | resume.ts → activeProjects | ✅ 个性化（含技术拆解框架） |
| 作品集 | `/portfolio/` | resume.ts → portfolioSceneSets, portfolioHighlights | ✅ 个性化 |
| 技术笔记列表 | `/writing/` | content/writing/*.md | ✅ 个性化 |
| 笔记详情 | `/writing/[slug]/` | content/writing/*.md | ✅ 个性化 |

> About 和 Work 模板页面已删除。

## 遗留文件（不影响构建，不要删除）

- `src/components/*.tsx` — 旧 Next.js React 组件，不被任何 .astro 引用
- `src/app/page.tsx` — 旧 Next.js 入口
- 根目录 `index.html`, `_next/`, `__next.*.txt` — 旧静态导出产物
- `src/lib/projects.ts` — 旧项目数据结构，页面实际用的是 resume.ts 里的 activeProjects

## 关键约束

1. **只改用户要求的内容**，不重构无关代码
2. **构建必须通过**，改完一定要 `npm run build` 验证
3. **不自动提交**，等用户明确说"提交"
4. **图片放对目录**：项目图 → `public/images/projects/`，场景图 → `public/images/portfolio/`
5. **Node 路径**：本机 Node 不在 PATH，需用 `$env:USERPROFILE\.workbuddy\binaries\node\versions\22.12.0`
6. **npm 用 npm.cmd**：PowerShell 执行策略阻止 .ps1，必须用 `npm.cmd` 而非 `npm`
