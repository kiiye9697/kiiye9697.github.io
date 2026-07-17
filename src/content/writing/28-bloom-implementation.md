---
title: "Unity URP：Bloom实现"
course: "Classic Sponza Showcase"
source: "Assets/OurFunction/Bloom/"
order: 28
---


> 基于 URP ScriptableRendererFeature 的 Kawase-style 多级降采样 Bloom
> 一共使用4 个 Pass（Prefilter → Downsample × N → Upsample × N → Composite），
> 在低分辨率金字塔中完成阈值提取、Box 滤波下采样、散射上采样和加色合成。
> 包含：`BloomRenderFeature.cs`、`Bloom.shader

## 1. Introduction

### 1.1 传统方案缺陷
### Showcase
Bloom On-Off
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17842775426740.png)
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17842776049117.png)
- **传统方法**：URP 内置 Bloom 使用 1-pass Kawase 或 Unity 原生 PostProcess Stack 的 Mipmap 方案。
  问题所在：
- 第一，**缺少 soft knee 阈值**——硬阈值 `max(brightness - threshold, 0)` 在阈值边缘产生明显的截断 banding，亮物体周围出现硬边光晕；
- 第二，**缺少散射控制**——上采样时简单把低频加到高频上，无法独立控制光晕的"柔度"与"范围"，导致 Bloom 要么太集中要么太发散；
- 第三，**无 HDR 安全 clamp**——极高亮度值（如 `>65504` 的 Inf/NaN）在 Box 滤波和多次 upsample 中会传播污染整张 RT。

### 1.2 解决方法

- **核心机制**：采用完整的 **4-Pass 管线**——Prefilter 用 soft knee 提取超阈值亮度、Downsample 用 Box 4 采样逐级降采样到 `minSize`、Upsample 用 `scatter` 参数控制低频到高频的注入比例、Composite 将 tinted Bloom 加回源图。HDR 值全程被 `SafeHDR` clamp 到 `65504`，soft knee 使用平方 softness 平滑截断。
- **架构**：`BloomRenderFeature` 在 `BeforeRenderingPostProcessing` 注入单个 `BloomPass`，内部管理 `MaxPyramidSize=6` 的降采样/上采样 RT 池，iterations 自适应 `minSize` 约束。

---

## 2. KeyWords

| 关键词 | 简单解释 | 在本实现中的具体职责 |
| :--- | :--- | :--- |
| **Soft Knee Threshold** | 亮度超过 threshold-knee 后渐变截断 | `ApplyThreshold` 中 `softness² * knee` 替代硬截断 |
| **Kawase / Box Downsample** | 4 点 box filter 降采样（非 mipmap 链） | `SampleBox(tex, uv, texelSize, 1.0)` 做 2×2 平均 |
| **Scatter Upsample** | 上采样时用 `scatter` 参数控制低频注入比例 | `FragUpsample` 中 `lerp(high, high+low, scatter)` |
| **HDR Safe Clamp** | 防止 Inf/NaN 在多次滤波中传播 | `SafeHDR(color) = min(color, 65504)` |
| **Pyramid RT Pool** | 预分配 `_Bloom_Down[i]` / `_Bloom_Up[i]` 共 12 个 PropertyToID | 避免每帧重复 `Shader.PropertyToID` 分配 |

---

## 3. Technical Breakdown

### 3.1 Soft Knee 阈值提取 (Pass 0: Prefilter)

硬阈值 `max(brightness - threshold, 0)` 在阈值边缘产生不连续的截断——刚好在阈值以上的像素贡献全量 Bloom，刚好以下的完全消失。Soft knee 在阈值下方引入一个过渡区间 `[threshold - knee, threshold + knee]`（其中 `knee = threshold * softKnee`），用二次 softness 平滑过渡：

```hlsl
half3 ApplyThreshold(half3 color)
{
    half brightness = Luminance(color);                            // BT.709
    half softness   = saturate((brightness - THRESHOLD + KNEE)
                     / max(2.0 * KNEE, 1e-4));                    // [0,1] 过渡
    half soft       = softness * softness * KNEE;                  // 二次平滑
    half contribution = max(brightness - THRESHOLD, soft);
    return color * saturate(contribution / max(brightness, 1e-4));
}
```

- `KNEE = 0` 时 `softness` 退化为阶跃函数，等价于硬阈值
- `KNEE = THRESHOLD * softKnee`（默认 `threshold=1.0, softKnee=0.5` → knee=0.5）：亮度 0.5-1.5 区间平滑过渡
- `softness²` 保证过渡区的一阶导数也连续，避免 banding

Prefilter Pass 同时做一次 Box 4 采样（`SampleBox(radius=1.0)`），在提取阈值前对全分辨率做轻微抗锯齿。

### 3.2 降采样金字塔 (Pass 1: Downsample)

每次降采样将分辨率减半（`width >>= 1, height >>= 1`），用 Box 4 采样做抗锯齿下采样：

```hlsl
half3 SampleBox(tex, samplerTex, uv, texelSize, radius)
{
    float2 d = texelSize * radius;
    // 四个角采样 → 平均
    return (Sample(uv + (-d.x,-d.y)) + Sample(uv + (d.x,-d.y))
          + Sample(uv + (-d.x, d.y)) + Sample(uv + ( d.x, d.y))) * 0.25;
}
```

金字塔级数由 `iterations` 参数控制（1-6），同时受 `minSize` 约束——当降采样后尺寸 < minSize 时自动截断：

```csharp
while (iterations > 1 && (width >> (iterations-1)) < minSize) iterations--;
```

### 3.3 散射上采样 (Pass 2: Upsample)

从最低分辨率逐级上采样回全分辨率。每级从当前低分辨率（`_MainTex` = 上一级结果）上采样，并与同级的降采样高频（`_BloomTex` = pyramidDown[i]）混合：

```hlsl
half4 FragUpsample(Varyings input) : SV_Target
{
    half3 low  = SampleBox(_MainTex, sampler_MainTex, input.uv, texelSize, 1.0);
    half3 high = SAMPLE_TEXTURE2D_X(_BloomTex, sampler_BloomTex, input.uv).rgb;
    return half4(lerp(high, high + low, BLOOM_SCATTER), 1.0);
}
```

`BLOOM_SCATTER`（默认 0.65）是关键参数：
- `scatter = 0`：只保留高频细节（Bloom 集中在亮物体边缘）
- `scatter = 1`：低频全量注入（Bloom 大面积扩散）
- 典型值 0.5-0.7 产生自然的柔光扩散

### 3.4 合成 (Pass 3: Composite)

```hlsl
half4 FragComposite(Varyings input) : SV_Target
{
    half3 source = SAMPLE_TEXTURE2D_X(_MainTex, sampler_MainTex, input.uv).rgb;
    half3 bloom  = SAMPLE_TEXTURE2D_X(_BloomTex, sampler_BloomTex, input.uv).rgb
                 * _BloomTint.rgb;
    return half4(source + bloom * BLOOM_INTENSITY, 1.0);
}
```

- `_BloomTint`：对 Bloom 染色（默认白色，可调为暖黄/冷蓝）
- `BLOOM_INTENSITY`（默认 0.35）：Bloom 强度
- 合成是**加法**（`source + bloom * intensity`），保持原始场景不变

---

## 4. 执行时机与 URP 管线架构

### 4.1 管线插入点

```
═══════════════════════════════════════════════════════════════
URP 一帧

 (1) Depth PrePass → _CameraDepthTexture
 (2) DrawOpaqueObjects / Deferred Lighting → cameraColorTarget
 (3) DrawTransparents / Skybox

 (4) ★ BeforeRenderingPostProcessing ★                  [Bloom Pass]
       │  ┌─ BloomPass.Execute ─────────────────────────┐
       │  │  1. cmd.Blit(source → TempSource)             │  拷贝场景
       │  │  2. Prefilter: Blit(TempSource → pyramidDown[0], Pass0)
       │  │  3. for i=1..iterations-1:
       │  │       Blit(pyramidDown[i-1] → pyramidDown[i], Pass1)  降采样
       │  │  4. for i=iterations-2..0:
       │  │       Blit(lastUp → pyramidUp[i], Pass2)              上采样
       │  │       lastUp = pyramidUp[i]
       │  │  5. Composite: Blit(TempSource → TempOutput, Pass3)
       │  │  6. Blit(TempOutput → source)                         写回
       │  │  7. 释放所有临时 RT
       │  └───────────────────────────────────────────────────────┘

 (5) Post-Processing (Tonemapping 等) → Present
