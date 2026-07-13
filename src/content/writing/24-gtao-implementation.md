---
title: "Unity URP：GTAO实现（Plus：Multi-Bounce&SSDO）"
course: "Classic Sponza Showcase"
source: "Assets/OurFunction/GTAO/"
order: 24
---

Unity URP 12渲染管线内的sponzashowcase实现中的ao等部分的实现；
参考：
- Activision "Practical Real-Time Strategies for Accurate Indirect Occlusion"（Jimenez et al. 2016，SIGGRAPH）
- Intel XeGTAO 的工业级 AO 方案
> 代码位于项目 `Assets/OurFunction/GTAO/`，包含：`GTAOComputeShader.compute`、`GTAORendererFeature.cs`、`GTAORenderPass.cs`、`GTAOCompositePass.cs`、`GTAOComposite.shader`、`GroundTruthAmbientOcclusion.cs`。

## 1. Introduction

### 1.1 ShowCase
#### GTAO Image
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17839263591586.png)
### 1.2 实现逻辑

- **核心机制**：把 AO 重新定义为"沿视空间地平线（horizon）角的闭式余弦积分"——对每个像素，在其法线所在的多个切平面切片（slice）上，比较"真实几何地平线角"与"法线角"，被抬高的地平线即遮蔽。该机制从根本上将 AO 从"蒙特卡洛射线统计"转变为"几何地平线角的解析积分"，无需 MRT 法线（可从深度重建），且天然随距离做像素↔世界换算（通过投影矩阵与线性深度）。
- **带来的改变**：输出是**能量守恒的可见度（visibility = 1 即完全未遮蔽）**，可直接乘进环境光项；配合 **Multi-Bounce 颜色恢复**与可选 **SSDO 屏幕空间反弹**，既避免灰黑死区又保留材质颜色。整套管线以 Compute Shader 在**半分辨率**计算、双边模糊上采样，并以 URP 原生 `_ScreenSpaceOcclusionTexture` 关键字接入前向/延迟 Lit，无需改动任何材质。

### 1.3 传统方案缺陷
- **传统方法**：工业界实时环境光遮蔽（Ambient Occlusion, AO）长期以 **SSAO（Screen Space Ambient Occlusion）** 为基线。其经典做法是：在屏幕空间对当前像素随机发射若干采样射线，与深度缓冲比较判断可见性，再对采样结果做模糊。HBAO、HDAO 等变体本质上仍是"半球积分 + 深度比较"的同源思路。
  问题所在：该传统方法存在三个致命缺陷：
- 第一，**法线依赖脆弱**——SSAO 直接消费 GBuffer 法线，一旦法线有噪声（前向渲染下尤其严重）或自相交处法线翻转，AO 立刻出现斑驳与黑边；前向管线往往根本没有现成法线，需单独 MRT 输出。
- 第二，**半径尺度崩坏**——SSAO 采样半径以"像素"为单位，在远景处半径对应的世界尺度急剧收缩，导致远平面 AO 消失、近平面 AO 过密，缺乏随距离自适应的像素↔世界换算。
- 第三，**能量不守恒 + 假阴影**——SSAO 用"有多少射线被挡"近似遮蔽，缺乏闭式积分，结果偏灰、偏暗；平面/缓坡容易产生自遮挡伪影（self-occlusion），远处几何投下鬼影（ghosting）。
## 2. KeyWords

| 关键词 (Academic)                       | 简单解释                      | 在本实现中的具体职责                                                  |
| :----------------------------------- | :------------------------ | :---------------------------------------------------------- |
| **Ground Truth AO (GTAO)**           | 基于地平线角闭式积分的实时 AO，能量守恒     | `GTAOMain` 内核计算每像素可见度                                       |
| **View-space Normal Reconstruction** | 从深度图一阶/二阶差分重建视空间法线        | `GTAOMain` 中 `cross(hDeriv, vDeriv)`，避免依赖 MRT 法线            |
| **Horizon Angle Integration**        | 在切片平面比较地平线角与法线角的余弦积分      | 积分公式 `val = (cos n + 2h·sin n − cos(2h−n))/4`               |
| **Slice / Step Sampling**            | 把半球离散为若干等角切片，每切片若干步长      | `SLICE_COUNT=4 × STEPS_PER_SLICE=3 = 24` 采样点                |
| **Hilbert + R2 Sequence**            | 低差异 quasi-random 序列，时空去相关 | `SpatioTemporalNoise()` 生成每像素采样相位                           |
| **Bilateral Upsample**               | 带法线+深度权重的双向高斯模糊 + 双线性上采样  | `BlurHorizontalMain` / `BlurVerticalMain`，29-tap            |
| **Variance Clipping**                | 时域累积中把历史 clamp 进当前帧邻域方差框  | `TemporalFilterMain` 防鬼影/拖影                                 |
| **Multi-Bounce (MB)**                | 用 albedo 多项式拟合多重反弹颜色恢复    | `GTAOComposite.shader` 中 `colorRecovery = mb(ao,albedo)/ao` |
| **SSDO**                             | 屏幕空间漫反射反弹：环采场景颜色加回主色      | `GTAOCompositePass` + `GTAO_ComputeSSDO`                    |
|                                      |                           |                                                             |

## 3. Technical Breakdown

### 3.1 GTAO：核心地平线角积分

#### 3.1.1 深度到视空间法线

GTAO 不依赖 GBuffer 法线，而是从 `_CameraDepthTexture` 重建视空间法线。空间变换：屏幕 UV + 深度 → 视空间位置：

$$
P_{vs} = \mathtt{mul}(M_P^{-1},\;(uv\cdot 2-1,\ d,\ 1))^{xyz} \big/ w
$$

在不支持 `UNITY_MATRIX_I_P` 时退化为线性深度法：

$$
P_{vs} = \begin{pmatrix} uv_{ndc}\cdot L_{eye}\cdot \mathrm{rcp}(P_{00},\,P_{11}) \\ -L_{eye} \end{pmatrix},\qquad L_{eye}=\mathtt{LinearEyeDepth}(d)
$$

