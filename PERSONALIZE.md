# 把这个模板改成你的个人主页

这个仓库现在已经是你的主页仓库：

- `origin`: `https://github.com/kiiye9697/kiiye9697.github.io.git`
- `upstream`: `https://github.com/LandingW/LandingW.github.io.git`

也就是说，fork 和接入模板这一步已经完成。接下来你主要是替换内容。

## 你真正需要改的文件

### 1. 基本信息

编辑 [src/lib/resume.ts](C:\Users\kiiye\Desktop\Git\kiiye9697.github.io\src\lib\resume.ts)

这一份文件控制了整站大部分内容：

- `siteConfig`: 顶部导航、首页按钮、文章数量
- `profile`: 姓名、职位、简介、邮箱、地点
- `skills`: 技能标签
- `socialLinks`: GitHub、邮箱、知乎、LinkedIn、其他链接
- `experiences`: 教育经历、实习、工作、研究方向
- `portfolios`: 作品集卡片
- `projects`: 项目卡片

优先把下面这些字段先改掉：

- `profile.name`
- `profile.title`
- `profile.subtitle`
- `profile.summary`
- `profile.location`
- `profile.domain`
- `profile.email`
- `socialLinks`
- `experiences`
- `projects`

## 素材放哪里

### 2. 作品封面图

放到：

- `public/images/portfolio/`
- `public/images/projects/`

然后在 `src/lib/resume.ts` 里把路径改成类似：

```ts
cover: "/images/portfolio/my-portfolio-cover.png"
```

### 3. PDF 简历 / 作品集

放到：

- `public/pdfs/`

然后在 `portfolios` 里填写：

```ts
previewPdf: "/pdfs/my-portfolio.pdf",
pdf: "/pdfs/my-portfolio.pdf",
```

### 4. PPT / Slides

放到：

- `public/slides/`

然后在 `portfolios` 里填写：

```ts
slides: "/slides/my-deck.pptx",
```

## 页面结构对应关系

- 首页大标题、状态、邮箱、地点：
  [src/components/HeroSection.tsx](C:\Users\kiiye\Desktop\Git\kiiye9697.github.io\src\components\HeroSection.tsx)
- About / Skills / Links / Experience / Portfolio / Projects / Posts：
  [src/app/page.tsx](C:\Users\kiiye\Desktop\Git\kiiye9697.github.io\src\app\page.tsx)

正常情况下你不需要改组件，只改 `src/lib/resume.ts` 和 `public/` 里的素材就够了。

## 如果你想保留知乎文章同步

文章数据来自：

- [data/articles.json](C:\Users\kiiye\Desktop\Git\kiiye9697.github.io\data\articles.json)

自动同步脚本和工作流在：

- [scripts/scrape_zhihu.py](C:\Users\kiiye\Desktop\Git\kiiye9697.github.io\scripts\scrape_zhihu.py)
- [.github/workflows/scrape.yml](C:\Users\kiiye\Desktop\Git\kiiye9697.github.io\.github\workflows\scrape.yml)

如果继续使用知乎同步，你需要在 GitHub 仓库里配置：

- `Settings`
- `Secrets and variables`
- `Actions`
- 新建 secret：`ZHIHU_COOKIE`

如果你不打算展示知乎文章，有两种做法：

1. 保留现状，不继续同步，页面会显示现有静态数据。
2. 后面我再帮你把 `Posts` 区块改成博客、笔记或精选项目。

## 如何本地预览

```bash
npm install
npm run dev
```

打开本地地址后，边改 `src/lib/resume.ts` 边刷新页面即可。

## 如何发布到 GitHub Pages

这个仓库已经配置了 GitHub Pages 工作流：

- [.github/workflows/deploy.yml](C:\Users\kiiye\Desktop\Git\kiiye9697.github.io\.github\workflows\deploy.yml)

只要你把改动 push 到 `main` 分支，GitHub Actions 就会自动构建并发布。

仓库 Pages 设置建议确认一次：

1. 打开 GitHub 仓库设置
2. 进入 `Pages`
3. `Source` 选择 `GitHub Actions`

## 推荐改造顺序

1. 先改 `profile`
2. 再改 `socialLinks`
3. 再改 `experiences`
4. 再改 `projects`
5. 最后替换 `portfolio` 的封面图、PDF、PPT

## 你下一步最省事的做法

先把下面这批信息整理给我，我可以直接帮你替换进页面：

- 姓名
- 一句话头衔
- 个人简介
- 城市
- 邮箱
- GitHub / LinkedIn / 知乎 / 其他链接
- 3 段经历
- 3 个项目
- 3 组作品集素材名称