═══════════════════════════════════════════════════════════════
```

> **为什么是 BeforeRenderingPostProcessing**：Bloom 必须在 Tonemapping 之前执行——HDR 域中阈值提取才有意义（LDR 下亮度全部 ≤1，阈值无区分度）。Bloom 之后 Tonemapping 会把 HDR 光晕映射到 LDR 屏幕色域。

### 4.2 RT 与内存

| RT | 分辨率 | 格式 | 用途 |
| :--- | :--- | :--- | :--- |
| `_Bloom_Source` | full² | `cameraTargetDescriptor` | 场景拷贝 |
| `_Bloom_Output` | full² | `cameraTargetDescriptor` | 合成输出 |
| `_Bloom_Down[0]` | full/downsample | `cameraTargetDescriptor` | Prefilter 结果 |
| `_Bloom_Down[1..N-1]` | 逐级 /2 | `cameraTargetDescriptor` | 降采样金字塔 |
| `_Bloom_Up[0..N-2]` | 逐级 *2 | `cameraTargetDescriptor` | 上采样金字塔 |

典型 1080p、downsample=2、iterations=4 时，总计约 8 张 RT，峰值 ~35MB。

---

## 5. 实现细节与关键代码

### 5.1 BloomRenderFeature + BloomPass

```csharp
// 仅 Game 相机、Base 渲染
if (cameraData.cameraType != CameraType.Game) return;
if (cameraData.renderType != CameraRenderType.Base) return;