法线重建在 `NORMAL_FROM_DEPTH_PIXEL_RANGE=2` 的 5×5 邻域内做**边缘感知（edge-aware）**差分——比较近距离梯度与远距离梯度的二阶误差，选误差较小者（即更可信的切向）：

```hlsl
float2 he = abs((2 * H.xy - H.zw) - depthC);  // H = (L, R, L2, R2)
float2 ve = abs((2 * V.xy - V.zw) - depthC);  // V = (B, T, B2, T2)
float3 hDeriv = he.x < he.y ? l : r;           // 水平: 取更可信的切向
float3 vDeriv = ve.x < ve.y ? b : t;           // 垂直: 取更可信的切向
float3 normalVS = normalize(cross(hDeriv, vDeriv));
```

其中 `l/r/b/t` 分别为 `normalize(viewPosC ± viewPosL/R/B/T)`。邻域深度通过 `groupshared float depthForNormal[]` 在 16×16 线程组内一次缓存（`CacheDepthForNormal`），避免重复 `Load`。法线以 `normalVS.xy*0.5+0.5` 编码进 AO 缓冲 G/BA 通道，供模糊与 Composite 复用。

#### 3.1.2 地平线角积分

GTAO 把 AO 拆成数个绕视线 $\vec v = \mathrm{normalize}(-P_{vs})$ 旋转的**切片**。每个切片是一个过视点、垂直于 $\vec v$ 的平面，在该平面内 AO 由"几何地平线角 $h$"与"法线投影角 $n$"的差决定。

**像素↔世界尺度换算**（关键——解决了 §1.1 中传统 SSAO 尺度崩坏问题）：

$$
L_{2px} = \frac{H_{pix} \cdot (P_{00}^{-1})}{2\cdot L_{eye}} = \frac{H_{pix} \cdot (-\mathtt{P.\_m11})}{2\cdot L_{eye}}
$$

这里 $P_{00}^{-1} = 1/\tan(fovy/2) = -\mathtt{P.\_m11}$。世界空间 `effectRadius` 映射为 `screenSpaceRadius = R·L_{2px}`，采样半径随深度自然缩放：远平面收缩、近平面扩张。

**切片初始化**：对每个切片 $\phi = (s+\xi_{slice})\cdot\pi/N_s$：

$$
\omega = (\cos\phi,\ \sin\phi),\qquad
\vec o = (\cos\phi,\ \sin\phi,\ 0) - ((\cos\phi,\ \sin\phi,\ 0)\cdot\vec v)\,\vec v
$$

$$
\vec a = \mathrm{normalize}(\vec o \times \vec v),\qquad
\vec n_\perp = \vec n - \vec a(\vec n\cdot\vec a)
$$

法线在切片平面内投影后，其有符号角度 $n$ 和初始地平线角 $h_{\cos 0}^{low}$：

$$
\cos n = \mathrm{saturate}\!\left(\frac{\vec n_\perp\cdot\vec v}{\lVert\vec n_\perp\rVert}\right),\qquad
n = \mathrm{sign}(\vec o\cdot\vec n_\perp)\cdot\arccos(\cos n)
$$

$$
h_{\cos 0}^{low} = \cos(n+\tfrac{\pi}{2}),\qquad h_{\cos 1}^{low} = \cos(n-\tfrac{\pi}{2})
$$

**步长采样**：沿 $\omega\cdot \text{screenSpaceRadius}$ 方向，`STEPS_PER_SLICE=3` 步（含抖动保证采样随机性），$s = \mathrm{pow}((step+\xi_{step})/N_{step},\ power)+minS$（`minS = pixelTooCloseThreshold / screenSpaceRadius` 排斥着色点附近采样防自遮挡）。深度采样 → 还原视空间位置 → 得样本地平线向量 $\hat h$，与视线的点积：

$$
\mathrm{shc} = \hat h\cdot\vec v = \frac{P_{k} - P_c}{\lVert P_k - P_c\rVert}\cdot\vec v
$$

**Faloff 权重**：随着采样距离增大，样本从全权重降到零，过渡区间为 $[R-fR,\ R]$：

$$
w = \mathrm{saturate}\!\left(\frac{R - \|P_k - P_c\|}{f\cdot R}\right)
$$

其中 $R$ = `_SampleRadius`，$f$ = `_FalloffRange`。权重对 `shc` 和低地平线角做 lerp 即可拾升地平线：

```hlsl
shc = lerp(lowHorizonCos, shc, w);          // w=1 时完全抬高, w=0 时保持低值
horizonCos = max(horizonCos, shc);          // 取所有采样中最高的地平线角
```

**Horizon Bias**：将地平线向未遮蔽方向偏移，减少平面自遮挡：

```hlsl
horizonCos0 = max(horizonCos0, cos(n + HALF_PI - _HorizonBias));
horizonCos1 = max(horizonCos1, cos(n - HALF_PI + _HorizonBias));
```

**Horizon 角 clamp + 解析积分**：$h_0 = n + \mathrm{clamp}(h_0-n,\ -\pi/2,\ \pi/2)$（同理 $h_1$），然后套用闭式余弦积分公式——GTAO 论文 interior cosine integral：

$$
V_{slice} = \lVert\vec n_\perp\rVert\cdot\frac{\cos n + 2h\sin n - \cos(2h - n)}{4}\Big|_{h=h_0,h_1}
$$

最终可见度对切片取均值并 clamp：
```hlsl
visibility /= SLICE_COUNT;
visibility = max(0.03, visibility);
```

