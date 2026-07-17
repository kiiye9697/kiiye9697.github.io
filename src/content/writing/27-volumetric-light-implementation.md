---
title: "Unity URP：体积光实现"
course: "Classic Sponza Showcase"
source: "Assets/OurFunction/VolumetricLight/"
order: 27
---

# Unity URP：体积光实现

> 基于 URP ScriptableRendererFeature 的屏幕空间体积光（Volumetric Light Scattering），采用 Ray Marching + 深度感知 Bilateral Blur 双 Pass 管线：低分辨率 Ray March 累积散射光 → 多次 Bilateral Blur 去噪 → Composite 加色合成到场景。支持 Henyey-Greenstein 相位函数、指数高度衰减、主光源实时阴影采样、Bayer 4×4 抖动、多级 Debug 视图。
>
> 代码位于项目 `Assets/OurFunction/VolumetricLight/`，包含：`VolumetricLightRenderFeature.cs`、`VolumetricLight.shader`。

## 1. Introduction
### Showcase
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E5%8A%A8%E7%94%BB.gif)
1. 光照mask位置
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17842750253238.png)
2. 叠加后效果
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17842751299580.png)
3. 原始效果
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17842752296779.png)

### 1.1 传统方案缺陷

- **传统方法**：游戏引擎中体积光（God Rays / Light Shafts）的常见做法包括后处理径向模糊（Radial Blur）和屏幕空间 Ray Marching。
  问题所在：
- 第一，**径向模糊缺乏物理准确性**——以光源屏幕坐标为中心做放射状模糊，不考虑深度遮挡、散射密度、距离衰减，产生"穿透几何"的伪影；
- 第二，**全分辨率 Ray Marching 性能昂贵**——1080p 下 64-128 步的 per-pixel Marching 需要 3-8ms，必须降到低分辨率；
- 第三，**低分辨率上采样 artifact**——简单的 bilinear 上采样导致光柱边缘锯齿和块状 artifact，需要深度感知的去噪。
### 1.2 解决方法

- **核心机制**：**低分辨率 Ray Marching + 深度感知 Bilateral Blur**——在 1/2 或 1/4 分辨率做 Ray Marching（4-128 步可调，Bayer 4×4 抖动），累积沿视线方向的散射光（含主光源阴影采样 + 指数高度衰减），然后通过可配置次数的 Bilateral Blur（深度差做高斯衰减权重）去噪 + 上采样，最后加色合成回全分辨率场景。
- **架构**：`VolumetricLightRenderFeature` 在 `BeforeRenderingPostProcessing` 注入，仅 Game 相机、需主光源存在。3 个主要 Pass + 2 个 Debug Pass。
## 2. KeyWords

| 关键词 | 简单解释 | 在本实现中的具体职责 |
| :--- | :--- | :--- |
| **辐射传输方程 (RTE)** | 描述辐射在参与介质中传输的微分方程 | 单次散射近似的理论基础 |
| **Beer-Lambert 定律** | 透射率 $T=\exp(-\tau)$，光学深度 $\tau$ | `transmittance *= exp(-extinction)` 累乘 |
| **Henyey-Greenstein 相位函数** | 描述散射角分布（前向/后向散射强度） | `HenyeyGreenstein(dot(-rayDir, lightDir), g)` |
| **单次散射近似** | 假设光只散射一次进入视线 | 散射积分公式简化为单重积分 |
| **指数高度衰减** | 散射密度随世界 Y 升高指数降低 | `density *= exp(-(height-base) * falloff)` |
| **Bilateral Filter** | 空域高斯 × 深度域指数权重的边缘保持滤波 | `exp(-|depthC-depthS|/threshold)` 防跨边缘泄漏 |
| **Bayer 4×4 有序抖动** | 蓝噪声近似的空域确定型抖动 | `Bayer4x4(pixelPos)` 偏移每步起始位置 |
| **中点黎曼和** | 数值积分：采样在步长中点 | `(i + jitter + 0.5) * stepLength` |

## 3. Technical Breakdown

### 3.1 参与介质渲染方程：从物理到离散