// 自适应 iterations: 确保最小层 ≥ minSize (默认32)
int iterations = Mathf.Clamp(settings.iterations, 1, MaxPyramidSize);
while (iterations > 1 && (width  >> (iterations-1)) < settings.minSize) iterations--;
while (iterations > 1 && (height >> (iterations-1)) < settings.minSize) iterations--;

// 降采样
for (int i = 1; i < iterations; ++i) {
    pyramidDesc.width  >>= 1;
    pyramidDesc.height >>= 1;
    cmd.GetTemporaryRT(pyramidDown[i], pyramidDesc, FilterMode.Bilinear);
    cmd.SetGlobalTexture(MainTexID, lastDown);
    cmd.Blit(lastDown, pyramidDown[i], material, PassDownsample);
    lastDown = pyramidDown[i];
}

// 上采样 (逆序)
int lastUp = lastDown;
for (int i = iterations - 2; i >= 0; --i) {
    cmd.GetTemporaryRT(pyramidUp[i], upDesc, FilterMode.Bilinear);
    cmd.SetGlobalTexture(MainTexID, lastUp);
    cmd.SetGlobalTexture(BloomTexID, pyramidDown[i]);  // 同级高频
    cmd.Blit(lastUp, pyramidUp[i], material, PassUpsample);
    lastUp = pyramidUp[i];
}
```

### 5.2 参数一览

| 参数 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `threshold` | 1.0 | 亮度阈值（BT.709），超过此值才贡献 Bloom |
| `softKnee` | 0.5 | 阈值柔和度，0=硬截断，1=最大柔和 |
| `intensity` | 0.35 | Bloom 最终强度 |
| `scatter` | 0.65 | 上采样散射比例，0=仅高频，1=全量扩散 |
| `tint` | white | Bloom 色调 |
| `iterations` | 4 | 金字塔级数（1-6） |
| `downsample` | 2 | 起始降采样倍数 |
| `minSize` | 32 | 最小层分辨率，防止过度降采样 |

---

## 6. References

1. **Masaki Kawase.** "Frame Buffer Postprocessing Effects in DOUBLE-S.T.E.A.L (Wreckless)." *Game Developers Conference 2003*. — Kawase Bloom 原始方案，多级降采样 + 上采样混合范式。
2. **Unity Technologies.** "URP Scriptable Renderer Features." *Unity Manual*. — `ScriptableRenderPass` + `BeforeRenderingPostProcessing` 注入方式。
3. **Jorge Jimenez.** "Next Generation Post Processing in Call of Duty: Advanced Warfare." *SIGGRAPH 2014 Advances in Real-Time Rendering*. — HDR Bloom 管线与 soft knee 阈值参考。
4. [(25 封私信) unity URP bloom 移动端性能优化 - 知乎](https://zhuanlan.zhihu.com/p/531689260)
