---
title: "NTC：材质纹理组的训练、解码与 Unity 接入"
course: "图形工程 · 神经纹理压缩"
source: "https://research.nvidia.com/labs/rtr/neural_texture_compression/"
order: 31
---

这个项目把同一材质的颜色、法线和表面参数压缩成一份神经纹理，在 Unity URP 的材质纹理访问处解码。离线训练沿用 NVIDIA RTXNTC，Unity 插件负责烘焙组织、资产绑定、GPU 资源、过滤、PBR 通道还原和资源回收。

[同机位 A/B 与贴图示例](/ntc/)提供画面和数据的交互查看；[工程源码](https://github.com/kiiye9697/NTCinUnity)包含插件、烘焙窗口和展示工具。本文说明它们之间的数据流，以及一次纹理访问实际经过的代码。

## 从原始贴图到运行时材质

```text
Unity 材质及贴图
  → 收集通道、颜色空间和采样设置
  → PNG + manifest：明确每张图的通道语义
  → RTXNTC CLI：共同优化 latent 网格与解码网络
  → .ntc：mip 映射、latent、INT8 权重、scale、bias
  → 模型校验与 GPU 资源创建
  → 纹理组资产 + Renderer/材质槽绑定
  → 材质访问入口：解码、过滤、组装 SurfaceData
  → URP 光照、阴影和后处理
```

输入按**材质组**组织。BaseColor 的 RGB 按源贴图的 sRGB 设置处理；Normal、Metallic、Smoothness 和 AO 作为数值通道处理。URP 的 MetallicGlossMap 从 R 取金属度、A 取光滑度，OcclusionMap 从 G 取 AO。若材质使用 BaseMap alpha 存光滑度，绑定时保留这一约定，避免把它同时解释为透明度。

烘焙会保留 alpha，包括带调色板透明度的 PNG，以及第四个分量标记为 RGBX 的部分 TIFF。通道提取完成后，manifest 写入 `channelSwizzle`、`isSRGB`、`semantics` 和可选的 `lossFunctionScale`，让训练输入与 Unity 的材质含义一致。

纹理组用源材质的 GUID 与 local ID 建立身份，场景保存 Renderer 和材质槽的资产引用。移动资源文件后仍可找到对应组。每组还保存原材质的恢复路径、Direct 材质模板和各贴图的 wrap、filter、aniso、mip bias；UV 变换沿用 URP/Lit 共用 BaseMap ST 的约定。

## 训练在优化什么

NTC 为每组纹理拟合一份 latent 网格和小型网络。训练样本包含 texel 位置、mip 和对应的目标通道；网络从低分辨率特征和位置编码恢复这些通道。多张贴图共享表示，利用同一表面上颜色、法线和材质参数之间的相关性。这个过程针对当前纹理组拟合，Unity 运行时只执行解码。

烘焙窗口当前的参数如下。

| 参数 | 数值 | 在链路中的作用 |
| --- | ---: | --- |
| Training steps | 100,000 | CLI 的训练步数 |
| Bits per pixel | 16 | 整组纹理的目标表示预算，由 SDK 选择对应网格配置 |
| Metalness loss scale | 24 | 写入金属度输入的损失权重 |
| Smoothness loss scale | 16 | 写入光滑度或粗糙度输入的损失权重 |
| Generate mips | 开启 | 训练并保存 mip 链的映射 |
| GDeflate | 关闭 | 输出 Unity 当前容器读取路径支持的数据 |

每次新烘焙会在本地保存参数、manifest、训练日志，以及输入 PNG、CLI 和输出 NTC 的 SHA-256，按稳定 ID 和训练任务分目录留存。

金属度与光滑度的权重通过反向传播作用于训练：回归内核把对应通道误差的梯度乘以 `lossFunctionScale`。日志里的 PSNR 来自重建统计，与这个加权梯度目标分开解读。它们的误差会直接影响高光和材质分界，不能仅凭 BaseColor 的重建效果决定参数。

烘焙工具调用形式为：

```text
ntc-cli --loadManifest manifest.json -g -c -S 100000 -b 16 --gdeflate off -D -o material.ntc
```

未在窗口单独覆盖的参数来自配套 SDK：网络学习率 0.005、网格学习率 0.1、batch 上限 64 KPixels、randomSeed 0、stableTraining false。实际 batch 还受当前纹理像素数限制。学习率采用 cosine schedule；配套实现以 95% 步数作为 latent 冻结阈值，以 96% 和 98% 作为 FP8、INT8 细化阈值，Unity 读取其中受支持的 INT8 表示。对应代码见 [SDK 的训练循环](https://github.com/NVIDIA-RTX/RTXNTC-Library/blob/7ab602cb9b42ee3856e63c7a6b5e9575af051a4c/src/TextureSet.cpp) 和 [训练参数定义](https://github.com/NVIDIA-RTX/RTXNTC-Library/blob/7ab602cb9b42ee3856e63c7a6b5e9575af051a4c/include/libntc/ntc.h)。

已有两份历史训练日志各记录 100 个检查点，均训练到 100,000 步：SponzaBricks 最终记录的 PSNR 为 51.37 dB，MetalPlates013 为 46.50 dB。日志没有保存完整学习率、seed 与通道权重，因此这些曲线作为独立的训练案例保存，不与当前场景的 24 个绑定组一一对应。

![两组历史训练的 PSNR 与归一化重建误差](https://oss.kiiye9697.cn/portfolio/ntc/c958b05d09af2f87/training-curves.svg)

曲线中的 MSE 用 `10^(-PSNR/10)` 从日志 PSNR 换算，表示归一化重建误差；原始优化器的加权 loss 没有记录。参数表、原始检查点和图表数据在页面的数据下载中保留。

## 解码器与过滤

当前 Unity 解码器读取的模型为 `48 → 64 → 48 → 32 → 16`，使用 RowMajor INT8 权重、每层 scale/bias 和 HGELUClamp 激活。创建 GPU 资源前检查拓扑、布局、通道数和容器编码，避免把不匹配的模型送入固定尺寸的 Shader。

一次 texel 访问经过以下步骤：

1. 从目标图像 mip 的描述找到 `neuralMip`、位置缩放和位置 LOD。
2. 在 `neuralMip` 与下一层读取 latent 特征，合并为 32 个输入。
3. 加入多频位置编码和 LOD，形成 48 个网络输入。
4. 依次执行四层网络，并在隐藏层复现量化与 HGELUClamp。
5. 返回 16 个输出槽，再按布局取出材质需要的通道。

INT8 描述的是权重存储与隐藏层的数值约定。当前可移植 HLSL 路径把 INT8 权重展开成 float 做点积，**没有接入 Tensor Core 或 cooperative vector 指令**。

`LoadMaterialTexel` 对应显式 texel/mip 访问，一次推理返回整组通道。`SampleMaterialTextures` 在其外处理过滤、颜色空间与材质语义，返回 `NtcMaterialSamples`。因此双线性过滤需要重建邻近四个 texel；三线性还需要两个 mip。各向异性会进一步增加采样次数。采样约定相同的 BaseColor、Normal、Mask、AO 共用一次过滤结果，约定不同的贴图分别访问。

过滤循环目前共用一个解码调用点，避免为每个 corner、mip 和材质角色重复展开整张网络。它减少了生成代码的重复和首次驱动编译负担；稳态帧耗仍取决于覆盖像素、过滤次数、网络实现及参与的 pass。

latent 在支持采样与线性过滤时使用 BGRA4 16-bit 存储，否则展开成 RGBA32。展开只改变 GPU 存储，每个 4-bit 值按相同特征顺序还原。运行时显存应按实际创建的格式统计，不能直接用 `.ntc` 文件大小替代。

## NTC 具体接在哪里

Forward 路径的调用关系是：

```text
NtcLitDirect_URP.shader / NtcForward
  → InitializeStandardLitSurfaceData
    → SampleMaterialTextures(uv, ddx(uv), ddy(uv))
      → NtcSampleFiltered
        → LoadMaterialTexel
          → NtcSampleTextureSet
            → NtcPrepareNetworkInputs + NtcEvaluateLayer0…3
  → InitializeInputData
  → UniversalFragmentPBR
  → Fog 与后续后处理
```

NTC 替换的是**材质纹理读取与还原**，之后仍由 URP 计算 PBR 光照。BaseColor tint、法线强度、Metallic、Smoothness、AO 强度及相应材质开关继续作用于重建结果。

Shader 还提供 ShadowCaster、DepthOnly、DepthNormals。普通不透明材质的 DepthOnly 与 ShadowCaster 不需要解码纹理；Alpha Clip 需要读取 alpha 决定裁剪，DepthNormals 需要还原切线空间法线。评估成本时需要把这些 pass 一起计入。

| 源码入口 | 负责的工作 |
| --- | --- |
| [NtcBakeWindow](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Editor/NtcBakeWindow.cs) | 提取输入、生成 manifest、启动训练队列 |
| [NtcTextureSetAsset](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Runtime/NtcTextureSetAsset.cs) | 组身份、模板、恢复路径与采样设置 |
| [NtcContainerReader](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Runtime/NtcContainerReader.cs) / [NtcAssetBuilder](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Runtime/NtcAssetBuilder.cs) | 读取容器、校验模型、上传 latent 和权重 |
| [NtcMaterialSampling.cs](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Runtime/NtcMaterialSampling.cs) | 绑定 GPU 数据与 URP 材质参数 |
| [NtcMaterialSampling.hlsl](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Shaders/NtcMaterialSampling.hlsl) | 统一访问、过滤和通道组装 |
| [NtcInference.hlsl](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Shaders/NtcInference.hlsl) | 特征采样、位置编码、固定网络推理 |
| [NtcLitDirect_URP.shader](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Shaders/NtcLitDirect_URP.shader) | 将纹理组接入 SurfaceData 和 URP 各 pass |
| [NtcSceneController](https://github.com/kiiye9697/NTCinUnity/blob/0439050/unity-plugin/Runtime/NtcSceneController.cs) | 模式切换、组生命周期与原材质恢复 |

## 四种运行方式与内存生命周期

| 模式 | 解码时机 | 常驻内容 |
| --- | --- | --- |
| Original | 普通纹理采样 | 原图与原材质 |
| InferenceOnLoad | 加载后整图 Compute 解码 | 解码后的 PBR 纹理与必要数据 |
| InferenceOnSample | 根据可见性和预算调度 tile Compute 解码 | latent、权重、受预算限制的 tile cache |
| InferenceOnSampleDirect | fragment 访问时直接推理 | latent、权重、回退材质需要的原图 |

Direct 材质准备好后，可解除对应原材质的引用，再调用 `Resources.UnloadUnusedAssets` 回收原图。仍被其他材质使用的共享纹理继续保留。恢复 Original 时先加载恢复材质，确认恢复成功后再替换 Renderer、释放 NTC 资源。

当前 Direct 接入标准 URP/Lit 的不透明与 Alpha Clip Metallic 材质。透明、视差、Specular 工作流、detail、clear coat、纹理 emission 等组使用原材质。Sponza 示例包含 24 组，其中 22 组使用 Direct，2 组保留原材质。

## 画面、插值与测量数据

A/B 页面使用同一路径逐帧导出的两段画面，拖动条只改变两幅画面的可见区域。固定机位向前移动 1.5m，16 秒、30fps；相机、打光、曝光及后处理保持一致。录像用于查看重建效果，帧耗由独立 Player 测量。

通道示例保留输入、重建和差值图，以及逐通道 PSNR。浏览器先加载缩略图，放大时加载无损通道图。图片、视频和原始数据使用内容哈希 URL 通过 OSS/CDN 分发。

![固定亚像素位置的 Point 与 Bilinear 重建误差](https://oss.kiiye9697.cn/portfolio/ntc/e918db3c48fd21ad/interpolation-loss.svg)

插值图固定 mip 0，在 2048 个 texel 位置上扫描 65 个亚像素相位，比较 Point 与 Bilinear 重建相对原图双线性结果的误差；seed 为 20261127，纵向相位固定为 0.37。指标在存储 RGB 的 UNORM8 域计算，用来观察过滤引入的变化。它与训练曲线分别提供重建和采样的证据。

### 固定场景的性能与内存对照

Unity 2021.3.33f1、Windows x64、D3D12、RTX 5080；相机输出为 960×540 的 RenderTexture。固定机位 `(1, 2.1, 7.5)`、Euler `(0, 199, 0)`、FOV 50，使用场景原始光照；展示录像使用前文的日光方案。前后测试包的场景、Shader 和贴图数据相同，仅替换 Runtime 程序集测试容器读取方式，并核对场景资源哈希。

每种配置使用三个独立 Player 进程，每轮预热 60 帧、采样 120 帧，共 360 个样本。关闭 VSync 与目标帧率限制，驱动磁盘缓存沿用本机状态。计时阶段不注入 RenderDoc；截图和读回在采样结束后执行。

| 配置 | 帧间隔 P50 / P95（ms） | 进程显存（MiB） | 进程私有内存（MiB） |
| --- | ---: | ---: | ---: |
| Original | 0.86 / 1.02 | 632.0 | 1029.7 |
| Direct，保留原图 | 170.25 / 202.36 | 953.7 | 1554.7 |
| Direct，卸载原图 | 167.79 / 205.07 | 877.4 | 1468.8 |
| Direct，卸载原图 + 容器按需读取 | 178.83 / 205.52 | 877.5 | 1341.1 |

帧间隔为 Player 连续样本之间的实际墙钟时间，包含调度与 GPU 回压；本次包未返回独立 GPU 时间戳。显存取 Player 内 DXGI local CurrentUsage，私有内存取 Windows PrivateUsage，表中内存为三轮采样后用量的中位数。

![独立 Player 的帧间隔、进程显存与私有内存对照](https://oss.kiiye9697.cn/portfolio/ntc/7f6280bd067da118/performance-comparison.svg)

原图卸载减少约 **76.25MiB 进程显存**。容器按需读取进一步减少约 **127.70MiB 私有内存**、**119.83MiB Working Set**，显存基本不变。上传时只读取选定网络与 latent 的 BufferView，GPU 数据创建后不再持有整份二进制 chunk。

24 份容器、1080 个数据区段的 eager 与按需读取结果逐字节一致。场景前后截图的最大 RGB 字节差为 2/255，与基线重复拍摄的最大差相同；`Original → Direct → Original → Direct` 连续切换完成了资源回收、恢复及实际绘制。

当前 Direct 的整场景帧耗仍高，进程显存也高于 Original。按需读取解决了 CPU 驻留问题，逐 fragment 的网络与过滤路径还需要继续优化。

抓帧单独执行。留存的 Original 帧包含 492 个 draw、8 个 dispatch，Direct 帧包含 482 个 draw、8 个 dispatch；原始 `.rdc` 与运行日志保存在本地。公开附件保留[逐轮结果](https://oss.kiiye9697.cn/portfolio/ntc/54b908fc0bbb49e0/performance-trials.csv)、[逐帧数据](https://oss.kiiye9697.cn/portfolio/ntc/a50969c34ff457d5/performance-frames.csv)、[测量方法](https://oss.kiiye9697.cn/portfolio/ntc/92f22a9683cc6012/performance-method.json)和[前后截图误差](https://oss.kiiye9697.cn/portfolio/ntc/f8883cede98e7e9c/render-comparison.json)。


## 展示与分析工具

| 工具 | 输入与输出 | 用途 |
| --- | --- | --- |
| `NtcBakeWindow` | Unity 材质 → 训练任务与纹理组资产 | 离线数据准备及烘焙 |
| `Prepare-NtcShowcase.ps1` | 插件源码与现有场景 → 可复现的项目配置 | 同步源码、准备绑定和构建输入 |
| `NtcShowcasePresenter` / `Record-NtcShowcase.ps1` | 相同相机路径 → Original、Direct 成对录像 | 实际画面与 A/B |
| `Build-NtcReview.py` | 重建结果 → 通道图、差值和指标 | 检查重建含义和误差 |
| `Export-NtcPortfolio.py` | 本地结果与训练日志 → 公开媒体和 CSV/JSON | 整理技术报告附件 |
| `Run-NtcBenchmark.ps1` | 独立 Player → 帧样本、内存、截图与可选 `.rdc` | 性能与内存对照 |
| `Analyze-NtcCapture.py` | `.rdc` → draw/dispatch 耗时、纹理列表、Shader 反汇编 | 定位具体 GPU 成本 |

## 参考

算法起点是 Vaidyanathan 等人的 SIGGRAPH 2023 论文 [Random-Access Neural Compression of Material Textures](https://research.nvidia.com/labs/rtr/neural_texture_compression/)。论文提出联合压缩材质贴图并支持随机访问的表示；本文的容器、网络布局和量化流程以配套 [NVIDIA RTXNTC](https://github.com/NVIDIA-RTX/RTXNTC) 与 [RTXNTC-Library](https://github.com/NVIDIA-RTX/RTXNTC-Library) 实现为准。

显存采集使用 Windows [IDXGIAdapter3::QueryVideoMemoryInfo](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_4/nf-dxgi1_4-idxgiadapter3-queryvideomemoryinfo) 的进程用量；抓帧分析使用 [RenderDoc](https://github.com/baldurk/renderdoc)。
