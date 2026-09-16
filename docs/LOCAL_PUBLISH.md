# 本地写作与发布

需要 Node.js 22.9+、Git，以及已有仓库推送权限。

首次使用：

```powershell
git clone https://github.com/kiiye9697/kiiye9697.github.io.git
cd kiiye9697.github.io
npm ci
npm run dev -- --host 127.0.0.1
```

打开终端给出的地址下的 `/editor/`。编辑器支持 Markdown / ZIP 导入、自定义分类、图片插入、本机草稿恢复。导入 MD 后，可用“添加图片”选择附件，匹配相对路径的同名图片；不同文件夹中的同名图片请通过 ZIP 导入。

“导出发布包”会下载包含 MD 和实际图片的 ZIP。“下载 Markdown”仅包含文本。草稿与图片存储在当前浏览器、当前站点的 IndexedDB 中；更换端口或浏览器不会共享草稿，清除站点数据会删除草稿。

先检查发布包，不写入任何文件：

```powershell
npm run note:publish -- C:\Notes\my-note.zip --dry-run
```

本地归档并构建，暂不推送：

```powershell
npm run note:publish -- C:\Notes\my-note.zip
```

也可以传入普通 MD，图片从该 MD 所在目录按相对路径读取。支持标准图片和引用式图片。外部 HTTP 图片原样保留，不会自动下载备份；要有本地备份，应导入图片附件。HTML 内嵌图片不参与自动归档，建议改用 Markdown 图片语法。

完整发布（在干净仓库中执行）：

```powershell
npm run note:publish -- C:\Notes\my-note.zip --push
```

流程为快进拉取、整理文章与图片、构建、只提交本次文件、推送。沿用仓库 GitHub Pages 工作流，实际部署结果以 GitHub Actions 为准。脚本不会自动提交工作区已有修改。若先完成了本地导入，应检查并提交这些修改，再 `git push`，或提交后使用 `--overwrite --push` 更新同一篇文章。

- 文章：`src/content/writing/<slug>.md`
- 图片：`public/notes/<slug>/<内容哈希>.<扩展名>`
- 默认 slug 来自 MD 文件名，可用 `--slug my-note` 指定。
- 同名文章默认拒绝覆盖，显式加 `--overwrite` 才更新。
- 构建失败会恢复本次写入的文件；推送失败会保留已经创建的提交，以便重试 `git push`。
- 图片不主动删除，避免旧文章或历史提交断图。

## 图床

在仓库根目录的 `.env.local` 配置下面两个环境变量（该文件已被 Git 忽略）：

```dotenv
OSS_ACCESS_KEY_ID=your-key-id
OSS_ACCESS_KEY_SECRET=your-key-secret
```

图床配置集中在 `src/lib/image-host.json`，默认使用现有的 `kiiyeblog` / `oss-cn-beijing`。上传对象路径为 `notes/<slug>/<内容哈希>.<扩展名>`。配置凭据后自动上传；无凭据、上传失败或使用 `--local-only` 时，文章使用站内图片。

图床上传成功的图片仍保留仓库副本。读者浏览时优先图床，收到加载错误后切到 `/notes/...`；长时间挂起的请求需要等待浏览器判定失败。Bucket 应允许公开读取图片，密钥应仅授予相应目录的上传权限。脚本不打印密钥，也不会将密钥写入网页。

## 视觉参考

- Liverpool FC 官网：https://www.liverpoolfc.com/
- Codrops 滚动文字动效：https://tympanus.net/codrops/2023/01/18/on-scroll-typography-animations/

保留简洁排版，头图使用安菲尔德实景照片，项目区展示实际作品。字体为本地加载的 Barlow、Noto Sans SC 和 IBM Plex Mono。毛玻璃按访问时的本地时间轻微变化。

站内跳转使用浏览器原生旧、新页面截图，通过种子生成的透明度遮罩消散旧页面像素；不额外叠加图片。首次打开不播放遮罩动画，不支持 View Transitions 的浏览器直接导航，尊重系统减少动态效果设置。另保留滚动入场、背景视差和阅读进度。

头图：Yurificacion，[Anfield stadium panorama](https://commons.wikimedia.org/wiki/File:Anfield_stadium_(Liverpool)_panorama_view_from_main_stand.jpg)，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。原文件保存在 `public/images/anfield-panorama.jpg`，网页裁切显示并通过 CSS 调整亮度；照片及其展示调整沿用该许可，页脚附署名。