> **能量守恒**：`val/4` 是 $1/(2\pi)$ 半球积分离散近似的一阶因子，$\lVert\vec n_\perp\rVert$ 补偿法线投影到切片平面后的长度损失，保证面朝视线时 $V\to 1$。
#### 3.1.3 采样方向生成：Hilbert + R2
用 Hilbert 曲线（6 级）把像素 (x,y) 映射为一维 index，使相邻像素噪声相位连续（减少 NaNs/闪烁），再以 `frac(0.5 + index * r2)` 生成 `[0,1)²` 低差异序列（R2 golden-ratio）。`localNoise.x` 驱动切片相位，`localNoise.y` 驱动步内抖动（`stepNoise = frac(noiseSample + (slice + step*Nstep)*0.61803)`）。Temporal 模式时叠加 `288*(frameIndex%64)` 逐帧偏移。
#### 3.1.4 双边模糊与双线性上采样
半分辨率 AO 需双边模糊 + 双线性上采样回全分辨率。`BlurHorizontalMain` / `BlurVerticalMain` 各做 29-tap 高斯，权重同时受法线与深度调制，防止 AO 跨几何边缘泄漏：

```hlsl
float normalWeight = pow(saturate(dot(centerVS, sampleVS)), 4.0);
float depthWeight  = 1.0 - saturate(abs(center.w - sample.w) * 300.0);
float weight = normalWeight * depthWeight * gaussWeight[offset];
```

`groupshared float4 aoNormalDepthForBlur[]` 在 64 线程组内缓存。上采样阶段根据 `subpixelBias` 做双线性插值（`lerp(thisAO, leftAO/topAO, lerpVal)`），平滑恢复全分辨率。
### 3.2 Multi-Bounce：补偿多次反弹光源