#### 3.1.1 辐射传输方程（Radiative Transfer Equation）

体积光的物理基础是**辐射传输方程**。在一维参与介质中，沿视线方向 $\hat v$ 传播的辐射亮度 $L$ 满足：

$$
\frac{dL(s)}{ds} = -\sigma_t(s)\,L(s) + \sigma_s(s)\!\int_{4\pi} p(\hat\omega',\hat\omega)\,L(\hat\omega')\,d\hat\omega' + Q(s)
$$

三项分别对应：
- **消光** $-\sigma_t L$：辐射被吸收+散射出视线，$\sigma_t = \sigma_a + \sigma_s$（吸收系数 + 散射系数）
- **内散射** $\sigma_s \int p\,L\,d\omega'$：其他方向的辐射被散射进视线
- **自发辐射** $Q$：介质自身发光（大气/雾中通常为 0）

#### 3.1.2 单次散射近似

完整 RTE 的内散射项是一个 4π 立体角积分，实时渲染无法求解。**单次散射近似**假设光只从主光源散射一次进入视线（忽略多次散射和环境光散射），RTE 退化为沿视线的标量积分：

$$
L_{\text{scatter}} = \int_0^D T(0,t)\,\sigma_s(t)\,p(\theta)\,L_{\text{light}}\,V(t)\,\mathrm dt
$$

各项物理含义：
- $T(0,t) = \exp\!\left(-\int_0^t \sigma_t(s)\,\mathrm ds\right)$：**透射率**——从相机到采样点 $t$ 的辐射被介质衰减后剩余的比例
- $\sigma_s(t)$：采样点的散射系数（本实现中 = `density × heightAttenuation`）
- $p(\theta)$：**相位函数**在散射角 $\theta = \angle(\hat v, \hat L)$ 处的值
- $L_{\text{light}}$：主光源辐射度
- $V(t) \in [0,1]$：**可见性函数**（shadow map 采样结果）

> **纯散射介质假设**：本实现令 $\sigma_a = 0$（无吸收），所以 $\sigma_t = \sigma_s = \sigma$。消光完全由散射导致——这是雾/体积光的常见简化。对于烟尘等强吸收介质需分别指定 $\sigma_a$ 和 $\sigma_s$。

#### 3.1.3 完整解与合成

RTE 沿视线的完整解为：

$$
L_{\text{total}} = \underbrace{T(0,D)\,L_{\text{surface}}}_{\text{透射衰减的表面色}} + \underbrace{\int_0^D T(0,t)\,\sigma_s(t)\,p(\theta)\,L_{\text{light}}\,V(t)\,\mathrm dt}_{\text{散射积分}}
$$

本实现的 Composite Pass 只做了第二项的加法合成（`source.rgb + volumetric`），**省略了第一项的透射率衰减**——即假设雾密度足够低，表面颜色不被介质衰减。这是游戏工业的常见简化；浓雾场景需补回 `source.rgb *= finalTransmittance`。

### 3.2 Beer-Lambert 定律与透射率累乘

透射率 $T$ 遵循 **Beer-Lambert 定律**：

$$
T(0, t) = \exp\!\left(-\int_0^t \sigma(s)\,\mathrm ds\right) = \exp(-\tau)
$$

其中 $\tau = \int_0^t \sigma(s)\,\mathrm ds$ 是**光学深度**（optical depth）。离散化时，将积分拆为 $N$ 步，每步光学深度增量 $\Delta\tau_i = \sigma_i \cdot \Delta s$，透射率以**累乘**形式更新：

$$
T_{i+1} = T_i \cdot \exp(-\Delta\tau_i)
$$

```hlsl
float transmittance = 1.0;
float accumulatedLight = 0.0;

for (int i = 0; i < 128; ++i) {
    // ... 计算 localDensity, shadow ...
    float extinction = localDensity * stepLength;        // Δτ = σ · Δs
    accumulatedLight += transmittance * shadow * extinction;
    transmittance *= exp(-extinction);                   // T_{i+1} = T_i · exp(-Δτ)
}
```

