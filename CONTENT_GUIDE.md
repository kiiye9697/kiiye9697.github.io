# 内容维护规范

> 你按这个格式写一个 MD 文件给我，我负责把内容填进代码、放好图片视频、提交到 GitHub。
> 不需要你碰任何代码，只需在 MD 里按下面格式写内容即可。

---

## 资源存放规则

| 类型 | 存放路径 | 说明 |
|------|----------|------|
| 项目封面图 | `public/images/projects/` | 每个项目一张，建议 1200×800 |
| 场景展示图 | `public/images/portfolio/` | Scene Set 用，建议 1920×1080 |
| 通用图片 | `public/images/` | 其他配图 |
| PDF | `public/pdfs/` | 简历、作品集 PDF |
| 视频 | `public/videos/` | 演示视频（暂无此目录，需要时我创建） |

> 图片直接发给我或放到 workspace 里，我会帮你移到正确位置。
> 视频如果太大（>50MB），建议传到 B 站/YouTube 然后给我链接，站上只放封面图 + 链接。

---

## 一、个人信息 / 简历

**位置**：`src/lib/resume.ts` 里的 `profile`、`education`、`experiences`、`resumeSkills`

你只需提供以下信息，我负责改代码：

```md
## 个人信息
- 姓名：孙浩然
- 方向：综合向技术美术/引擎-渲染开发
- 学校：大连理工大学（985）
- 专业：计算机科学与技术
- 在读时间：2024-2028
- 邮箱：1916954944@qq.com
- 电话：18640144621
- 所在地：China

## 实习/研究经历
### 腾讯科技 · 光子工作室-技术美术实习生
- S工作室：支持和平精英以及3A预研项目
- 时间：2026.05 - 2026.08
- 支持类三角洲的端手一体地形方案，解决weightmap-splatmap-idmap工作流中的算法损失问题；
- 整理项目中材质分类评估性能开销，根据预算优化材质

## 技能
- 语言： C#\C++,Python,GLSL/HLSL
- 使用引擎：Unity/Unreal，mitsuba
- DCC： Houdini
```

---

## 二、项目（Projects 页）

**位置**：`src/lib/resume.ts` 里的 `activeProjects` 数组

每个项目需要以下字段：

```md
## 项目
### 项目名称：Deep Shield
- 分类：ai-work（可选：development / coursework / ai-work / research）
- 状态：In Progress（可选：In Progress / Completed / Ongoing）
- 一句话简介：围绕伪造检测与模型接入整理的项目入口
- 封面图：deep-shield.jpg（把图片发给我，我放到 public/images/projects/）
- 标签：AI, Detection, Python
- 要点1：用于承接伪造检测、推理结果展示与实验过程整理。
- 要点2：后续可补充模型结构图、输入输出案例与部署方式。
- 要点3：适合在作品集中作为 AI 方向代表项目重点展开。
- 链接：GitHub https://xxx / 演示视频 https://xxx（可选）
```

四个分类对应关系：
| 分类 ID | 页面标签 | 含义 |
|---------|----------|------|
| `development` | Dev Track | 工具、流程、系统、工程侧项目 |
| `coursework` | Course Work | 学校作业 / 课设 |
| `ai-work` | AI Work | AIGC、检测、模型接入 |
| `research` | Research | 论文 / 技术研究 |

---

## 三、作品集（Portfolio 页）

**位置**：`src/lib/resume.ts` 里的 `portfolioSceneSets`

三个 Scene Set 占位，每个可以填：

```md
## 作品集场景
### Scene Set 01 - Hero Environment
- 标题：主场景名称（比如"UE5 地形渲染"）
- 封面图：scene-01.jpg（发给我，我放到 public/images/portfolio/）
- 描述：一句话说明这个场景做了什么
- 可选：视频链接 / 更多截图说明

### Scene Set 02 - Lookdev Breakdown
- 同上

### Scene Set 03 - Workflow / Video
- 同上
```

**PDF 作品集**：如果要替换 PDF，把新 PDF 发给我，我放到 `public/pdfs/portfolio.pdf`。

---

## 四、技术笔记（Writing 页）

