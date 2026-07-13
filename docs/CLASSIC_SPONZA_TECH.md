# Classic Sponza URP — 技术参考

> 本文档记录 Classic Sponza 项目的完整技术信息，供后续填充技术拆解内容时参考。
> 项目路径：`E:\SceneProject\Unity\Classic-Sponza`

## 项目概述

基于 Unity URP（Universal Render Pipeline），在 Classic Sponza 场景中从零实现 6 个高级渲染特性。每个特性都是独立的 ScriptableRendererFeature + Shader 实现。

## 目录结构

```
Assets/OurFunction/
├── Bloom/          — 泛光
├── Fog/            — 高度雾
├── GTAO/           — 地面真值环境光遮蔽
├── SSR/            — 屏幕空间反射
├── TAA/            — 时域抗锯齿
└── VolumetricLight/ — 体积光
```

## 各特性技术要点

### 1. GTAO (Ground Truth Ambient Oeclusion)

**文件：**
| 文件 | 大小 | 作用 |
|------|------|------|
| `GTAORendererFeature.cs` | 3.91 KB | RendererFeature 入口，管理 Pass 生命周期 |
| `GTAORenderPass.cs` | 18.88 KB | 核心渲染 Pass，Compute Shader 调度 |
| `GTAOComputeShader.compute` | 27.36 KB | Compute Shader，AO 计算 |
| `GTAOCompositePass.cs` | 3.22 KB | 合成 Pass，多反弹 SSDO |
| `GTAOComposite.shader` | 8.29 KB | 合成 Shader |
| `GroundTruthAmbientOcclusion.cs` | 4.32 KB | Volume 组件，参数定义 |

**技术要点：**
- 在 Deferred 路径中，GBuffer 之后、延迟光照之前运行
- 使用 Compute Shader 进行 AO 计算
- 支持 `_ScreenSpaceOcclusionTexture` 供延迟光照采样
- 调试模式：直接输出 AO 到屏幕
- Composite Pass 支持多反弹 SSDO 合成
- 通过 Volume 系统控制参数（`GroundTruthAmbientOcclusion` 组件）

### 2. SSR (Screen Space Reflection)

**文件：**
| 文件 | 大小 | 作用 |
|------|------|------|
| `SSRRenderFeature.cs` | 8.54 KB | RendererFeature + Pass |
| `SSR.shader` | 13.88 KB | 反射追踪 + 合成 |

**技术要点：**
- 基于 Ray Marching 的屏幕空间反射
- Hi-Z mip chain（8 级 mipmap）加速射线步进
- 两种抖动模式：`Dither8x8` / `InterleavedGradient`
- 反射图使用 ARGBHalf 精度
- 支持 Downsample（0 = 全分辨率，1 = 半分辨率）
- 调试视图：`HitMask` / `ReflectedColor`
- 参数：stepStrideLength, maxSteps, minSmoothness, intensity, reflectSky
- 需要 Depth + Normal + MotionVectors 输入

### 3. TAA (Temporal Anti-Aliasing)

**文件：**
| 文件 | 大小 | 作用 |
|------|------|------|
| `TAARenderFeature.cs` | 11.28 KB | RendererFeature + Pass，含 Jitter 注入 |
| `TAA.shader` | 10.65 KB | 历史帧混合 |
| `TAACamera.cs` | 509 B | 相机辅助 |
| `TAAShowcase.cs` | 3.97 KB | Showcase 工具 |

**技术要点：**
- Intel TAA 完整优化版
- Halton 序列（9 点）亚像素抖动
- Jitter 在几何体渲染前注入投影矩阵
- AABB 历史帧收紧（clampScale 参数）
- 速度拒绝（Velocity Rejection）防瞬间传送残影
- 相机静止时可跳过抖动+混合（skipWhenStatic）
- 相机切换检测，自动重置历史帧（Timeline 兼容）
- 分屏调试对比（左=未 TAA，右=TAA 后）
- 调试可视化：MotionVector / DilatedMV / Depth / HistoryFrame
- 需要 Motion + Depth 输入

### 4. Volumetric Light (体积光)

**文件：**
| 文件 | 大小 | 作用 |
|------|------|------|
| `VolumetricLightRenderFeature.cs` | 13.36 KB | RendererFeature + Pass |
| `VolumetricLight.shader` | 11.9 KB | Ray March + Blur + Composite |

**技术要点：**
- 基于 Ray Marching 的体积光
- Henyey-Greenstein 相位函数各向异性散射（anisotropy 参数）
- 高度雾遮罩（heightFogBase + heightFalloff）
- 阴影采样（shadowStrength + shadowBias + jitterStrength）
- 降采样渲染（downsample 参数，默认 2x）
- 双边模糊（blurIterations + blurRadius + depthAwareBlurThreshold）
- 3 个 Pass：RayMarch → Blur → Composite
- 调试视图：SourceCapture / RawLight / BlurredLight
- 需要 Depth 输入
- 参数：intensity, density, anisotropy, maxDistance, rayMarchSteps

### 5. Bloom (泛光)

**文件：**
| 文件 | 大小 | 作用 |
|------|------|------|
| `BloomRenderFeature.cs` | 7.61 KB | RendererFeature + Pass |
| `Bloom.shader` | 4.27 KB | 4 Pass 泛光管线 |

**技术要点：**
- 多级金字塔泛光（Bloom Pyramid）
- 4 个 Pass：Prefilter → Downsample → Upsample → Composite
- 最多 6 级金字塔（MaxPyramidSize）
- 自动根据最小尺寸调整迭代次数（minSize 参数）
- 参数：threshold, softKnee, intensity, scatter, tint
- 降采样参数（downsample，默认 2x）

### 6. Fog (高度雾)

**文件：**
| 文件 | 大小 | 作用 |
|------|------|------|
| `FogFeature.cs` | 6.98 KB | RendererFeature + Pass |
| `HeightFog.shader` | 4.71 KB | 高度雾 Shader |

**技术要点：**
- 后处理高度雾
- 方向光散射（Henyey-Greenstein，scatteringG 参数）
- 天空盒地平线过渡（skyboxZenithFade）
- 近距离淡出（fogStartDistance + fogStartFadeRange）
- 参数：fogColor, fogDensity, maxFogOpacity, fogHeightStart, heightFalloff
- 散射参数：inscatterColor, scatteringG, sunScatterIntensity, inscatterStartDistance
- 需要 Depth 输入
- 仅 Game 相机渲染（Scene View 深度不稳定）

## 网站展示规划

项目详情页 `/projects/classic-sponza-urp/` 的"技术拆解"区域目前留空。后续填充时，建议每个特性一个区块：

```
### GTAO
- 算法原理：...
- 实现细节：...
- 截图/GIF：...

### SSR
- 算法原理：...
- ...
```

## 第三方资源

- `Assets/ClassicSponza/` — Unity 官方 Classic Sponza 场景资源
- `Assets/VolumetricVortex/` — 第三方体积渲染参考（2 个 compute + 1 shader + 1 cs）