**累乘 vs 重算**：若每步重算 $T_i = \exp(-\sum_{j<i} \Delta\tau_j)$，需要 $O(N^2)$ 次指数运算；累乘形式只需 $O(N)$ 次，这正是 Ray Marching 的核心计算优势。

### 3.3 Henyey-Greenstein 相位函数

#### 3.3.1 物理来源与数学性质

HG 相位函数源自天体物理学（Henyey & Greenstein 1941），描述电磁辐射在粒子介质中的角度散射分布：

$$
p(\cos\theta,\, g) = \frac{1-g^2}{4\pi\,(1+g^2-2g\cos\theta)^{3/2}}
$$

数学性质：
- **归一化**：$\int_{4\pi} p(\cos\theta, g)\,\mathrm d\omega = 1$（概率密度函数）
- **不对称因子** $g = \langle\cos\theta\rangle$：散射角余弦的期望值
  - $g=0$：各向同性散射（Rayleigh 极限，小分子）
  - $g>0$：前向散射（光继续沿原方向传播的概率高）
  - $g<0$：后向散射
- 本实现 `g=0.55`：强前向散射，符合大气雾粒子的米氏散射（Mie scattering）特性

#### 3.3.2 散射角的几何含义

代码中 `cosTheta = dot(-rayDir, lightDir)`：
- `-rayDir`：从采样点指向相机的方向（散射后的观察方向 $\hat\omega_o$）
- `lightDir`：从采样点指向光源的方向（`mainLight.direction`，即入射光方向 $\hat\omega_i$）
- 两者点积 = 散射角 $\theta$ 的余弦

```hlsl
float3 lightDir = normalize(mainLight.direction);
float phase = HenyeyGreenstein(dot(-rayDir, lightDir), _PhaseParams.x);
```

#### 3.3.3 前向散射的视觉效果

$g=0.55$ 时，不同散射角的 phase 值：

| 散射角 $\theta$ | $\cos\theta$ | phase | 场景 |
| :--- | :--- | :--- | :--- |
| 0°（顺光） | +1 | ~0.62 | 光源在相机背后，散射后继续向前→相机看到强散射 |
| 90°（侧光） | 0 | ~0.044 | 侧向散射弱 |
| 180°（逆光） | −1 | ~0.015 | 光源在相机正前方，需 180° 散射才能进入视线 |

> **物理正确性**：前向散射（$g>0$）意味着顺光方向（光源在背后）phase 值高。实际游戏中"god rays"常在逆光时最明显——这是因为逆光时 `accumulatedLight`（视线穿过被照亮介质的总量）大，补偿了 phase 的低值。本实现的物理方向是正确的。部分游戏为增强逆光效果会反转 $g$ 符号或用 $\cos\theta$ 取负，属于美术导向的非物理调整。

### 3.4 Ray Marching 数值积分：中点黎曼和

散射积分 $\int_0^D f(t)\,\mathrm dt$ 用**中点黎曼和**（midpoint Riemann sum）离散化：

$$
\int_0^D f(t)\,\mathrm dt \approx \sum_{i=0}^{N-1} f\!\left((i+\tfrac{1}{2})\,\Delta s\right) \cdot \Delta s, \qquad \Delta s = \frac{D}{N}
$$

代码中 `(i + jitter + 0.5) * stepLength` 的 `+0.5` 即中点偏移——采样在每个步长区间的中点而非端点，将截断误差从 $O(\Delta s)$（左/右端点黎曼和）降低到 $O(\Delta s^2)$（中点法则）。

```hlsl
float steps = clamp(_RayMarchParams.x, 4.0, 128.0);
float stepLength = sceneDistance / steps;                        // Δs = D/N
float jitter = Bayer4x4(input.positionCS.xy) * _PhaseParams.y;   // 抖动偏移

for (int i = 0; i < 128; ++i) {
    if (i >= (int)steps) break;
    float currentDistance = (i + jitter + 0.5) * stepLength;      // 中点 + 抖动
    float3 samplePosition = _WorldSpaceCameraPos.xyz + rayDir * currentDistance;
    // ... 累积散射 ...
}
```

