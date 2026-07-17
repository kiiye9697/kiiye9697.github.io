---
title: "Unity URP：TAA实现"
course: "Classic Sponza Showcase"
source: "Assets/OurFunction/TAA/"
order: 29
---

d# Unity URP：TAA 实现

> 基于 URP ScriptableRendererFeature 的 Intel 风格时域抗锯齿（Temporal Anti-Aliasing），含 Halton 序列亚像素抖动、Motion Vector 膨胀（Dilation）、YCoCg Variance Clipping、速度拒绝（Velocity Rejection）、Catmull-Rom Bicubic 历史采样、Reinhard 亮度压缩、分屏 Debug 对比。
>
> 代码位于项目 `Assets/OurFunction/TAA/`，包含：`TAARenderFeature.cs`、`TAA.shader`、`TAACamera.cs`、`TAAShowcase.cs`。

## 1. Introduction
### Showcase 外链
[TAA_哔哩哔哩_bilibili](https://www.bilibili.com/video/BV14TKn6DEE7/?spm_id_from=333.1387.homepage.video_card.click&vd_source=c8247535d7ff4d8a1c7e86412cffea65)
### 1.1 传统方案缺陷

- **传统方法**：URP 内置 MSAA（硬件）和 FXAA/SMAA（后处理）。
  问题所在：
- 第一，**MSAA 仅抗锯齿几何边缘**——shader 内部的 aliasing（高光闪烁、法线贴图锯齿、parallax 锯齿）完全无法处理；
- 第二，**FXAA/SMAA 单帧处理、缺乏时域累积**——静态画面下无法逼近超采样质量，运动时模糊细节；
- 第三，**无 Jitter 注入机制**——TAA 需要每帧亚像素偏移投影矩阵来获取不同采样位置，URP 没有内建支持。

### 1.2 解决方法

- **核心机制**：**Halton(2,3) 9 帧循环亚像素抖动**注入投影矩阵（`projectionMatrix.m02/m12 += jitter`）→ 物体渲染时产生亚像素偏移 → TAA Pass 用 Motion Vector 反向查找历史帧颜色 → YCoCg Variance Clipping 拒绝失配历史 → 混合。额外包含 Motion Vector Dilation（3×3 最小深度 MV 膨胀防边缘鬼影）和 Velocity Rejection（检测当前/历史 MV 差异，大差异时降权历史防止传送/切镜头残影）。
- **架构**：`TAARendererFeature` 在 `BeforeRenderingPostProcessing` 注入，单例模式支持 `TAAShowcase` 跨程序集调用。分屏 Debug（shader 内置左右分屏对比，无需双相机）。

---

## 2. KeyWords

| 关键词 | 简单解释 | 在本实现中的具体职责 |
| :--- | :--- | :--- |
| **Halton(2,3) 序列** | 低差异准随机序列，9 帧循环覆盖 `[0,1)²` | `s_Halton9[9]` 驱动每帧 `projectionMatrix` 亚像素偏移 |
| **激进逆函数 (Radical Inverse)** | Halton 序列的数学构造，基数展开求逆 | $\Phi_b(n)=\sum a_i/b^{i+1}$ 生成低差异点 |
| **Motion Vector Dilation** | 3×3 邻域取最近深度的 MV，防止边缘采样到背景 MV | `GetDilatedMotionVector` |
| **YCoCg 色彩空间** | Luma-Chroma 去相关变换，比 RGB 统计更紧凑 | `RGBToYCoCg` / `YCoCgToRGB` |
| **Variance Clipping (AABB)** | 邻域均值±γσ 构造 bounding box，射线法 clip 历史 | `ClipAABB` |
| **Velocity Rejection** | 当前 MV 与历史 MV 差异 > threshold 时降权历史 | `disocclusionFactor = saturate(mvDiff/threshold)` |
| **Catmull-Rom Bicubic** | 5-tap 双三次历史采样，负权重锐化抵消模糊 | `SampleHistoryBicubic` |
| **Reinhard Tonemap** | 亮度压缩到 [0,1) 后做统计，防止 HDR 值主导方差 | `Reinhard(c) = c/(1+lum(c))` |

---

## 3. Technical Breakdown

TAA 的本质是**时域超采样**：每帧以不同亚像素位置渲染场景，通过 Motion Vector 把历史帧的颜色重投影到当前帧，混合后等效于多帧超采样。核心挑战是**鬼影（ghosting）**——当历史帧颜色与当前帧不匹配时（物体移动、遮挡变化），混合会产生拖尾残影。本实现的完整算法链路：

```
当前帧颜色 ──┐
             ├─→ 1) MV Dilation → historyUV
历史帧颜色 ──┤   2) Bicubic 采样历史
             │   3) Reinhard 压缩 (HDR→LDR)
             │   4) YCoCg 变换 + 3×3 邻域统计
             │   5) Variance Clipping (AABB Clip)
             │   6) Velocity Rejection (动态 blend)
             │   7) lerp(his, cur, blend)
             │   8) InverseReinhard 恢复 HDR
             └─→ 输出 + 更新历史
```

### 3.1 Halton(2,3) 亚像素抖动注入

#### 3.1.1 时域超采样原理

TAA 的理论依据：如果一个像素在多帧内被以不同亚像素位置采样，那么把这些采样值平均起来，等效于在单个像素内做了**超采样**。假设每帧 jitter 偏移在像素内均匀分布，$N$ 帧累积等效于 $N\times$ SSAA。关键在于：jitter 必须是**低差异序列**（low-discrepancy sequence），而非纯随机——低差异序列在少量样本下更均匀覆盖采样空间，收敛更快。

#### 3.1.2 Halton 序列的数学构造

Halton(b) 序列基于**激进逆函数**（radical inverse）。对于整数 $n$，将其写成基数 $b$ 的展开：

$$
n = \sum_{i=0}^{k} a_i \, b^i, \qquad \Phi_b(n) = \sum_{i=0}^{k} \frac{a_i}{b^{i+1}}
$$

$\Phi_b(n)$ 即为 Halton 序列的第 $n$ 项。本实现使用 **Halton(2,3)** 二维序列（基 2 和基 3），预计算 9 个点：

```csharp
private static readonly Vector2[] s_Halton9 = new Vector2[]
{
    new Vector2(0.5f,    1.0f/3.0f),   // Φ₂(0), Φ₃(0)
    new Vector2(0.25f,   2.0f/3.0f),   // Φ₂(1), Φ₃(1)
    new Vector2(0.75f,   1.0f/9.0f),
    new Vector2(0.125f,  4.0f/9.0f),
    new Vector2(0.625f,  7.0f/9.0f),
    new Vector2(0.375f,  2.0f/9.0f),
    new Vector2(0.875f,  5.0f/9.0f),
    new Vector2(0.0625f, 8.0f/9.0f),
    new Vector2(0.5625f, 1.0f/27.0f),
};
public void AdvanceHalton() { m_HaltonIdx = (m_HaltonIdx + 1) % 9; }
```

9 帧循环是 UE4 的选择（Karis 2014）。基 2（Van der Corput）覆盖 $[0,1)$ 的二分层级，基 3 覆盖三分层级，两者正交组合在 2D 平面均匀分布。

#### 3.1.3 投影矩阵 Jitter 的数学原理

投影矩阵 $M_P$ 的 `m02`（第 0 行第 2 列）和 `m12`（第 1 行第 2 列）控制 NDC 的 X/Y 平移。在齐次裁剪空间中：

$$
\begin{pmatrix} x_{ndc} \\ y_{ndc} \end{pmatrix} = \frac{1}{w_{clip}} \begin{pmatrix} M_{00}\,x + M_{02}\,z + M_{03}\,w \\ M_{11}\,y + M_{12}\,z + M_{13}\,w \end{pmatrix}
$$

令 $z_{view}=1$（近平面），修改 `m02/m12` 等价于在 NDC 空间做亚像素平移。代码将 Halton 值映射为像素偏移再转 NDC：

```csharp
cam.ResetProjectionMatrix();
Matrix4x4 originalProj = cam.projectionMatrix;
Vector2 h = GetCurrentHalton();
// h ∈ [0,1) → (h-0.5) ∈ [-0.5,0.5) → ×jitter×2 ∈ [-jitter, +jitter) 像素
float jx = (h.x - 0.5f) * jitter * 2.0f / cam.pixelWidth;   // 像素 → NDC
float jy = (h.y - 0.5f) * jitter * 2.0f / cam.pixelHeight;

Matrix4x4 jitteredProj = originalProj;
jitteredProj.m02 += jx;        // NDC X 平移
jitteredProj.m12 += jy;        // NDC Y 平移
cam.nonJitteredProjectionMatrix = originalProj;   // 保存原始（供 MV 计算）
cam.projectionMatrix = jitteredProj;              // 注入（所有渲染使用）
```

- `jitter=0.45`：偏移范围 ±0.45 像素。UE4 默认 ≤0.5，过大会导致每帧画面明显晃动
- `cam.nonJitteredProjectionMatrix`：URP 用此矩阵计算**无 jitter 的 Motion Vector**，避免 jitter 污染重投影
- **注入时机关键**：必须在 `AddRenderPasses`（几何体渲染前）注入，而非 `Execute`（Pass 执行时已经渲染完了）

#### 3.1.4 Jitter 与 Motion Vector 的关系

Motion Vector 编码的是"当前帧像素在上一帧的屏幕位置偏移"。URP 的 `_MotionVectorTexture` 使用 `nonJitteredProjectionMatrix` 计算 MV，**不包含 jitter**——因此 TAA Pass 中 `historyUV = uv - motionVec` 得到的是上一帧的**非抖动**位置，历史帧 bicubic 采样在该位置获取亚像素信息。

### 3.2 Motion Vector Dilation

#### 3.2.1 边缘鬼影问题

Motion Vector 纹理每像素存储该像素从上一帧到当前帧的 UV 偏移。但在几何边缘处，前景物体的边缘像素可能在上一帧被背景遮挡（或反之），直接采样中心像素的 MV 可能拿到**背景的 MV**——用背景 MV 重投影前景颜色，会导致前景颜色被拖到错误位置，产生边缘鬼影。

#### 3.2.2 深度优先 Dilation

Dilation 在 3×3 邻域内找**视空间深度最小**（离相机最近）的像素，用它的 MV。前景物体离相机更近，其 MV 更能代表边缘处的真实运动：

```hlsl
float2 GetDilatedMotionVector(float2 uv, float2 texel)
{
    float closestDepth = 100000.0;   // 视空间深度（越小越近）
    float2 dilatedUV = uv;

    [unroll]
    for (int x = -1; x <= 1; ++x) {
        [unroll]
        for (int y = -1; y <= 1; ++y) {
            float2 offsetUV = uv + float2(x, y) * texel;
            float rawDepth = SampleSceneDepth(offsetUV);
            float eyeDepth = LinearEyeDepth(rawDepth, _ZBufferParams);

            if (eyeDepth < closestDepth) {       // 取最近深度
                closestDepth = eyeDepth;
                dilatedUV = offsetUV;
            }
        }
    }
    return SAMPLE_TEXTURE2D_X(_MotionVectorTexture, sampler_MotionVectorTexture, dilatedUV).rg;
}
```

> **为何取最小深度而非最大 MV**：前景物体在边缘处占主导，其运动应被优先采用。取最大 MV（速度最快）会导致背景物体的快速运动"泄漏"到前景边缘。最小深度策略保证前景 MV 被选中。

### 3.3 YCoCg 色彩空间与去相关性

#### 3.3.1 为何不用 RGB

RGB 空间的三个通道高度相关——一个白色像素的 R=G=B=1，方差统计时三个通道同时波动。在 RGB 空间做 AABB clipping，bounding box 会沿 RGB 对角线方向膨胀，导致**过度宽松**的 clip（历史颜色几乎不被拒绝），鬼影抑制效果差。

#### 3.3.2 YCoCg 变换

YCoCg（Luma-Chroma Orange-Green）将亮度（Y）与色度（Co, Cg）分离，去相关性更强：

$$
\begin{pmatrix} Y \\ C_o \\ C_g \end{pmatrix} = \begin{pmatrix} 1/4 & 1/2 & 1/4 \\ 1/2 & 0 & -1/2 \\ -1/4 & 1/2 & -1/4 \end{pmatrix} \begin{pmatrix} R \\ G \\ B \end{pmatrix}
$$

```hlsl
float3 RGBToYCoCg(float3 c)
{
    float Y  =  0.25 * c.r + 0.5 * c.g + 0.25 * c.b;
    float Co =  0.5  * c.r              - 0.5  * c.b;
    float Cg = -0.25 * c.r + 0.5 * c.g - 0.25 * c.b;
    return float3(Y, Co, Cg);
}
float3 YCoCgToRGB(float3 c)
{
    float Y = c.x, Co = c.y, Cg = c.z;
    return float3(Y + Co - Cg, Y + Cg, Y - Co - Cg);
}
```

YCoCg 的优势：Y 通道集中了大部分能量（亮度），Co/Cg 通道能量低且与 Y 不相关。方差统计在 YCoCg 空间更紧凑——bounding box 更贴合邻域实际颜色分布，clip 更精确。

> **与 YCbCr 的区别**：YCbCr 是电视标准的固定变换，YCoCg 是针对 RGB 优化得到的（Co/Cg 可由简单加减计算），在 GPU 上无除法、更快。

### 3.4 Reinhard 亮度压缩

#### 3.4.1 HDR 方差爆炸问题

Variance Clipping 依赖邻域均值和方差。HDR 场景中一个亮度 100.0 的高光像素会让 $\sigma$ 达到 ~30，bounding box 扩展到 `[mean-22, mean+22]`——历史颜色几乎不被 clip，鬼影抑制完全失效。

#### 3.4.2 Reinhard Tonemap

用 Reinhard 函数将 HDR 亮度压缩到 $[0,1)$ 后做统计，混合后再反解压恢复 HDR：

$$
\text{Reinhard}(\mathbf{c}) = \frac{\mathbf{c}}{1 + L(\mathbf{c})}, \qquad \text{InverseReinhard}(\mathbf{c}) = \frac{\mathbf{c}}{1 - L(\mathbf{c})}
$$

其中 $L(\mathbf{c}) = 0.2126\,R + 0.7152\,G + 0.0722\,B$（BT.709 亮度）。

```hlsl
float3 Reinhard(float3 c)        { return c / (1.0 + Luminance(c)); }
float3 InverseReinhard(float3 c)  { return c / (1.0 - Luminance(c)); }
```

数学性质：
- **单调递增**：保持颜色排序，clip 语义不变
- **可逆**：`InverseReinhard(Reinhard(c)) = c`（当 $L < 1$）
- **有界**：`Reinhard(c) ∈ [0,1)`，方差被压缩到合理范围
- **亮度保持**：压缩按亮度缩放，色比不变

### 3.5 Variance Clipping（AABB Clip）

#### 3.5.1 统计学原理

Variance Clipping 假设：**当前帧 3×3 邻域的颜色分布代表了"该像素可能取的合法值范围"**。历史帧颜色如果落在当前帧邻域的统计分布之外，很可能是过时的（鬼影）。用均值 $\mu$ 和标准差 $\sigma$ 构造 bounding box：

$$
[\mu - \gamma\sigma,\; \mu + \gamma\sigma]
$$

$\gamma$ = `clampScale` 控制 box 宽严。统计在 YCoCg + Reinhard 空间进行：

```hlsl
// 3×3 邻域统计（单遍计算 m1=Σx, m2=Σx²）
float3 m1 = 0, m2 = 0;
float3 nMin = 1e9, nMax = -1e9;

[unroll]
for (int dx = -1; dx <= 1; dx++) {
    [unroll]
    for (int dy = -1; dy <= 1; dy++) {
        float3 s = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, uv + float2(dx,dy)*texel).rgb;
        s = clamp(s, 0.0, 65000.0);       // 防 Inf/NaN
        s = Reinhard(s);                   // HDR→LDR
        float3 y = RGBToYCoCg(s);          // 去相关
        m1 += y;  m2 += y * y;
        nMin = min(nMin, y);  nMax = max(nMax, y);
    }
}

float3 mean   = m1 / 9.0;
float3 var    = max(m2 / 9.0 - mean * mean, 0.0);   // σ² = E[x²] - E[x]²
float3 stddev = sqrt(var);
float gamma   = _ClampScale;                          // 默认 0.75

// Bounding box: 方差 box 与邻域 min/max 取交集
float3 boxMin = max(mean - gamma * stddev, nMin);
float3 boxMax = min(mean + gamma * stddev, nMax);
```

- `m1/9 = μ`，`m2/9 - μ² = σ²`（方差计算的单遍公式）
- `nMin/nMax` 与方差 box 取交集——防止 $\gamma\sigma$ 超出邻域实际范围
- `clampScale=0.75`：$\gamma<1$ 收紧 box，更激进拒绝历史（减少鬼影，保留更多当前帧噪声）

#### 3.5.2 ClipAABB：射线-AABB 相交

历史颜色可能落在 box 外。ClipAABB 不是简单 clamp，而是**从 box 中心向历史颜色方向发射射线，求射线与 AABB 表面的交点**：

```hlsl
float3 ClipAABB(float3 history, float3 boxMin, float3 boxMax)
{
    float3 center  = 0.5 * (boxMax + boxMin);
    float3 extents = 0.5 * (boxMax - boxMin) + 1e-5;
    float3 offset  = history - center;              // 历史→中心的方向
    float3 ts = abs(extents) / max(abs(offset), 1e-5);  // 各轴缩放比
    float  t  = saturate(min(ts.x, min(ts.y, ts.z)));   // 取最小（最先碰面）
    return center + offset * t;                     // 沿射线缩回到表面
}
```

- `t=1`：历史在 box 内，不修改
- `t<1`：历史在 box 外，沿中心→历史方向缩回到 box 表面（**最近点**）
- 相比逐分量 clamp，射线法保留了历史颜色的方向，色相失真更小

```hlsl
float3 hisYCoCg   = RGBToYCoCg(his);
float3 hisClipped = ClipAABB(hisYCoCg, boxMin, boxMax);
his = YCoCgToRGB(hisClipped);   // 回 RGB 空间
```

### 3.6 Velocity Rejection（速度拒绝）

#### 3.6.1 Disocclusion 问题

Variance Clipping 处理"历史颜色与当前帧颜色不符"，但有一种情况它无法处理：**大面积 disocclusion**——物体快速移动后，原本被遮挡的区域突然暴露。当前帧这些区域有合法颜色，但历史帧该位置是完全不同的物体。3×3 邻域统计可能恰好覆盖到新旧物体的过渡区，bounding box 过宽，clip 无效。

#### 3.6.2 MV 一致性检测

Velocity Rejection 检测**当前帧 MV 与历史帧该位置 MV 的一致性**。如果同一屏幕位置在当前帧和历史帧的 MV 差异很大，说明该位置经历了剧烈的运动变化（disocclusion），应降权历史：

```hlsl
// historyUV = uv - currentMV，即重投影后的上一帧位置
float2 historyMV = SAMPLE_TEXTURE2D(_PreMvTex, sampler_PreMvTex, historyUV).rg;
float mvDiff = length(motionVec - historyMV);     // 当前MV vs 历史MV
float disocclusionFactor = saturate(mvDiff / max(_VelocityThreshold, 1e-5));
float currentBlend = lerp(_Blend, 1.0, disocclusionFactor);
// disocclusionFactor=0: 正常, currentBlend=_Blend=0.12 (历史占88%)
// disocclusionFactor=1: 剧变, currentBlend=1.0 (纯当前帧, 丢弃历史)
```

`_VelocityThreshold = 0.03`（UV 单位，约 3% 屏幕宽度）。MV 差异超过此值即判定为 disocclusion，`currentBlend` 趋向 1.0，历史帧权重趋零。

> **为何存储历史 MV**：`_PreMvRT` 每帧记录当前 MV，下一帧作为 `historyMV` 采样。这需要一张持久跨帧的 RGHalf RT。MV 是 2 分量，Half 精度足够（UV 偏移通常 <0.1）。

### 3.7 Catmull-Rom Bicubic 历史采样

#### 3.7.1 为何不用双线性

历史帧经重投影后的 `historyUV` 是亚像素位置（非整数像素中心）。双线性插值只取 4 个最近邻做加权平均，引入低通滤波——每帧模糊一点，累积 N 帧后画面明显发糊。

#### 3.7.2 Catmull-Rom 样条

Catmull-Rom 是 $C^1$ 连续的三次样条，穿过控制点且一阶导连续。1D 权重函数（$f$ 为亚像素小数部分）：

$$
w_0 = f^2 - \tfrac{1}{2}(f^3 + f), \quad w_1 = \tfrac{3}{2}f^3 - \tfrac{5}{2}f^2 + 1
$$
$$
w_2 = -\tfrac{3}{2}f^3 + 2f^2 + \tfrac{1}{2}f, \quad w_3 = \tfrac{1}{2}(f^3 - f^2)
$$

2D Bicubic 需要 4×4=16 tap。本实现用 **5-tap 优化**（Mitchell-Netravali 的可分离近似），将 `w1+w2` 合并为单采样点 `tc12`，把 16 tap 降到 5 tap：

```hlsl
float3 SampleHistoryBicubic(float2 uv, float2 texSize)
{
    float2 samplePos = uv * texSize;
    float2 tc = floor(samplePos - 0.5) + 0.5;
    float2 f = samplePos - tc;
    float2 f2 = f * f,  f3 = f2 * f;

    float2 w0 = f2 - 0.5 * (f3 + f);
    float2 w1 = 1.5 * f3 - 2.5 * f2 + 1.0;
    float2 w2 = -1.5 * f3 + 2.0 * f2 + 0.5 * f;
    float2 w3 = 0.5 * (f3 - f2);

    float2 w12 = w1 + w2;                              // 合并 w1,w2 → 单采样
    float2 tc12 = tc + w2 / max(w12, 1e-5);
    float2 tc0 = tc - 1.0,  tc3 = tc + 2.0;

    // 5-tap: 中心 + 4 角
    float3 c00 = SAMPLE_TEXTURE2D(_PreTex, sampler_PreTex, float2(tc12.x, tc0.y)  / texSize).rgb;
    float3 c10 = SAMPLE_TEXTURE2D(_PreTex, sampler_PreTex, float2(tc0.x,  tc12.y) / texSize).rgb;
    float3 c11 = SAMPLE_TEXTURE2D(_PreTex, sampler_PreTex, float2(tc12.x, tc12.y) / texSize).rgb;
    float3 c12 = SAMPLE_TEXTURE2D(_PreTex, sampler_PreTex, float2(tc3.x,  tc12.y) / texSize).rgb;
    float3 c22 = SAMPLE_TEXTURE2D(_PreTex, sampler_PreTex, float2(tc12.x, tc3.y)  / texSize).rgb;

    return c00 * (w12.x * w0.y) +
           c10 * (w0.x  * w12.y) +
           c11 * (w12.x * w12.y) +
           c12 * (w3.x  * w12.y) +
           c22 * (w12.x * w3.y);
}
```

Catmull-Rom 的负权重（$w_0, w_3$ 可为负）产生**锐化**效果——抵消累积模糊，保持边缘锐利。5-tap 优化牺牲少量精度换取 3 倍性能。

### 3.8 最终混合与历史更新

```hlsl
// blend: 当前帧权重 (默认 0.12, 即历史占 88%)
// currentBlend: 经 Velocity Rejection 调整后的 blend (disocclusion 时→1.0)
float3 outRGB = lerp(his, cur, saturate(currentBlend));
return float4(InverseReinhard(outRGB), 1.0);   // 恢复 HDR
```

混合后：
1. **输出**写回 `cameraColorTarget`（InverseReinhard 恢复 HDR 辐射度）
2. **更新历史**：`Blit(src → _PreRT)` 把当前帧 TAA 结果存为下一帧的历史
3. **更新历史 MV**：`Blit(_MotionVectorTexture → _PreMvRT)` 供下一帧 Velocity Rejection

> **blend 与有效累积帧数**：`blend=0.12` 时每帧保留 88% 历史，有效累积 ≈ $1/(1-0.88) \approx 8.3$ 帧。`blend=0.765`（项目当前错误配置）时有效累积仅 ≈ 1.3 帧，TAA 几乎失效。

---

## 4. 执行时机与 URP 管线架构

### 4.1 Jitter 注入 → TAA Pass 全链路

```
═══════════════════════════════════════════════════════════════
URP 一帧 (TAA 开启)

 (0) ★ AddRenderPasses ★
       ├─ ResetProjectionMatrix
       ├─ AdvanceHalton → GetCurrentHalton
       ├─ 计算 jx, jy → jitteredProj.m02 += jx, m12 += jy
       ├─ cam.projectionMatrix = jitteredProj      ← 注入亚像素偏移
       └─ cam.nonJitteredProjectionMatrix = originalProj

 (1) Depth PrePass → _CameraDepthTexture  (使用 Jittered 投影)
 (2) DrawOpaqueObjects                     (所有几何体带亚像素偏移渲染)
       └─ Motion Vector Pass → _MotionVectorTexture
           (MV 编码: 当前像素→上一帧屏幕位置的 UV 偏移)

 (3) Transparents / Skybox

 (4) ★ BeforeRenderingPostProcessing ★                   [TAA Pass]
       │  ┌─ TAARenderPass.Execute ─────────────────────┐
       │  │  若 needInit:                                 │
       │  │    Blit(src → _PreRT)  初始化历史              │
       │  │  否则:                                        │
       │  │    1. Blit(src → _TAARaw)   保存原始帧         │
       │  │    2. Blit(src → _TAATemp)                    │
       │  │    3. Blit(_TAATemp → src, mat, Pass0)  ← TAA │
       │  │       ComputeTAA(uv):                         │
       │  │         - GetDilatedMotionVector → historyUV   │
       │  │         - SampleHistoryBicubic → his           │
       │  │         - Reinhard(cur + his)                  │
       │  │         - YCoCg Variance Clip                  │
       │  │         - Velocity Rejection                   │
       │  │         - lerp(his, cur, blend)                │
       │  │         - InverseReinhard → 输出               │
       │  │    4. Blit(src → _PreRT)   更新历史             │
       │  │    5. Blit(_MotionVectorTexture → _PreMvRT)    │
       │  │    6. 释放临时 RT                              │
       │  └────────────────────────────────────────────────┘

 (5) Post-Processing → Present

 (★) OnCameraCleanup: cam.ResetProjectionMatrix()
═══════════════════════════════════════════════════════════════
```

> **关键时序**：Jitter 在 `AddRenderPasses` 阶段注入投影矩阵（所有后续渲染使用 Jittered 矩阵），Motion Vector 在物体渲染时计算（编码 Jittered→上一帧 Jittered 的偏移），TAA Pass 在 PostProcessing 前做历史混合。

### 4.2 相机切换 / Timeline 处理

```csharp
int currentCamID = m_Cam.GetInstanceID();
if (m_LastCameraID != -1 && m_LastCameraID != currentCamID) {
    // 相机切换 → 释放旧历史 RT, 重新创建
    ReleaseHistory();
    m_HistoryValid = false;
}
m_LastCameraID = currentCamID;
```

### 4.3 RT 与内存

| RT | 分辨率 | 格式 | 用途 |
| :--- | :--- | :--- | :--- |
| `_PreRT` (TAA_History) | full² | DefaultHDR | 历史帧颜色 (持久跨帧) |
| `_PreMvRT` (TAA_HistoryMV) | full² | RGHalf | 历史帧 Motion Vector (持久跨帧) |
| `_TAATemp` | full² | DefaultHDR | 临时 Blit |
| `_TAARaw` | full² | DefaultHDR | 原始帧备份 (分屏 Debug) |

持久 RT ~33MB (1080p DefaultHDR 16MB + RGHalf 8MB × 2)。

---

## 5. 实现细节与关键代码

### 5.1 单例模式 + TAAShowcase

```csharp
public static TAARenderFeature Instance { get; private set; }
public override void Create() { Instance = this; }

// TAAShowcase.Update:
taaFeature.setting.debugSplitView = enableSplitView;
taaFeature.setting.debugSplitX   = splitX;
```

分屏对比通过 `_DebugParams` 传入 shader，shader 内部 `if (uv.x < splitX) rawRGB else taaRGB`，无需双相机、双 RT、双 Blit。

### 5.2 Debug 视图

| `debugVisMode` | 输出 |
| :--- | :--- |
| 0 | 正常 TAA |
| 1 | Motion Vector (放大 100 倍，静止=黑) |
| 2 | Dilated Motion Vector |
| 3 | LinearEyeDepth / 100 |
| 4 | 历史帧 |

### 5.3 参数一览

| 参数 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `jitter` | 0.45 | 亚像素抖动幅度（像素），越大抗锯齿越强但鬼影越重 |
| `blend` | 0.12 | 当前帧权重，越大越锐利但去噪弱 |
| `clampScale` | 0.75 | AABB 收紧系数，<1 收紧（减少鬼影），>1 放宽（更平滑） |
| `velocityThreshold` | 0.03 | 速度拒绝阈值（UV 单位） |
| `skipWhenStatic` | false | 相机静止时跳过抖动 |
| `disableJitter` | false | 关闭 Jitter（排查用） |

---

## 6. References

1. **Brian Karis.** "High-Quality Temporal Supersampling." *SIGGRAPH 2014*. — UE4 TAA 方案，Halton Jitter + Color Space Variance Clipping 范式。
2. **Intel.** "Temporal Anti-Aliasing." *Intel Graphics Performance Analyzers / Game Dev Guides*. — Motion Vector Dilation + Velocity Rejection 策略。
3. **Timothy Lottes.** "FXAA / TAA Comparison." *NVIDIA, 2011*. — Reinhard 亮度压缩在 TAA 中的必要性。
4. **Don Mitchell, Arun Netravali.** "Reconstruction Filters in Computer Graphics." *SIGGRAPH 1988*. — Catmull-Rom 样条与 Bicubic 重滤波理论。
5. **Henrique S. Malvar, David Staelin.** "The Fast Walsh-Hadamard Transform and YCoCg Color Space." — YCoCg 变换的去相关性质。
6. **Unity Technologies.** "URP Scriptable Renderer Features / Motion Vectors." *Unity Manual*.