**位置**：`src/content/writing/` 目录下放 `.md` 文件

每篇笔记的格式：

```md
---
title: "笔记标题"
course: "GAMES101 现代计算机图形学入门"
source: "可选，原始来源链接"
order: 8
---

# 正文标题

正文内容，支持：
- Markdown 格式
- LaTeX 公式（$行内$ 或 $$块级$$）
- 代码块 ```cpp ... ```
- 图片：![描述](图片URL)
```

- `order` 控制排序，数字越小越靠前
- `course` 相同的笔记会自动分组
- 文件名格式建议：`01-课程名-序号-标题.md`

如果要加新笔记，直接把 MD 内容发给我，我负责创建文件。

---

## 五、About 页

**位置**：`src/pages/about.astro`

目前是模板 Lorem ipsum，需要替换。你提供：

```md
## About
### Background
2-3 段自我介绍（你是谁、在做什么、关注什么方向）

### Education
教育经历简述

### Skills
技能概览

### 配图
about-me.jpg（可选，发给我）
```

---

## 六、Work 页

**位置**：`src/content/work/` 目录 + `src/pages/work.astro`

目前是模板示例（bloom-box / h20 / markdown-mystery-tour），有两个选择：

1. **删除**：如果不需要这个页面，告诉我，我把整个 work 相关文件删掉
2. **替换**：如果要用，按下面格式提供内容

```md
## Work
### 文章/项目标题
- 发布日期：2024-06-01
- 封面图：xxx.jpg（可选）
- 描述：一句话说明
- 标签：Dev, Rendering
- 正文：（Markdown 内容）
```

---

## 快速参考：你写 MD 时

直接在一个 MD 文件里按 `## 模块名` 分段，写你要加/改的内容。比如：

```md
## 项目
### 项目名称：XXX
- 分类：development
- 状态：Completed
- 简介：xxx
- 封面图：（见附件 xxx.jpg）
- 标签：A, B, C
- 要点1：xxx
- 要点2：xxx
- 要点3：xxx

## 作品集
### Scene Set 01
- 标题：xxx
- 封面图：（见附件 scene-01.jpg）
- 描述：xxx

## 技术笔记
（直接贴 MD 正文，带 frontmatter）
```

写完发给我，我负责：
1. 改代码（`resume.ts` / `.astro` 文件）
2. 放图片到正确目录
3. 本地构建验证
4. 提交到 GitHub

## 展览式作品集维护

作品集和项目目录共用 `src/components/GalleryCollection.astro`；作品布局在 `src/styles/gallery.css`，ECHO 风格覆盖在 `src/styles/echo.css`。共享导航、背景和主题色统一为黑绿；笔记与编辑器保留原布局，编辑器的浅色预览区继续使用深色正文。

事实内容仍在 `src/lib/resume.ts` 的 `activeProjects`；展示顺序和方式在 `src/lib/gallery.ts`：
- `featured`：已有真实作品图的重点作品；封面必须是对应项目的真实图像。
- `study`：以文字目录展示研究/工具，不把通用占位 SVG 当作作品图。
- `upcoming`：没有确定项目材料时，只展示无链接的留白；可增删，不限定数量，不据此生成项目详情。

`displayMode` 不代表完成状态；项目状态沿用事实数据 `status`。新增项目后默认进入研究文字目录；如有正式视觉材料，可在配置中改为重点展示。未来命名作品需要先在 `activeProjects` 写入已确认资料，不要用虚构成果填充页面。

## ECHO：四类内容的维护

- 作品 `/portfolio/`：真实项目仍在 `src/lib/resume.ts`，展示排序/分组在 `src/lib/gallery.ts`；详情 `/projects/[slug]/`，旧项目目录保留。封面保留原色，不在站点层面套绿色滤镜。
- 技术帖 `/writing/`：继续用 `src/content/writing/*.md`，本机编辑器 `/editor/` 保持原有发布包流程。
- 个人画廊 `/gallery/`：现实地点与游戏世界，独立于作品。三个预留主题在 `src/lib/places.ts`，仅表示计划，不表示已到访。不要给预留项虚构日期、图片或详情链接。
- 碎碎念 `/echoes/`：`src/content/echoes/*.md`，独立短日志，按日期倒序，在列表内直接展示正文。首页自动读取最近两条。