**步数与误差**：步长 $\Delta s = D/N$，误差 $\propto \Delta s^2 \propto 1/N^2$。但成本 $\propto N$。本实现默认 $N=32$，在 50m 距离内步长 ~1.5m，配合抖动 + blur 足够消除 banding。

### 3.5 指数高度衰减：大气分层模型

散射密度随世界 Y 坐标指数衰减，模拟低空浓雾、高空清澈的分层大气：

$$
\sigma(h) = \sigma_0 \cdot \exp\!\left(-\max(h - h_0,\,0) \cdot \beta\right)
$$

```hlsl
float localDensity = max(_RayMarchParams.w, 0.0);        // σ_0 = density
if (_HeightParams.y > 1e-5) {
    float heightAboveBase = max(samplePosition.y - _HeightParams.x, 0.0);
    localDensity *= exp(-heightAboveBase * _HeightParams.y);   // × exp(-(h-h₀)·β)
}
```

- $\sigma_0$ = `density`（默认 0.035）：海平面（$h=h_0$）的基准密度
- $h_0$ = `heightFogBase`（默认 0）：雾层基准高度
- $\beta$ = `heightFalloff`（默认 0.08）：高度衰减率。$\beta=0.08$ 时每升高 12.5m 密度减为 $1/e$

> **物理对应**：真实大气遵循**标准大气模型**（$\sigma \propto \exp(-h/H)$，标高 $H\approx 8\text{km}$）。游戏中的 $\beta$ 远大于真实值以在几米尺度内产生可见衰减。

### 3.6 主光源阴影采样：可见性函数 $V(t)$

单次散射积分中的 $V(t)$ 是可见性函数——采样点是否被主光源直接照亮。通过 URP 的 Shadow Map 实现：

```hlsl
float4 shadowCoord = TransformWorldToShadowCoord(samplePosition + lightDir * _PhaseParams.w);
float shadow = MainLightRealtimeShadow(shadowCoord);
shadow = lerp(1.0, shadow, saturate(_PhaseParams.z));   // shadowStrength 混合
```

- **`+ lightDir * bias`**：沿光源方向偏移采样点，防止因 Shadow Map 精度不足导致的自阴影 acne（采样点投影到自身表面）
- **`lerp(1.0, shadow, shadowStrength)`**：`shadowStrength=0` 时完全忽略阴影（全亮），`=1` 时完全使用 shadow map。中间值做线性混合，给美术调节空间

> **阴影质量限制**：URP 的主光源 Shadow Map 分辨率有限（通常 2048²），远处采样点的 shadow coord 精度下降，可能产生阴影闪烁。体积光对阴影质量比表面光照更敏感（每步都采样），建议开启 `_SHADOWS_SOFT` 软阴影。

### 3.7 Bayer 4×4 有序抖动：蓝噪声近似

Ray Marching 的离散步进在低步数时产生**相干 banding**——等距采样点在密度变化处产生阶梯状条纹。Bayer 4×4 有序抖动矩阵给每个像素一个确定型偏移，打破相干性：

```hlsl
float Bayer4x4(float2 pixelPosition) {
    uint x = (uint)fmod(pixelPosition.x, 4.0);
    uint y = (uint)fmod(pixelPosition.y, 4.0);
    // 查表返回 0/16 ~ 15/16 的 4×4 Bayer pattern
    // ...
}
float jitter = Bayer4x4(input.positionCS.xy) * _PhaseParams.y;
float currentDistance = (i + jitter + 0.5) * stepLength;
```

#### 3.7.1 蓝噪声特性

Bayer 矩阵在频域上把噪声能量推向**高频**（蓝噪声谱）。相比白噪声（全频谱均匀），蓝噪声的高频特性使得：
- banding（低频）被转化为高频噪声
- 高频噪声在视觉上更不敏感（人眼对低频更敏感）
- 高频噪声更容易被后续 Bilateral Blur 消除

#### 3.7.2 与其他抖动方案对比

