# Kiiye9697 Homepage

基于 Astro 的个人主页，用于整理个人主页、技术帖、作品集、简历和项目库。

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

Astro 会生成静态站点到 `dist/`，GitHub Pages workflow 会上传该目录。

## 内容维护

主要内容集中在 `src/lib/resume.ts`：

- `profile`：个人信息、邮箱、GitHub、知乎、简历 PDF、作品集 PDF。
- `navSections`：顶部导航栏目。
- `experiences`、`education`、`resumeSkills`：简历页内容。
- `writingLinks`：技术贴入口。
- `portfolioHighlights`：作品集页入口和说明。
- `projectCategories`：项目分类，目前分为开发项目、学校作业课设、AI work、论文工作。
- `projects`：项目列表和项目详情页数据，新增项目时添加一条带 `slug` 的数据即可生成 `/projects/[slug]/`。

简历后续 Markdown 化的草稿放在 `src/content/resume.md`。

## 目录结构

```text
.github/workflows/
  deploy.yml        # 构建 Astro 并部署到 GitHub Pages
  scrape.yml        # 知乎文章同步脚本
data/
  articles.json     # 文章同步数据，可后续接入 Astro 页面
scripts/
  scrape_zhihu.py   # 知乎爬虫脚本
src/
  components/       # Astro 页面组件
  content/          # 后续 Markdown 内容草稿
  layouts/          # 全站布局
  lib/resume.ts     # 主页内容数据
  pages/            # Astro 路由页面
  styles/global.css # 全局样式
public/
  resume-2028.pdf   # 简历 PDF
  portfolio.pdf     # 作品集 PDF
```