画廊正式收录时，添加 `src/content/places/<stable-slug>.md`：

```yaml
---
title: 实际主题名称
slug: stable-slug
category: travel # 或 game
draft: true
date: 2026-10-06 # 可省略；只填真实收录日期
cover: /images/places/your-image.webp
alt: 图片内容的准确描述
source: 自摄 / 自行截取 / 原始来源 URL
credit: 作者及必要的授权信息
---
这里写真实的地点或游戏画面说明。
```

碎碎念 Markdown frontmatter：`date: 真实日期`、`draft: true`，可选 `title` 和 `slug`。正文就是短日志。画廊与碎碎念 `draft` 默认 `true`，确认公开后显式改为 `false`；草稿不会生成页面或出现在首页/列表。slug 发布后保持稳定。画廊正式内容的图片、替代文本、来源和署名是必填字段。发布对应主题后，从 `reservedPlaces` 移除该主题即可，不要同时保留已发布与预留展位。所有示例只放在文档，不会进入页面。

样式：`src/styles/echo.css` 是 ECHO 黑绿覆盖层；原 `gallery.css` 保留作品布局。作品页的回声环在 `EchoSignal.astro`，离屏/后台暂停，减少动态效果时静止。不要改动已验证的 `page-dissolve.js` 电影切换来添加装饰动画。

验证：`npm run build`，`npm run test:site`。`tests/immersive-gallery.spec.ts` 保存桌面、390px、320px截图到仓库外 `../../outputs/echo-*.png`。

注意：本机编辑器目前只发布技术帖（writing）。画廊与碎碎念请按上述本地 Markdown 文件工作流维护；编辑器不支持这两个集合。可省略 `draft` 保持私有草稿（默认 true），公开必须显式写 `draft: false`。

内容兼容：`astro.config.mjs` 开启 `legacy.collections`，所有 `type: content` 集合通过 `src/content/config.ts` 重新导出同一份 schema。未收录到集合的简历草稿保存在 `docs/resume-draft.md`。`tests/content-collections.spec.ts` 验证实际生产构建中的公开/草稿隔离、临时内容清理，以及全部 29 篇真实技术帖路由。


## 首页介绍与展柜

首页 `src/pages/index.astro` 按个人介绍、经历（`#experience`）、画廊（`#gallery`）、技术帖（`#articles`）排列；事实资料继续从 `src/lib/resume.ts` 读取。首页布局在 `src/styles/home-editorial.css`，展柜组件为 `GlassShowcase.astro`，流体预览组件为 `VortexShowcase.astro`。

首页实验配置在 `src/lib/experiments.ts`，进入页面随机展示一个实验，Roll 切换到另一个；下方仅展示英文实验名。以下三个真实本机素材均来自 `C:\Users\sunha\Documents\ChatGPT\学校工作`，来源参数保留在各自相邻同名 JSON：

- `TURBULENT PLUME`：`jet_charcoal_luminous_preview/jet_p2p.mp4`。
- `VORTEX COLLISION`：`collision_viscous_mono_pcg16_720.mp4`。
- `VORTEX LEAPFROGGING`：`leapfrog_torus_dye_32m_9x_1100x112_full.mp4`。

网页使用 `public/media/experiment-{smoke,collision,leapfrog}.mp4` 副本及同前缀 `-poster.png`，不依赖本机绝对路径。这些是已有 CUDA 流体实验的预渲染结果，不是浏览器内实时求解；替换时保留来源记录和有效静态预览，不将定性重连近似描述为精确黏性流体求解。禁用 JavaScript 时保留首个实验静态图和标题，Roll 控件隐藏；减少动态效果时保留静态预览，可主动播放。

实验只属于首页个人介绍，不放进个人画廊。首页玻璃展柜当前仅有 `src/lib/places.ts` 的三个地点/游戏预留主题；它们表示待收录内容，不能把预留展位当作已完成作品。编辑器及技术帖发布流程保持不变。