| 方案 | 类型 | 优势 | 劣势 |
| :--- | :--- | :--- | :--- |
| **Bayer 4×4**（本实现） | 空域确定型 | 零 RNG 开销、蓝噪声近似 | 4×4 重复周期可见 |
| Halton 序列 | 时域低差异 | 配合 TAA 时域累积最佳 | 无 TAA 时无效 |
| IGN (Interleaved Gradient Noise) | 时域+空域 | 兼顾空域分布与时域变化 | 需要帧索引 |
| White Noise | 随机 | 无重复 pattern | 非蓝噪声，blur 后残留明显 |

本实现选择 Bayer 4×4 是因为不依赖 TAA（项目 TAA 默认关闭），纯空域抖动在 blur 后即可去噪。

### 3.8 深度感知 Bilateral Filter

低分辨率 Ray Marching 产生的散射纹理有噪声和锯齿。标准高斯模糊会导致光柱边缘"泄漏"到几何体后方（前景物体的散射光被抹到背景上）。Bilateral Filter 在空域高斯权重上乘以**深度域权重**：

$$
w(\mathbf{x}, \mathbf{y}) = \underbrace{g(\|\mathbf{x}-\mathbf{y}\|)}_{\text{空域高斯}} \cdot \underbrace{d(|z_\mathbf{x} - z_\mathbf{y}|)}_{\text{深度域权重}}
$$

#### 3.8.1 深度域权重：指数衰减

```hlsl
float depthWeight = exp(-abs(sampleDepth - centerDepth) / depthThreshold);
float weight = baseWeight * depthWeight;
```

采用**指数衰减**而非硬阈值截断（$\Delta z < \tau \,?\, 1 : 0$）。指数衰减在边缘处平滑过渡，避免二值化产生的硬边。$\tau$ = `depthAwareBlurThreshold`（默认 0.35）控制衰减速度——深度差超过 $\tau$ 时权重降至 $1/e \approx 0.37$。

#### 3.8.2 7-tap 可分离高斯

```
权重分布:  0.05  0.10  0.15  [0.40]  0.15  0.10  0.05
偏移:      -3    -2    -1     0      +1    +2    +3
```

7-tap 水平 + 7-tap 垂直（separable 实现）等价于 49-tap 二维卷积的近似，计算量从 $O(r^2)$ 降到 $O(r)$。`blurIterations`（默认 2）次水平+垂直 Ping-Pong（`LowResA ↔ LowResB`）进一步扩展等效模糊半径。

#### 3.8.3 完整 Blur Pass

```hlsl
half4 FragBlur(Varyings input) : SV_Target
{
    float2 offset = _BlurDirection.xy * _SourceTexelSize.xy;   // blurRadius × texel
    float centerDepth = LinearEyeDepth(SampleSceneDepth(input.uv), _ZBufferParams);
    float depthThreshold = max(_HeightParams.z, 0.01);

    half3 color = 0.0h;
    float weightSum = 0.0;

    #define ADD_BLUR_SAMPLE(uvOffset, baseWeight) {                              \
        float2 sampleUv = input.uv + uvOffset;                                    \
        float sampleDepth = LinearEyeDepth(SampleSceneDepth(sampleUv), _ZBufferParams); \
        float depthWeight = exp(-abs(sampleDepth - centerDepth) / depthThreshold); \
        float weight = baseWeight * depthWeight;                                  \
        color += SAMPLE_TEXTURE2D_X(_MainTex, sampler_MainTex, sampleUv).rgb * weight; \
        weightSum += weight;                                                      \
    }

    ADD_BLUR_SAMPLE(0.0,           0.40)   // 中心
    ADD_BLUR_SAMPLE(offset,        0.15)   // ±1
    ADD_BLUR_SAMPLE(-offset,       0.15)
    ADD_BLUR_SAMPLE(offset * 2.0,  0.10)   // ±2
    ADD_BLUR_SAMPLE(-offset * 2.0, 0.10)
    ADD_BLUR_SAMPLE(offset * 3.0,  0.05)   // ±3
    ADD_BLUR_SAMPLE(-offset * 3.0, 0.05)

    #undef ADD_BLUR_SAMPLE
    return half4(color / max(weightSum, 1e-4), 1.0h);   // 归一化
}
```

