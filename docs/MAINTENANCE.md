# 站点维护手册

> 本文档面向项目维护者，记录站点架构、数据流、构建部署流程和常见操作。

## 站点架构

```
kiiye9697.github.io
├── Astro 5 静态站点 (output: "static")
├── KaTeX + remark-math (LaTeX 公式)
├── GitHub Actions CI (Node 22)
└── GitHub Pages 部署
```

## 文件结构

```
src/
├── layouts/
│   └── BaseLayout.astro          # 全局布局：导航 + 页脚 + 背景动画
├── pages/
│   ├── index.astro               # 首页：Hero + 4个预览组件
│   ├── resume.astro              # 简历页
│   ├── portfolio.astro           # 作品集页
│   ├── projects/
│   │   ├── index.astro           # 项目列表（按4个分类）
│   │   └── [slug].astro          # 项目详情页
│   ├── writing.astro             # 技术笔记列表（按课程分组）
│   ├── writing/[slug].astro      # 笔记详情页
│   ├── about.astro               # 关于页（⚠️ 模板内容）
│   ├── work.astro                # Work 列表（⚠️ 模板内容）
│   └── work/[...slug].astro      # Work 详情（⚠️ 模板内容）
├── components/
│   ├── Hero.astro                # 首页 Hero（Liverpool 主题）
│   ├── ResumePreview.astro       # 首页简历预览
│   ├── WritingPreview.astro      # 首页技术帖预览
│   ├── ProjectsPreview.astro     # 首页项目预览
│   ├── PortfolioPreview.astro    # 首页作品集预览
│   ├── SectionHeader.astro       # 区块标题
│   ├── SiteNav.astro             # 顶部导航
│   ├── SiteFooter.astro          # 页脚
│   └── SplashIntro.astro         # 开场动画
├── content/
│   ├── writing/*.md              # 22篇技术笔记
│   └── work/*.md                 # 模板示例内容（待清理）
├── lib/
│   ├── resume.ts                 # ⭐ 核心数据文件（个人信息/项目/技能/经历）
│   ├── slugs.ts                  # URL slug 工具
│   └── projects.ts               # 旧项目数据（已废弃，不用）
├── content.config.ts             # 内容集合 schema（writing）
└── styles/
    └── global.css                # 全局样式

public/
├── images/
│   ├── projects/                 # 项目封面图
│   └── portfolio/                # 场景展示图（3个 SVG 占位）
├── pdfs/                         # 简历 + 作品集 PDF
├── downloads/                    # 下载资源
├── liverbird-crest.png           # Liverpool 队徽
├── liverbird-icon.png            # Liverpool 图标
└── background.jpg, stack.jpg ... # 背景素材
```

## 数据流

### 核心数据源：`src/lib/resume.ts`

这是整个站点最重要的文件。首页的所有预览组件、简历页、项目页、作品集页都从这里读取数据。

```
resume.ts
├── profile              → Hero, ResumePreview, Resume, Footer, BaseLayout
├── education            → ResumePreview, Resume
├── experiences          → Resume
├── resumeSkills         → ResumePreview, Resume
├── activeProjects       → ProjectsPreview, Projects/index, Projects/[slug]
├── projectCategories    → ProjectsPreview, Projects/index
├── portfolioSceneSets   → PortfolioPreview, Portfolio
├── portfolioHighlights  → PortfolioPreview, Portfolio
├── writingLinks         → WritingPreview, Writing
└── siteConfig           → 导航与 Hero 按钮
```

### 内容集合：`src/content/writing/*.md`

技术笔记通过 Astro Content Collections 驱动。

```yaml
# frontmatter schema (定义在 content.config.ts)
title: string        # 必填
course: string       # 必填，相同值自动分组
source: string       # 可选
order: number        # 默认 0，控制排序
```

正文支持：Markdown、LaTeX（`$行内$` / `$$块级$$`）、代码块、图片。

## 构建与部署

### 本地构建

```powershell
# Node 不在系统 PATH，需手动指定
$env:PATH = "$env:USERPROFILE\.workbuddy\binaries\node\versions\22.12.0;$env:PATH"
$env:NODE_ENV = "production"

npm.cmd install          # 安装依赖
npm.cmd run build        # 构建，输出到 dist/
npm.cmd run preview      # 本地预览 (http://127.0.0.1:4321)
```

> PowerShell 执行策略限制：用 `npm.cmd` 而非 `npm`（后者触发 .ps1 被拦截）。

### CI 部署

```
.github/workflows/deploy.yml
触发条件：push 到 main / scrape 工作流完成 / 手动触发
流程：checkout → setup Node 22 → npm ci → astro build → touch dist/.nojekyll → upload artifact → deploy to Pages
```

### 预览服务器

```powershell
# 后台启动
Start-Process -FilePath "npm.cmd" -ArgumentList "run preview -- --host 127.0.0.1 --port 4321" -WindowStyle Hidden
```

## 常见维护操作

### 添加一个新项目

1. 在 `src/lib/resume.ts` → `activeProjects` 数组末尾添加对象
2. 封面图放到 `public/images/projects/`，路径填 `/images/projects/xxx.jpg`
3. 构建 + 预览验证

### 添加一篇技术笔记

1. 在 `src/content/writing/` 创建 `.md` 文件
2. 文件名：`序号-课程名-标题.md`
3. 写 frontmatter（title, course, order）
4. 写正文（支持 Markdown + LaTeX + 代码块）

### 更新简历 PDF

1. 把新 PDF 放到 `public/pdfs/resume.pdf`
2. 代码中引用路径不变（`profile.resumePdfDirect = "/pdfs/resume.pdf"`）

### 更新作品集 PDF

1. 把新 PDF 放到 `public/pdfs/portfolio.pdf`
2. 代码中引用路径不变（`profile.portfolioPdf = "/pdfs/portfolio.pdf"`）

### 修改个人信息

直接改 `src/lib/resume.ts` → `profile` 对象。

## 遗留文件说明

以下文件不影响构建，可安全忽略：

| 文件 | 说明 |
|------|------|
| `src/components/*.tsx` | 旧 Next.js React 组件，不被任何 .astro 引用 |
| `src/app/page.tsx` | 旧 Next.js 入口 |
| 根目录 `index.html` | 旧静态导出产物 |
| `_next/` | 旧 Next.js 静态资源 |
| `__next.*.txt` | 旧导出元数据 |
| `src/lib/projects.ts` | 旧项目数据结构，页面实际用 resume.ts → activeProjects |
| `src/content/work/*.md` | 模板示例内容（bloom-box, h20, markdown-mystery-tour） |
| `src/pages/about.astro` | 模板 Lorem ipsum 内容 |
| `public/assets/` | 模板示例图片（25个文件） |

## 待办清单

- [ ] 替换 About 页面模板内容
- [ ] 清理或替换 Work 页面模板内容
- [ ] 填充 3 个 Scene Set 场景展示图
- [ ] 补充 Dev Track / Course Work 分类的项目
- [ ] 清理遗留 .tsx 文件（可选，不影响构建）
- [ ] 清理根目录 Next.js 导出产物（可选，不影响构建）