#### 3.2.1 原理：从 AO 到多重反弹
![来自Games104：一个神秘的多项式](https://oss.kiiye9697.cn/20260113005558472.webp)
GTAO 输出的 `visibility` 是单次遮蔽率。当 visibility = 1，完全未遮蔽；visibility = 0.3 时，环境光被压暗到 30%，像素变成深灰色。但物理上，**遮挡面之间还会发生二次、三次漫反射反弹**——红光墙面上的遮蔽区会从邻近墙面"借"到微弱的红色补光。GTAO 原始论文指出，把 visibility 直接乘进环境光等于假设所有被遮蔽的能量永远消失，这在明亮材质（albedo > 0.5）上会严重偏暗。

**McGuire 等人的多项式拟合**（"A Panorama of Ambient Occlusion"）给出了从单次 AO + albedo 近似多重反弹的闭式：已知可见度 $x$ 和表面反照率 $\rho$，多重反弹后的可见度 $f(x,\rho)$ 可通过三阶有理多项式拟合为 $f(x) = \max(x,\ ((x\cdot\vec a + \vec b)\cdot x + \vec c)\cdot x)$，其中系数 $(\vec a,\vec b,\vec c)$ 由 albedo 线性回归得出：

$$
\vec a = 2.0404\,\rho - 0.3324,\qquad
\vec b = -4.7951\,\rho + 0.6417,\qquad
\vec c = 2.7552\,\rho + 0.6903
$$

这个多项式 $f(x)$ 的含义是"考虑了多次反弹后被观测到的可见度"。它在 $x$ 较小时明显抬升，把 $f(x)$ 除以原始 $x$（即 `mbAO / max(ao, 0.08)`），得到的就是颜色恢复系数（≥1，遮蔽越深恢复越强）。


#### 3.2.2 关键代码

```hlsl
float3 GTAOComposite_MultiBounce(float visibility, float3 albedo)
{
    float3 a =  2.0404 * albedo - 0.3324;
    float3 b = -4.7951 * albedo + 0.6417;
    float3 c =  2.7552 * albedo + 0.6903;
    float3 x = saturate(visibility);
    float3 multiBounceVis = saturate(max(x, ((x*a + b)*x + c)*x));
    // 能量守恒: multiBounceVis / x = 颜色恢复系数 (≥1)
    return min(multiBounceVis / max(x, 0.08), 2.0);
}
```

几个必须得做 clamp防止特殊情况出现：
- `0.08` 防止 visibility = 0 时除以零，把恢复系数封顶在 ~12.5×
- `min(..., 2.0)` 硬截断极端情况（极低 AO + 高 albedo 时拟合外插可能超过 2）
- 最终合成：`color *= lerp(1.0, colorRecovery, _GTAOCompositeParams.y)`，`mbStrength=0` 即关闭

#### 3.2.3 在管线中的位置

Multi-Bounce 在 `GTAOCompositePass` 的 `Frag` 中位于 SSDO bounce **之后**执行——先加法注入反弹光，再乘法恢复颜色。核心灰度 GTAO 路径完全不受影响：Multi-Bounce 仅是一个独立的、可开关的后期颜色增强层，输入是已照亮场景 + 已计算完毕的 AO 纹理。


### 3.3 SSDO：屏幕空间漫反射反弹

#### 3.3.1 原理&Showcase
- 是一种针对AO的改进，获得更优化的ao表现，其效果更接近ray tracing。
![](https://oss.kiiye9697.cn/20260420162918039.webp)
DO的逻辑更接近Path Tracing，从出发点开始迭代。模拟光线从附近表面反弹后的**颜色溢出**（Color Bleeding），不仅变暗，还能看到颜色。 
- 从这种逻辑上讲：AO的间接光照来源于远处(环境光)，DO的间接光照来源于近处的反射;我们更关注间接反射部分光照的亮度，将其被遮挡部分面对应ShadingPoint的贡献积分加和
![](https://oss.kiiye9697.cn/20260420164830248.webp)
>**SSDO效果常被集成优化**。虽然直接提及“SSDO”的情况变少
>但它的核心思想——在屏幕空间内模拟间接光（颜色溢出）
>已经被集成到更高级的全局光照解决方案中。许多游戏和引擎的综合光照系统，就包含了类似SSDO的优化，本showcase中为了将加法补偿ao区域的颜色值回复，在对应的cutain前布置对应颜色的点光源做lighting来进行对应的效果反馈。

>下图为SSDO的主要补偿位置，主要将间接光和部分侧面相关的光线能量加以补偿；
>![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17839261768478.png)
>这里提供了过多的补偿，会加算到表现的showcase中，主要为了能够更好的体现哪里是收到SSDO的补偿

#### 3.3.2 采样策略

`GTAO_ComputeSSDO` 在 12 个固定方向 ring 上采样 `sampleCount` 个点（默认 6）。采样设计：

- **环形分布**：`ring = 0.45 + 0.55*(i+0.5)/sampleCount`，采样半径从 0.45 线性递增到 1.0，覆盖近邻到远处；
- **固定方向集**：12 个均匀角度的 `float2` 方向，避免噪声闪烁；
- **屏幕像素半径**：`radius` 由 `_GTAOSSDOParams.y` 控制（默认 24px），乘以 texel size 换算为 UV；
- **拒绝无效采样**：超出深度边界或天空盒的样本直接 continue。

#### 3.3.3 权重设计（三重调制）

每个采样点对反弹光的贡献由三个权重共同决定：

$$
w = w_{depth} \cdot w_{normal} \cdot occlusion_{sample}
$$

- **深度权重 $w_{depth}$**：`saturate(1 - |eyeDepth_c - eyeDepth_s| * 2.0)`——视线深度差 > 0.5m 即权重归零，防止前景像素给背景"打光"或反过来；
- **法线权重 $w_{normal}$**：`pow(saturate(dot(N_c, N_s)*0.5+0.5), 2)`——法线越平行权重越高，防止垂直面之间互相漏光；
- **样本遮蔽度**：`occlusion_sample = 1 - AO(sampleUV)`——遮蔽越深的区域"发光"越少，越不可能提供反弹光（自身在阴影里）。

累积后取均值、乘以 `albedo * occlusion * intensity` 做颜色导向着色，`ssdoMaxContribution` 硬截断防白爆。

#### 3.3.4 与 Multi-Bounce 的区别

|           | Multi-Bounce       | SSDO         |
| :-------- | :----------------- | :----------- |
| **操作类型**  | 乘法（颜色拉伸）           | 加法（能量注入）     |
| **信息源**   | 仅当前像素的 AO + albedo | 周围像素的场景颜色    |
| **受几何影响** | 无                  | 依赖深度/法线拒止    |
| **典型用途**  | 防止遮蔽区死灰            | 模拟彩色遮蔽面的环境补光 |

这两者是相对来说都是为了处理ao只模拟了单次阴影遮挡的问题，可以说两者是不互斥的——代码中 SSDO 先执行用于补偿其他光的注入，Multi-Bounce 再在 SSDO 叠加后的颜色上做恢复，恢复的是由gtao过度加暗的部分。

#### 3.3.5 关键代码

```hlsl
float3 GTAOComposite_ComputeSSDO(float2 uv, float centerAO, float3 albedo)
{
    float occlusion = 1.0 - centerAO;
    float radiusPx  = max(_GTAOSSDOParams.y, 1.0);
    int sampleCount = (int)(_GTAOSSDOParams.z + 0.5);

    float3 bounce = 0; float weightSum = 0;
    for (int i = 0; i < 12; ++i) {                  // 12个固定方向
        if (i >= sampleCount) break;
        float ring  = 0.45 + 0.55 * (i+0.5) / sampleCount;
        float2 offset = directions[i] * radiusPx * ring * _MainTex_TexelSize.xy;
        float2 sampleUV = saturate(uv + offset);

        float weight = DepthWeight(rawDepth, sampleDepth)
                     * pow(saturate(dot(Nc, Ns)*0.5+0.5), 2)
                     * (1.0 - AO(sampleUV));
        bounce += SampleSceneColor(sampleUV) * weight;
        weightSum += weight;
    }
    bounce = (weightSum > 1e-4) ? bounce / weightSum : 0;
    bounce *= albedo * occlusion * _GTAOSSDOParams.x;         // albedo导向着色
    return min(bounce, _GTAOSSDOParams.w);                    // 硬截断防白爆
}
```

## 4. 执行时机与 URP 注入实际

这里直接参考类似SSAO的实现，直接将其对应的注入时机采用相同相同的插入。
GTAO 在 URP 中以 **ScriptableRendererFeature** 方式注入，不与任何材质耦合。
- 它通过三个 Pass 在不同管线阶段完成计算、调试与合成。本章以 URP Forward 与 Deferred 两条路径分别展开，精确描述每个 Pass 所处管线时间点、输入/输出 RT 的生命周期，以及数据依赖拓扑。

### 4.1 URP 整帧时序与 Pass 插入点

**Deferred 路径**（GTAO 标准路径，AO 在同一帧被光照消费）：

```
══════════════════════════════════════════════════════════════════════════
Time ──────────────────────────────────────────────────────────────►
                           URP Deferred 一帧

 (1) BeforeRenderingOpaques
       ├─ Depth PrePass  →  _CameraDepthTexture ✓ 写就

 (2) DrawOpaqueObjects (Deferred)
       ├─ GBuffer 写入:
       │   _GBuffer0 (BaseColor.rgb)
       │   _GBuffer1 (SpecularColor.rgb + Smoothness.a)
       │   _GBuffer2 (WorldNormal + LightingModel)
       │   _GBuffer3/4 ...
       │
 (3) ★ AfterRenderingGbuffer ★                                   [Pass A]
       │  ┌─ GTAORenderPass.Execute ──────────────────────────┐
       │  │  OnCameraSetup                                    │
       │  │    分配: _GTAOBuffer (half², R16G16B16A16)         │
       │  │          _HorizontalBlurBuffer (full×half)         │
       │  │          _VerticalBlurBuffer (full²)               │
       │  │          _VisualizeBuffer (full²)                  │
       │  │                                                    │
       │  │  [Profilers: GTAO Pass]                            │
       │  │  DoGTAOCalculation:  GTAOMain  dispatch            │
       │  │    _CameraDepthTexture → _GTAOBuffer                │
       │  │                                                    │
       │  │  [Profilers: Blur Pass]                            │
       │  │  DoBlur:  BlurHorizontalMain  dispatch             │
       │  │           BlurVerticalMain    dispatch             │
       │  │    _GTAOBuffer → _HorizontalBlurBuffer             │
       │  │                → _VerticalBlurBuffer (全分辨率 AO)  │
       │  │                                                    │
       │  │  [可选 Profilers: Temporal Pass]                    │
       │  │  DoTemporal: TemporalFilterMain dispatch            │
       │  │    _VerticalBlurBuffer + historyRT[read]           │
       │  │       → historyRT[write]  (ping-pong 持久 RT)      │
       │  │                                                    │
       │  │  [Profilers: Visualize Pass]                       │
       │  │  DoOutputAO: VisualizeMain dispatch                │
       │  │    verticalBlur(or history[write]) → _VisualizeBuffer│
       │  │                                                    │
       │  │  SetGlobalTexture(_ScreenSpaceOcclusionTexture,    │
       │  │    _VisualizeBuffer)                                │
       │  │  SetGlobalVector(_AmbientOcclusionParam, ...)       │
       │  │  SetKeyword(_SCREEN_SPACE_OCCLUSION, true)  ← 关键 │
       │  └───────────────────────────────────────────────────┘
       │
 (4) DrawOpaqueObjects (Deferred Lighting)
       ├─ 延迟光照 Pass 逐像素:
       │   从 GBuffer 读取 BRDF 参数
       │   采样 _ScreenSpaceOcclusionTexture ★
       │   环境光 *= AO_visibility        ← AO 当前帧消费 ✓
       │
 (5) AfterRenderingOpaques
       ├─ Skybox、Transparents、Decals 等

 (6) ★ BeforeRenderingPostProcessing ★
       │  ┌─ [若 debugAOToScreen]                              [Pass B]
       │  │  GTAODebugBlitPass.Execute
       │  │    Blit(_VisualizeBuffer → cameraColorTarget)       ← 覆盖屏幕
       │  │    return (跳过 Composite 与 PostProcess)
       │  │
       │  └─ [若 MB/SSDO]                                      [Pass C]
       │     GTAOCompositePass.Execute
       │       Blit(scene → temp), 获取 _MainTex
       │       采样 _GTAO_AOTexture (即 _VisualizeBuffer)
       │       采样 _GBuffer0(albedo), _GBuffer2(法线)
       │       Frag: SSDO bounce → MultiBounce → 叠加 → 屏幕
       │       采样 _CameraDepthTexture (SSDO 深度拒止)
       │
 (7) Post-Processing (Bloom, Tonemapping 等)

 (8) AfterRendering → FinalBlit → Present
══════════════════════════════════════════════════════════════════════════
```

> 简单来说，流程就是：
> `Depth Prepass`(1) → `GTAORenderPass`(3) 读深度写 AO → `Deferred Lighting`(4) 读 AO 压暗 → `CompositePass`(6) MB/SSDO 颜色增强。AO 在同帧内完整闭环。

**Forward 路径**（AO 在同帧 不透明 不 消费，但在 Composite / 下一帧 Opaques 生效）：

```
══════════════════════════════════════════════════════════════════════════
URP Forward 一帧

 (1) Depth PrePass → _CameraDepthTexture

 (2) DrawOpaqueObjects (Forward Lit)
       └─ URP Lit Shader 中检查 _SCREEN_SPACE_OCCLUSION
            本帧首次执行时 keyword 可能尚未设置 (取决执行时序) ✓/✗

 (3) ★ GTAORenderPass @ AfterRenderingGbuffer ★  [Pass A]
       └─ 同 Deferred 流程 → 设置 _ScreenSpaceOcclusionTexture

 (4) Skybox / Transparents / PostProcess ← 非 Opaque Pass 可消费 AO
       └─ Transparent Lit 内若采样 _ScreenSpaceOcclusionTexture 则当前帧可用

 (5) ★ CompositePass @ BeforeRenderingPostProcessing ★  [Pass C]
       └─ MB/SSDO 直接读 AO 并合成 (AO 当前帧已存在 ✓)

 (6) Post-Processing → Present
══════════════════════════════════════════════════════════════════════════
```

> **Forward vs Deferred 差异**：Deferred 路径是 GTAO 的原生路径——AO 计算位于 GBuffer 写入与 Deferred Lighting 之间，同帧即被光照消费；
> Forward 路径下 GTAO 仍正常计算并挂载至全局纹理，但 `DrawOpaqueObjects` 中的光照计算在 GTAOMain 之前执行。因此 Forward 场景下 Opaque 对象可能采样到**上一帧**的 AO（帧间延迟一帧）；Composite Pass 与 Transparents 则始终消费**当前帧** AO。

### 4.2 三个 Pass：职责、输入、输出

| Pass                      | Insert Point                    | 职责                                      | 输入                                       | 输出                                                  | RT 生命周期                                                              |
| :------------------------ | :------------------------------ | :-------------------------------------- | :--------------------------------------- | :-------------------------------------------------- | :------------------------------------------------------------------- |
| **GTAORenderPass** (A)    | `AfterRenderingGbuffer`         | GTAO 计算 + Temporal 去噪 + 挂载到 URP 全局 SSAO | `_CameraDepthTexture`                    | `_VisualizeBuffer` → `_ScreenSpaceOcclusionTexture` | 4 张临时 RT：`OnCameraSetup` 分配，`OnCameraCleanup` 释放；`historyRT[2]` 持久跨帧 |
| **GTAODebugBlitPass** (B) | `BeforeRenderingPostProcessing` | 调试：把 AO 灰度图 blit 到屏幕                    | `_VisualizeBuffer` (复用 Pass A 的 RT)      | `cameraColorTarget`                                 | 复用 Pass A 的临时 RT，不自行分配                                               |
| **GTAOCompositePass** (C) | `BeforeRenderingPostProcessing` | Multi-Bounce 颜色恢复 + SSDO 反弹             | 场景颜色、`_VisualizeBuffer`、`_GBuffer0/2`、深度 | `cameraColorTarget` (覆盖)                            | 仅分配 1 张暂存 RT 做 Blit 拷贝，随即释放                                          |

**入队条件**（`GTAORendererFeature.AddRenderPasses`）：

- Pass A **始终入队**（当 `isActive && computeShader != null`）；
- Pass B **替代 C 入队**（当 `debugAOToScreen` 开启 ——— 跳过 Post Process 直接看灰度 AO）；
- Pass C **不入队**（当 `debugAOToScreen` 开启 或 `RequiresComposite()` 为 false ——— 即 MB 与 SSDO 均关闭时）。

### 4.3 RT 分配策略

```csharp
// OnCameraSetup: 从大到小顺序分配, 确保复用时不浪费显存
desc.graphicsFormat = GraphicsFormat.R16G16B16A16_SFloat;  // 统一格式
desc.enableRandomWrite  = true;
desc.depthBufferBits    = 0;   // 不需要深度附着
desc.msaaSamples        = 1;   // Compute 只能用非 MSAA

cmd.GetTemporaryRT(visualizeTextureID,    desc);           // full²
cmd.GetTemporaryRT(verticalBlurTextureID, desc);           // full²  (BlurVertical 写目标)
desc.height = downsampleRes.y;
cmd.GetTemporaryRT(horizontalBlurTextureID, desc);         // full × half
desc.width  = downsampleRes.x;
cmd.GetTemporaryRT(gtaoTextureID, desc);                   // half²  (GTAOMain 写目标)

// 历史 RT: 持久, 不受 TemporaryRT 影响, 分辨率变更时重建
private RenderTexture[] historyRT = new RenderTexture[2];
void EnsureHistoryRT() {
    for (int i=0; i<2; i++) {
        if (historyRT[i] == null || historyRT[i].width != fullRes.x ...) {
            historyRT[i] = new RenderTexture(fullRes.x, fullRes.y, 0, ARGBHalf)
                { enableRandomWrite = true, name = "_GTAOHistory" + i };
            historyRT[i].Create();
        }
    }
}
```

**内存估算**（1920×1080、半分辨率、R16G16B16A16_SFloat = 8 bytes/pixel）：

| RT                      | 分辨率         | 字节                                                              | 备注             |
| :---------------------- | :---------- | :-------------------------------------------------------------- | :------------- |
| `_GTAOBuffer`           | 960×540     | ~4.1 MB                                                         | 半分辨率           |
| `_HorizontalBlurBuffer` | 1920×540    | ~8.3 MB                                                         | 中间缓冲           |
| `_VerticalBlurBuffer`   | 1920×1080   | ~16.6 MB                                                        | 全分辨率 AO        |
| `_VisualizeBuffer`      | 1920×1080   | ~16.6 MB                                                        | 最终输出           |
| `historyRT[2]`          | 1920×1080×2 | ~33.2 MB                                                        | Temporal 专用，持久 |
| **合计**                  |             | **~78.8 MB** (峰值, Temporal 开启) / **~45.6 MB** (峰值, Temporal 关闭) |                |

### 4.4 全局 SSAO 关键字接入

```csharp
// GTAORenderPass.DoOutputAO — 将 GTAO 挂载到 URP, 不改任何材质
if (enableAO && intensity > 0.0f) {
    cmd.SetGlobalTexture(_SSAOTextureID, visualizeTextureID);           // _ScreenSpaceOcclusionTexture
    cmd.SetGlobalVector(_AmbientOcclusionParamID,
        new Vector4(0f, 0f, 0f, directLightingStrength.value));         // xyz=未用 w=直射光强度
    CoreUtils.SetKeyword(cmd, "_SCREEN_SPACE_OCCLUSION", true);
}
```

URP Lit 着色器检测到 `_SCREEN_SPACE_OCCLUSION` 后自动采样 `_ScreenSpaceOcclusionTexture`，在最终的环境光项上乘以 `visibility`。`_AmbientOcclusionParam.w`（由 `directLightingStrength` 填入）控制对直接光分量的压暗程度。`OnCameraCleanup` 关闭关键字、释放 4 张临时 RT，防止污染后续 Camera 或 Frame。
直接从这个地方进行实现就可以，开启关键字主要是为了让shader能够正确采样ao。
## 5. 实现细节与关键部分代码

### 5.1 GTAOMain：从深度到可见度

`GTAOMain` 是 Compute Shader 的主内核（`16×16` 线程组），下面是完整的关键计算流程拆解。

**5×5 深度缓存**：通过 `CacheDepthForNormal` 填入 `groupshared`，每次进 2 像素（`cacheIndex*2`），`GroupMemoryBarrierWithGroupSync` 后统一读取：

```hlsl
// 缓存：每个线程贡献2个像素
int cacheIndex = groupIndex * 2;
if (cacheIndex < CACHED_DEPTH_FOR_NORMAL_SIZE-1) {
    CacheDepthForNormal(groupCacheStartPos, cacheIndex,   subpixelBias);
    CacheDepthForNormal(groupCacheStartPos, cacheIndex+1, subpixelBias);
}
GroupMemoryBarrierWithGroupSync();
// 读取：直接用 GTAO_THREAD_GROUP_SIZE 内索引
float depthC = GetDepthForNormal(threadPos);
```

**法线重建**（见 §3.1.1 HLSL 片段）。关键点：`H=(depthL,depthR,depthL2,depthR2)` 的四元组对比，选出更可信的差分方向，避免深度断裂处法线翻转。

**采样半径换算**：

```hlsl
float effectRadius = _SampleRadius;
float falloffRange  = effectRadius * _FalloffRange;         // 衰减区间长度
float falloffMul    = -rcp(falloffRange);                   // w = saturate((R-dist)/fR)
float falloffAdd    = 1.0 - (effectRadius-falloffRange)*falloffMul;  // = R/(fR)
float screenSpaceRadius = effectRadius * _TextureSize.y * (-UNITY_MATRIX_P._m11)
                        / (2.0 * LinearEyeDepth(depthC, _ZBufferParams));
float minS = 3.0 / screenSpaceRadius;  // pixelTooCloseThreshold=3.0, 排斥近邻采样
```

**切片循环中的 step 采样**：每个 step 输出两侧（`+sampleOffset` / `-sampleOffset`）的 `shc` = `cos(h)`，经 falloff 加权与 horizon bias 后积分：

```hlsl
for (float step = 0; step < STEPS_PER_SLICE; step++) {
    float stepNoise = frac(noiseSample + (slice + step*SLICE_COUNT) * 0.6180339887);
    float s = pow((step + stepNoise)/STEPS_PER_SLICE, sampleDistributionPower) + minS;

    float2 sampleOffset = round(s * omega) * _TextureSize.zw;  // 整像素偏移防subpixel闪烁
    float3 samplePos0 = GetViewSpacePos(uv + sampleOffset);
    float3 samplePos1 = GetViewSpacePos(uv - sampleOffset);

    float weight0 = saturate(length(samplePos0-pixCenter) * falloffMul + falloffAdd);
    float horizonCos0 = max(horizonCos0, lerp(lowHorizonCos0, dot(sampleHorizonVec0,viewVec), weight0));
    // 同理 horizonCos1 ...
}
```

**闭式积分**：将地平线角 clamp 后代入 GTAO 论文公式：

```hlsl
// h0 = n + clamp(acos(horizonCos0)-n, -HALF_PI, HALF_PI)
// 同理 h1 (负向)
float val0 = (cosNorm + 2.0*h0*sin(n) - cos(2.0*h0 - n)) / 4.0;
float val1 = (cosNorm + 2.0*h1*sin(n) - cos(2.0*h1 - n)) / 4.0;
visibility += projectedNormalVecLength * (val0 + val1);
```

最终 `visibility = max(0.03, visibility / SLICE_COUNT)`，可见度 clamp 在 3% 防止完全死黑。

### 5.2 双边模糊与上采样

`BlurHorizontalMain`（`BLUR_THREAD_GROUP_SIZE=64,1,1`）缓存 AO+法线+深度后用 29-tap 高斯做水平模糊，`CacheGaussianBlur` 中对每个偏移 `i` 计算 `GetWeight(center, sample)*gauss[i+14]`。核心 getWeight 的实现（关键参数均已调优过）：

```hlsl
float GetWeight(float4 center, float4 samplePoint) {
    // 前两个分量编了 normalVS.xy*0.5+0.5 → 解码为视空间单位法线
    float4 unpacked = float4(center.yz, samplePoint.yz) * 2.0 - 1.0;
    float3 centerVS = float3(unpacked.xy, sqrt(max(0, 1-dot(unpacked.xy,unpacked.xy))));
    float3 sampleVS = float3(unpacked.zw, sqrt(max(0, 1-dot(unpacked.zw,unpacked.zw))));
    float normalWeight = pow(saturate(dot(centerVS, sampleVS)), 4.0);
    float depthWeight  = 1.0 - saturate(abs(center.w - samplePoint.w) * 300.0);
    return normalWeight * depthWeight;
}
```

上采样利用 `subpixelBias` 做双线性插值：

```hlsl
float2 signVal = sign(thisSubpixelBias - subpixelBias);   // (0,0) 固定→signVal=(0,0)
float thisAO = GetAOForBilinear(threadPos);
float leftAO = GetAOForBilinear(threadPos + signVal.x);   // 相邻像素
float finalAO = lerp(thisAO, leftAO, abs(thisSubpixelBias-subpixelBias) / (float)downFactor);
```

`BlurVerticalMain` 结构对称，维度 `(1,64,1)`，产出的 `_VerticalBlurBuffer` 即为全分辨率模糊 AO。

### 5.3 TemporalFilter：方差裁剪

```hlsl
void TemporalFilterMain(uint3 dispatchThreadID : SV_DispatchThreadID) {
    // 3×3 邻域统计均值/方差
    float m1=0, m2=0;
    for (y=-1..1) for (x=-1..1) {
        float s = _GTAOTexture[clamp(coord+int2(x,y), 0, maxCoord)].r;
        m1 += s;  m2 += s*s;
    }
    m1 /= 9; m2 /= 9;
    float sigma = sqrt(max(0, m2 - m1*m1));
    float lo = m1 - sigma * _VarianceClampScale;
    float hi = m1 + sigma * _VarianceClampScale;

    float histVis = clamp(_HistoryTexture[id].r, lo, hi);
    float result = lerp(curVis, histVis, _TemporalBlend);
    _RW_VisualizeTexture[id] = result;
}
```

不使用重投影，仅同屏坐标历史做方差约束的 lerp。若 `temporalBlend=0.9、clampScale=1.0`，收敛约需 10-15 帧，运动物体无明显拖影。

### 5.4 Multi-Bounce Composite

`GTAOMultiBounce` 在 `GTAOComposite.shader` 的 `Frag` 中，以**乘法形式**作用于已照亮场景。输入：前面步骤算好的 AO（从 `_GTAO_AOTexture` 采样）和 albedo（从 `_GBuffer0` 采样）。

**多项式拟合 + 能量守恒除法**：`MultiBounce(ao, albedo)` 输出的是"multiple-bounce visibility"，除以原始 `ao` 得到颜色恢复系数：

```hlsl
float3 GTAOComposite_MultiBounce(float vis, float3 albedo)
{
    float3 a =  2.0404*albedo - 0.3324;
    float3 b = -4.7951*albedo + 0.6417;
    float3 c =  2.7552*albedo + 0.6903;
    float3 x = saturate(vis);
    return saturate(max(x, ((x*a+b)*x+c)*x));       // multi-bounce visibility
}

// Frag 中:
float3 color = scene.rgb;
if (multiBounceOn) {
    float3 mbVis = MultiBounce(ao, albedo);
    float3 recovery = mbVis / max(ao, 0.08);          // >1 表示恢复比原始更亮
    color *= lerp(1.0, min(recovery, 2.0), mbStrength);
}
```

**三个关键 clamp**：
- `max(vis, ((vis*a+b)*vis+c)*vis)` — 确保恢复系数 ≥ 原始可见度（即不会让 AO 更暗）
- `max(ao, 0.08)` — 防止 visibility ≈ 0 时除以零产生 NaN
- `min(recovery, 2.0)` — 防止极低 AO + 高 albedo 组合下拟合外插爆炸

>Multi-Bounce 的乘法性质使其**不影响未遮蔽区**;（ao≈1 时 recovery≈1，`lerp(1,1,strength)=1`），只在遮蔽区起作用。
利用MultiBounce的混合逻辑，我们可以将gtao影响角度的扩散区域放大，且可以通过软边缘加强乘法的补偿强度将阴影变得更为明锐。
#### Multi-Bounce Comparision
针对不同的multi bounce，由于更多的阴影分布，将泛区域的光照修正了大部分，因此阴影的边缘会出现更多更为阴影清晰的边界。
##### Multi Off：
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17839257533521.png)
##### Multi On：
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17839258034824.png)

### 5.5 SSDO Composite

`GTAOComposite_ComputeSSDO` 以**加法形式**叠加到场景颜色。完整合成逻辑在 `Frag` 中先执行 SSDO、再执行 Multi-Bounce：

```hlsl
half4 Frag(Varyings input) : SV_Target {
    float4 scene = SAMPLE_TEXTURE2D_X(_MainTex, sampler_MainTex, input.uv);
    float  ao    = GTAOComposite_SampleAO(input.uv);
    float3 albedo = GTAOComposite_SampleAlbedo(input.uv);

    // === 阶段1: SSDO 反弹 (加法, 可选) ===
    float3 ssdo = 0;
    if (ssdoOn || debugSSDO)
        ssdo = GTAOComposite_ComputeSSDO(input.uv, ao, albedo);
    if (debugSSDO) return float4(ssdo, 1);          // debug模式直接输出bounce

    // === 阶段2: Multi-Bounce 颜色恢复 (乘法, 可选) ===
    float3 color = scene.rgb;
    if (multiBounceOn) {
        float3 recovery = MultiBounce(ao, albedo) / max(ao, 0.08);
        color *= lerp(1.0, min(recovery, 2.0), mbStrength);
    }

    // === 阶段3: 叠加 ===
    color += ssdo;                                   // 加法注入反弹光
    return float4(color, scene.a);
}
```

**执行顺序的理由**：SSDO 先算 bounce（依赖于周围像素的照亮颜色），Multi-Bounce 再在 bounce 叠加后的结果上做颜色恢复——这样反弹光也会被"恢复"到多重反弹的物理亮度。

**SSDO 采样权重构成**（三重调制，§3.3.3 详细推导过）：

```hlsl
float sampleOccl  = 1.0 - AO(sampleUV);
float depthWeight = saturate(1 - abs(LinearEyeDepth(depthCenter) - LinearEyeDepth(depthSample)) * 2.0);
float normalWeight = pow(saturate(dot(normalCenter, normalSample)*0.5 + 0.5), 2);
float weight      = depthWeight * normalWeight * sampleOccl;
```

**Output clamp**：最终 bounce 被限制在 `maxContribution`（默认 0.25），以防止在极亮区域因多次累积导致白爆。这个值随 `_GTAOSSDOParams.w` 可调。

### 5.6 落地时的一些修正点

本节记录本工程在落地 XeGTAO 参考实现后遇到的假阴影与视觉伪影，以及对应修复策略（均已硬编码进 `GTAOComputeShader.compute`）。

**逐帧 ghosting / 拖影**：原始 XeGTAO 用 `subpixelIndex = frameIndex % (down²)` 做逐帧像素内抖动（sub-pixel jitter），配合 TAA 帧间混合消噪。本工程**不依赖 TAA**，改为 `subpixelBias = int2(0,0)` 固定采样位置，确保每帧所有像素的采样相位完全不变，杜绝静止摄像机下的拖影。

**平面自遮挡（self-occlusion）**：原始 `pixelTooCloseThreshold = 1.3` 导致平地上的采样点被视为"遮蔽几何"的概率偏高，出现条纹状暗斑。经逐参数测试后改为 `pixelTooCloseThreshold = 3.0`（即 minS = 3.0/screenSpaceRadius），同时间 `_HorizonBias = 0.1` 把地平线函数的最小值向未遮蔽方向偏移，双管齐下消除平面假阴影。

**AO 跨越深度边界**：原始 `GetWeight` 中深度拒止系数为 100（`1-saturate(|dC-dS|*100)`），在远景薄壁/近景遮挡交界处 AO 仍会跨越深度跳变。提升至 **300**：深度 1cm 差的权重降至 0，只剩法线权重起作用。

**AO 沿硬边缘扩散**：原始法线拒止用 `dot(centerNormal, sampleNormal)` 在 edge 两侧仅轻微衰减，模糊后的 AO 在棱线两侧溢出。改为 `pow(dot(centerNormal, sampleNormal), 4.0)`，二次方差把权重在角度差 > 40° 时压到接近 0。

**寄存器压力（X4714）**：原 `32×32=1024` 线程组每线程寄存器预算仅约 16，`GTAOMain` 内巨大的切片+step 内循环 + 多个 groupshared 变量导致 SM 占用率不足。线程组降到 `16×16=256`，寄存器预算升至约 64，occupancy 提升 2-3 倍。
## 6. References

1. **Jorge Jimenez, Xian-Chun Wu, Angelo Pesce, Adrian Jarabo.** "Practical Real-Time Strategies for Accurate Indirect Occlusion." *SIGGRAPH 2016*. — GTAO  [PDF](https://www.activision.com/cdn/research/Practical_Real_Time_Strategies_for_Accurate_Indirect_Occlusion_NEW%20VERSION_COLOR.pdf)
2. **Intel, Anton Sochenov et al.** "XeGTAO — Ground Truth Ambient Occlusion." *Intel Game Tech*. — 工业级开源参考（Hilbert+R2、Horizon Bias）。 [GitHub](https://github.com/GameTechDev/XeGTAO)
3. **Morgan McGuire et al.** "A Panorama of Ambient Occlusion / Polynomial Multi-Bounce Approximation." — §3.2 Multi-Bounce 多项式拟合来源。
4. **Unity Technologies.** "URP Scriptable Renderer Features & Screen Space Ambient Occlusion." *Unity Manual*. — `_ScreenSpaceOcclusionTexture`、`AfterRenderingGbuffer` 集成依据。