> **归一化**：`color / weightSum` 保证模糊不改变整体亮度。当所有样本深度差异大（weightSum→0）时 `max(weightSum, 1e-4)` 防除零，退化为只输出中心像素。

### 3.9 Composite：加法合成

```hlsl
half4 FragComposite(Varyings input) : SV_Target
{
    half4 source = SAMPLE_TEXTURE2D_X(_MainTex, sampler_MainTex, input.uv);
    half3 volumetric = SAMPLE_TEXTURE2D_X(_VolumetricTex, sampler_VolumetricTex, input.uv).rgb;
    return half4(source.rgb + volumetric, source.a);
}
```

加法合成物理正确——散射积分计算的是 **in-scattering 项**（被散射进视线的额外辐射），应叠加到表面辐射上。注意此处省略了表面颜色的透射率衰减（见 §3.1.3）。

### 3.10 天空盒特殊处理

天空盒像素的深度为 0（Reversed-Z），`ComputeWorldSpacePosition` 会还原出极远的世界坐标。若用真实距离做 ray march，步长趋于无穷，几乎无采样点落在有限范围内。代码将天空盒的有效距离强制为 `maxDistance`：

```hlsl
float sceneDistance = isSky ? maxDistance : min(rayDistance, maxDistance);
```

物理上天空盒在无限远，但视觉上等价于"假设远处介质密度已衰减殆尽，只积分近场 50m"。对大气雾是合理近似。

### 3.11 光源能量提前剔除

```hlsl
float lightEnergy = max(lightColor.r, max(lightColor.g, lightColor.b));
if (lightEnergy <= 1e-4) return 0;   // 主光源几乎无能量 → 跳过整个 ray march
```

夜间场景或主光源被关闭时提前返回 0，避免无意义的 128 步循环。

## 4. 执行时机与 URP 管线架构

### 4.1 管线插入点

```
═══════════════════════════════════════════════════════════════
URP 一帧

 (1) Depth PrePass → _CameraDepthTexture
 (2) DrawOpaqueObjects → cameraColorTarget
 (3) DrawTransparents / Skybox

 (4) ★ BeforeRenderingPostProcessing ★              [Volumetric Light Pass]
       │  ┌─ VolumetricLightPass.Execute ────────────┐
       │  │  OnCameraSetup:                           │
       │  │    分配 SourceCopy (full²) + LowResA/B    │
       │  │    (full/downsample) + 3 张 Debug RT      │
       │  │                                           │
       │  │  1. Blit(source → SourceCopy)             │
       │  │  2. Pass0 RayMarch:                       │
       │  │       DrawProcedural(SourceCopy → LowResA) │
       │  │       → 128 步 Ray Marching + 阴影 + 相位 │
       │  │       → 输出散射光 (低分辨率)              │
       │  │  3. Pass1 Blur × blurIterations:          │
       │  │       for i=0..blurIterations-1:          │
       │  │         Horizontal: LowResA → LowResB      │
       │  │         Vertical:   LowResB → LowResA      │
       │  │  4. Pass2 Composite:                      │
       │  │       DrawProcedural(LowResA → source)     │
       │  │       → 散射光 + 场景颜色 (自动上采样)     │
       │  └───────────────────────────────────────────┘

 (5) Post-Processing → Present
═══════════════════════════════════════════════════════════════
```
> **为什么在 Transparents 之后**：体积光叠加到已完成的场景颜色上（含半透明物体），散射光不应出现在透明物体"背后"。

### 4.2 主光源依赖

```csharp
if (renderingData.lightData.mainLightIndex < 0) return;  // 无主光源→跳过
```
体积光必须依赖场景中的主方向光（`GetMainLight()`），无主光源时整个 Pass 不入队。

### 4.3 RT 与内存

| RT | 分辨率 | 用途 |
| :--- | :--- | :--- |
| `_Volumetric_SourceCopy` | full² | 场景拷贝 |
| `_Volumetric_LowResA` | full/downsample | RayMarch 输出 / Blur Ping |
| `_Volumetric_LowResB` | full/downsample | Blur Pong |
| `_Volumetric_Debug_*` × 3 | full² 或 lowRes | Debug 视图专用 |

1080p、downsample=2 时，RayMarch+Blur 工作分辨率 960×540，3 张低分辨率 RT 合计 ~6MB，+ 场景拷贝 ~8MB。

### 4.4 参数打包策略

C# 端将 13 个参数打包为 4 个 `Vector4` 传入 shader，减少 `SetFloat` 调用开销：

```csharp
Vector4 rayMarchParams = new Vector4(steps, maxDistance, intensity, density);   // _RayMarchParams
Vector4 phaseParams    = new Vector4(anisotropy, jitterStrength, shadowStrength, shadowBias); // _PhaseParams
Vector4 heightParams   = new Vector4(heightFogBase, heightFalloff, depthAwareBlurThreshold, 0); // _HeightParams
// + _ScatteringTint (Color) + _SourceTexelSize (Vector4) + _BlurDirection (Vector4)
```

`_HeightParams.z` 复用为 blur 的 `depthAwareBlurThreshold`——blur pass 和 ray march pass 共享同一个 HeightParams 向量，减少参数传递。

## 5. 实现细节与关键代码

### 5.1 DrawFullscreen 封装

```csharp
private void DrawFullscreen(CommandBuffer cmd, RenderTargetIdentifier dest,
                             RenderTargetIdentifier source, int passIndex)
{
    cmd.SetGlobalTexture(MainTexId, source);
    cmd.SetRenderTarget(dest, RenderBufferLoadAction.DontCare, RenderBufferStoreAction.Store);
    cmd.DrawProcedural(Matrix4x4.identity, material, passIndex, MeshTopology.Triangles, 3, 1);
}
```

所有 Pass 统一用 `DrawProcedural` + 全屏三角（3 顶点），通过 `SetGlobalTexture(_MainTex, source)` 传递输入。相比 `cmd.Blit`，`DrawProcedural` 在 URP 下顶点变换更稳定（避免 Blit 内部 MVP 不一致导致黑屏）。

### 5.2 RayMarch Pass 完整流程

```hlsl
half4 FragRayMarch(Varyings input) : SV_Target
{
    // 1) 深度 → 世界空间重建
    float rawDepth = SampleSceneDepth(input.uv);
    bool isSky = /* Reversed-Z 判断 */;
    float3 worldPos = ComputeWorldSpacePosition(input.uv, rawDepth, UNITY_MATRIX_I_VP);
    float3 rayVec = worldPos - _WorldSpaceCameraPos.xyz;
    float rayDistance = length(rayVec);
    float3 rayDir = rayVec / max(rayDistance, 1e-5);

    // 2) 有效积分距离（天空盒截断为 maxDistance）
    float sceneDistance = isSky ? maxDistance : min(rayDistance, maxDistance);

    // 3) 主光源 + 相位函数
    Light mainLight = GetMainLight();
    float3 lightDir = normalize(mainLight.direction);
    float phase = HenyeyGreenstein(dot(-rayDir, lightDir), anisotropy);

    // 4) 中点黎曼和 + Bayer 抖动
    float stepLength = sceneDistance / steps;
    float jitter = Bayer4x4(input.positionCS.xy) * jitterStrength;

    // 5) 透射率累乘积分
    float transmittance = 1.0, accumulatedLight = 0.0;
    for (int i = 0; i < 128; ++i) {
        if (i >= steps) break;
        float3 samplePos = cameraPos + rayDir * (i + jitter + 0.5) * stepLength;

        float density = baseDensity * exp(-max(samplePos.y - heightBase, 0) * heightFalloff);
        float shadow = lerp(1.0, MainLightRealtimeShadow(shadowCoord), shadowStrength);

        float extinction = density * stepLength;              // Δτ
        accumulatedLight += transmittance * shadow * extinction;
        transmittance *= exp(-extinction);                    // T累乘
    }

    // 6) 相位 × 强度 × 色调 × 光色
    float3 scattering = accumulatedLight * phase * intensity * scatteringTint * lightColor;
    return half4(scattering, 1.0);
}
```

### 5.3 多级 Debug

| `debugView` | 输出 |
| :--- | :--- |
| Off | 正常体积光合成 |
| SourceCapture | 原始场景拷贝 |
| RawLight | RayMarch 原始散射光（低分辨率，blur 前） |
| BlurredLight | Blur 后散射光（低分辨率） |

Debug 纹理同时暴露为全局纹理（`_VolumetricLight_Debug_*`），可在 Frame Debugger 或外部材质中查看。`LogDebugInfo` 可选定时输出主光源信息、低分辨率尺寸、blur 参数等到 Console。

### 5.4 参数一览与调参指南

| 参数 | 默认值 | 说明 | 调参建议 |
| :--- | :--- | :--- | :--- |
| `scatteringTint` | 暖黄 (1.0, 0.95, 0.85) | 散射光色调 | HDR 可超 1.0 增强亮度 |
| `intensity` | 0.35 | 散射强度 | 0.1~1.0，配合 density 调 |
| `density` | 0.035 | 散射密度基数 σ₀ | 0.02 稀薄，0.1 浓雾 |
| `anisotropy` | 0.55 | HG 不对称因子 g | 0.3~0.8，越大前向散射越强 |
| `maxDistance` | 50 | 最大积分距离 (米) | 场景越大可增大，但步数需同步增 |
| `heightFogBase` | 0 | 雾层基准高度 (世界 Y) | 设为水面/地面高度 |
| `heightFalloff` | 0.08 | 高度衰减率 β | 0.05 平缓，0.2 锐利分层 |
| `shadowStrength` | 1.0 | 阴影强度 | 0=无阴影全亮，1=完全遵循 shadow map |
| `shadowBias` | 0.05 | 阴影偏移 | acne 时增大，peter-panning 时减小 |
| `jitterStrength` | 1.0 | Bayer 抖动强度 | 0=无抖动（banding），1=全幅抖动 |
| `rayMarchSteps` | 32 | Ray March 步数 | 16 低画质，64 高画质，128 极致 |
| `downsample` | 2 | 降采样倍数 | 1 全分辨率（慢），4 极低分辨率（快但糊） |
| `blurIterations` | 2 | Bilateral Blur 次数 | 0=无 blur（噪声），4=高度平滑 |
| `blurRadius` | 1.0 | 模糊半径 (像素) | 0.5 锐利，3.0 大范围扩散 |
| `depthAwareBlurThreshold` | 0.35 | 深度拒止阈值 τ | 0.1 强边缘保持，1.0 几乎无拒止 |

## 6. References

1. **E. J. McCartney.** "Optics of the Atmosphere: Scattering by Molecules and Particles." *John Wiley & Sons, 1976*. — 大气散射物理模型，辐射传输方程与消光系数。
2. **L. G. Henyey, J. L. Greenstein.** "Diffuse Radiation in the Galaxy." *Astrophysical Journal, 88, 70-83, 1941*. — Henyey-Greenstein 相位函数原始论文。
3. **Matt Pharr, Wenzel Jakob, Greg Humphreys.** "Physically Based Rendering: From Theory to Implementation." *Chapter 11: Volume Scattering / Chapter 15: Light Transport in Participating Media*. — 辐射传输方程推导、单次散射近似、Ray Marching 数值积分。
4. **Bart Wronski.** "Volumetric Fog: Unified Compute Shader Based Solution." *SIGGRAPH 2014 / Assassin's Creed IV*. — 低分辨率 Ray Marching + Bilateral Blur 降噪范式，工业级体积雾实现。
5. **C. Wyman, C. Dachsbacher.** "Implementing Improved Noise for Volumetric Effects." *GPU Pro 5*. — Bayer 有序抖动与蓝噪声在体积效果中的应用。
6. **S. G. Narasimhan, S. K. Nayar.** "Contrast Restoration of Weather Degraded Images." *IEEE TPAMI, 2003*. — 大气散射模型与 Beer-Lambert 定律在计算机视觉中的应用。
7. **Unity Technologies.** "URP Scriptable Renderer Features / Main Light Shadows / DeclareDepthTexture." *Unity Manual*.
