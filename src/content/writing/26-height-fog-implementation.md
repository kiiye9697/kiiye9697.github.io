---
title: "Unity URP：高度雾实现"
course: "Classic Sponza Showcase"
source: "Assets/OurFunction/Fog/"
order: 26
---


> 基于 URP ScriptableRendererFeature 的全屏后处理高度雾（Height Fog）
> 采用**解析指数高度积分**替代传统 Raymarching，在一个 DrawProcedural 全屏三角内完成：
> 深度→世界空间重建、高度依赖消光系数、距离淡入
> 天空盒消散、Henyey-Greenstein 方向光散射。
## 1. Introduction
#### Showcase
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17841675124359.png)
### 1.1 Why Height Fog

- **传统方法**：游戏引擎中高度雾的常见做法有两种——**Raymarching（体积雾）** 和 **简单指数雾**。
  问题所在：
- 第一，**Raymarching 性能昂贵**——沿视线方向步进采样（通常 64-128 步），每步做一次高度函数求值 + 一次纹理采样，在全分辨率后处理中开销极高（1080p 下约 2-5ms）；
- 第二，**简单指数雾缺乏高度感**——`fogAmount = 1 - exp(-density * distance)` 只随距离变化，无法表达"低处有雾、高处清澈"的空间层次，雾气均匀糊满整个场景；
- 第三，**天空盒处理不当**——简单指数雾把天空盒当无限远处理，导致天顶区域也被染上雾色，而非自然地向天顶消散。
### 1.2 解决方法 (解析高度雾)

- 从数值解法简化成不含积分的解析方法：我们将高度依赖的消光系数 $\sigma(h) = a \cdot e^{-b(h-h_0)}$（$a$ = 密度，$b$ = 高度衰减率）沿视线方向做**解析积分**（而非离散 Raymarching），利用指数函数积分的闭式解，在 frag shader 内一个公式完成从相机到像素（或天空盒无穷远）的透射率计算：
  $$T = \exp\!\left(-\int_0^D \sigma\big(h_c + t\cdot\hat v_y\big)\,\mathrm dt\right) = \exp\!\left(-\frac{a}{b}e^{-b\cdot h_c}\cdot\frac{1-e^{-b D\cdot\hat v_y}}{\hat v_y}\right)$$
  当视线平行于地面（$\hat v_y\to 0$）时退化为 $T=\exp(-a D\cdot e^{-b\cdot h_c})$，数值稳定。
- **关键信息**：全屏后处理、单 Pass、零额外 RT 开销（仅 1 张临时拷贝）；雾密度随世界空间 Y 坐标指数衰减，低处浓、高处清；近处淡入防前景被雾吞没；天空盒向天顶消散；方向光散射（Henyey-Greenstein 相位函数）让逆光方向雾更亮。

## 2. KeyWords

| 关键词                                   | 简单解释                                         | 在本实现中的具体职责                                                  |
| :------------------------------------ | :------------------------------------------- | :---------------------------------------------------------- |
| **解析高度积分 (Analytic Height Integral)** | 沿视线对指数高度衰减消光系数做闭式积分                          | `Frag` 中 `fogAmount` 的单公式计算，替代 Raymarching                  |
| **指数消光系数 $\sigma(h)$**                | 密度随高度指数衰减：$\sigma(h) = a\cdot e^{-b(h-h_0)}$ | `_FogDensity`($a$) × `_HeightFalloff`($b$) 控制雾的垂直分布         |
| **Proximity Fade**                    | 近处平滑淡入，避免摄像机前雾完全遮蔽                           | `smoothstep(start, start+fadeRange, dist)`                  |
| **Skybox Zenith Fade**                | 天空盒向上看时雾消散                                   | `rayDir.y > 0` 时 `fogAmount /= (1 + rayDir.y * zenithFade)` |
| **Henyey-Greenstein 相位函数**            | 描述雾中方向光的散射角分布                                | `HenyeyGreenstein(dot(rayDir, lightDir), g)` 控制逆光/顺光亮暗      |
| **DrawProcedural**                    | 用 GPU 程序化生成全屏三角，无需 Mesh/Vertex Buffer        | `cmd.DrawProcedural(identity, mat, 0, Triangles, 3, 1)`     |

## 3. Technical Breakdown

### 3.1 Physic solution

#### 3.1.1 消光模型

雾的物理本质是介质对光的散射+吸收，消光系数 $\sigma$ 描述单位距离上光被衰减的比例。高度雾的核心假设是 $\sigma$ 仅随世界空间高度 $h$ 指数变化：

$$
\sigma(h) = a \cdot e^{-b\cdot (h - h_0)}
$$

- $a$ = `_FogDensity`（密度基数，默认 0.008）
- $b$ = `_HeightFalloff`（高度衰减率，默认 0.05；$b$ 越大高处清得越快）
- $h_0$ = `_FogHeightStart`（雾基准高度，默认 0）

视线透射率 $T$ = 沿视线 $P_c + t\cdot\hat v$（$t\in[0,D]$，$D$ 为像素距离）的指数消光积分：

$$
T = \exp\!\left(-\int_0^D \sigma(P_c + t\cdot\hat v)\,\mathrm dt\right)
$$

雾量 `fogAmount` = $1 - T$。

#### 3.1.2 闭式积分推导

设相机高度 $h_c = P_{c.y} - h_0$（相对雾基准高度），视线方向 Y 分量 $\hat v_y$。沿视线的消光系数：

$$
\sigma(t) = a\cdot e^{-b\cdot (h_c + t\cdot\hat v_y)} = a\cdot e^{-b h_c}\cdot e^{-b t\cdot\hat v_y}
$$

积分：

$$
\int_0^D \sigma(t)\,\mathrm dt = a\cdot e^{-b h_c}\int_0^D e^{-b t\cdot\hat v_y}\,\mathrm dt
$$

当 $|\hat v_y| > \varepsilon$（视线不平行于地面）：

$$
\int_0^D e^{-b t\cdot\hat v_y}\,\mathrm dt = \frac{1 - e^{-b D\cdot\hat v_y}}{b\cdot\hat v_y}
$$

$$
\mathrm{fogAmount} = 1 - \exp\!\left(-\frac{a}{b}e^{-b h_c}\cdot\frac{1-e^{-b D\cdot\hat v_y}}{\hat v_y}\right)
$$

当 $\hat v_y \approx 0$（视线平行地面，分母趋零→数值不稳定→退化为常数积分）：

$$
\mathrm{fogAmount} = 1 - \exp\!\left(-a\cdot D\cdot e^{-b h_c}\right)
$$

#### 3.1.3 代码实现

```hlsl
float a = _FogDensity;          // 密度基数
float b = _HeightFalloff;       // 高度衰减率
float camHeight = _WorldSpaceCameraPos.y - _FogHeightStart;
float t = b * rayDir.y;         // b * v_y, 用于判断视线是否平行地面

float fogAmount;
if (abs(t) > 0.0001)            // 视线有垂直分量: 闭式解
    fogAmount = (a / b) * exp(-camHeight * b) * (1.0 - exp(-dist * t)) / rayDir.y;
else                            // 视线平行地面: 退化常数积分
    fogAmount = a * dist * exp(-camHeight * b);

fogAmount = 1.0 - exp(-fogAmount);  // 透射率 → 雾量
```

> **数值稳定性**：`abs(t) > 0.0001` 的阈值保证在视线接近水平时不会因 `1/rayDir.y` 产生极大值；退化的常数积分形式 `a*dist*exp(-b*camHeight)` 在该极限下是精确的。

### 3.2 近处淡入 (Proximity Fade)

高度雾的解析积分在距离为 0 时 `fogAmount = 0`，但在相机前方近处（如 10m 处的地面）已经能积累可观的雾量，可能让前景物体被雾"吞没"。添加 `smoothstep` 淡入：

```hlsl
float proximityFade = smoothstep(_FogStartDistance,
                                  _FogStartDistance + _FogStartFadeRange,
                                  dist);
fogAmount *= proximityFade;
```

- `_FogStartDistance = 15`（在此距离之前雾量被 smoothstep 从 0 拉到 1）
- `_FogStartFadeRange = 25`（过渡区间长度）
- 结果：0-15m 雾量为 0，15-40m 线性淡入，40m+ 全量

### 3.3 天空盒消散 (Skybox Zenith Fade)

天空盒像素的 `depth` 为 0（Reversed-Z 下 `depth < 1e-7`），此时强制 `dist = 10000m`。但直接在天空盒上跑高度积分会让整个天空都染上雾色——天顶方向看起来"有雾"是不自然的。在 `rayDir.y > 0`（向上看天空）时用 `1/(1 + rayDir.y * zenithFade)` 压制雾量：

```hlsl
if (isSkybox && rayDir.y > 0.0)
    fogAmount /= (1.0 + rayDir.y * _SkyboxZenithFade);
```

- `rayDir.y ≈ 0`（地平线方向）：雾量除以 1，维持全量（地平线最浓）
- `rayDir.y ≈ 1`（正上方）：雾量除以 `1 + zenithFade`（默认 15），压制到 ~6%
- `_SkyboxZenithFade` 越大天顶越清澈

### 3.4 方向光散射 (Henyey-Greenstein)
#### 效果showcase
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17841677235506.png)

雾粒子对方向光（太阳/主光）的散射不是各向同性的——**逆光方向**（太阳在视线前方）雾更亮，**顺光方向**（太阳在背后）雾偏暗。用 Henyey-Greenstein 相位函数描述散射角分布：

$$
p(\cos\theta,\ g) = \frac{1-g^2}{4\pi(1 + g^2 - 2g\cos\theta)^{3/2}}
$$

- $\cos\theta = \hat v\cdot\hat L$（视线方向 · 主光方向）
- $g\in(-1,1)$：前向散射参数（$g>0$ 前向散射强，雾中 0.3-0.7）
- 本实现取 `_ScatteringG = 0.55`（轻微前向散射）

```hlsl
float HenyeyGreenstein(float cosTheta, float g) {
    float g2 = g * g;
    float denom = 1.0 + g2 - 2.0 * g * cosTheta;
    return (1.0 - g2) / (4.0 * PI * pow(max(denom, 1e-4), 1.5));
}
```

散射对远处更显著（近距离雾本身已够浓），用 `inscatterStartDistance` 做距离延迟：

```hlsl
float scatterDist  = max(dist - _InscatterStartDistance, 0.0);
float scatterAtten = 1.0 - saturate(exp2(-scatterDist * 0.01));
float lightLuma    = dot(mainLight.color, float3(0.299, 0.587, 0.114));
float scatter      = saturate(phase * _SunScatterIntensity * scatterAtten * lightLuma);
```

最终雾色在基础 `_FogColor` 与 `_InscatterColor`（暖黄色调）之间 lerp，散射越强越偏暖：

```hlsl
half3 fogColor = lerp(_FogColor.rgb, _InscatterColor.rgb, scatter);
```
## 4. 执行时机与 URP 管线架构

### 4.1 管线插入点

```
═══════════════════════════════════════════════════════════════
URP 一帧

 (1) Depth PrePass → _CameraDepthTexture

 (2) DrawOpaqueObjects / Deferred Lighting → cameraColorTarget

 (3) DrawTransparents / Skybox → 叠加到 cameraColorTarget

 (4) ★ BeforeRenderingPostProcessing ★                    [Fog Pass]
       │  ┌─ FogRenderPass.Execute ──────────────────────┐
       │  │  OnCameraSetup: source = cameraColorTarget    │
       │  │  Execute:                                      │
       │  │    1. cmd.GetTemporaryRT(_TempHeightFog)       │
       │  │    2. cmd.Blit(source → _TempHeightFog)        │  拷贝场景
       │  │    3. SetGlobalTexture(_MainTex, _TempHeightFog)│
       │  │    4. cmd.DrawProcedural(3 verts)              │  全屏三角
       │  │       → Frag 读 _MainTex + 深度 + 主光         │
       │  │       → 解析积分 → lerp(fogColor, scene)       │
       │  │    5. 写回 source (cameraColorTarget)           │
       │  └────────────────────────────────────────────────┘
       │
 (5) Post-Processing (Bloom, Tonemapping 等) → Present
═══════════════════════════════════════════════════════════════
```

> **为什么是 BeforeRenderingPostProcessing**：雾必须在 Post-Processing（Bloom、Tonemapping）之前完成，否则 Bloom 会提取雾的边缘、Tonemapping 会把雾色映射到 HDR 色域之外。雾作为"大气效果"应该位于照亮场景与后期特效之间。

### 4.2 与 AO的执行先后关系

本项目中高度雾和 GTAO 同时存在时，URP 帧内的执行顺序为：

```
Depth PrePass → GBuffer/Forward Opaque
  → GTAORenderPass @ AfterRenderingGbuffer  (GTAO 计算, 设置 _SCREEN_SPACE_OCCLUSION)
  → Deferred Lighting / Transparents         (AO 被光照消费)
  → FogRenderPass @ BeforeRenderingPostProcessing  (高度雾合成到已照亮+已AO的场景)
  → Post-Processing → Present
```

雾合成在光照+AO **之后**，因此雾色叠加不受 AO 遮蔽影响——远处被遮蔽的物体同样会被雾覆盖，这在物理上是正确的（雾是相机与物体之间的介质，不取决于物体表面是否被遮挡）。

### 4.3 RT 与内存

| RT | 分辨率 | 格式 | 用途 | 生命周期 |
| :--- | :--- | :--- | :--- | :--- |
| `_TempHeightFog` | 全分辨率 | `cameraTargetDescriptor`（无深度） | 场景颜色拷贝 | `GetTemporaryRT` 在 Execute 中分配，`FrameCleanup` 中释放 |

零 Compute Shader、零额外 RT 持久分配——唯一的开销是 1 张全分辨率场景拷贝（1920×1080 约 8MB），以及 `DrawProcedural` 的一次全屏 frag 执行（约 2ms / 1080p）。
## 5. 实现细节与关键代码

### 5.1 FogFeature：ScriptableRendererFeature 注册

```csharp
public class FogFeature : ScriptableRendererFeature
{
    public FogSettings settings;   // 所有参数直接序列化在 Feature 上, 不依赖 Volume

    public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
    {
        if (renderingData.cameraData.cameraType != CameraType.Game) return;     // 仅 Game 相机
        if (renderingData.cameraData.renderType != CameraRenderType.Base) return;

        m_Pass.renderPassEvent = settings.renderPassEvent;                      // BeforeRenderingPostProcessing
        m_Pass.Setup(m_Material, settings);
        m_Pass.ConfigureInput(ScriptableRenderPassInput.Depth);                 // 请求深度纹理
        renderer.EnqueuePass(m_Pass);
    }
}
```

**关键设计决策**：
- **参数在 Feature 上而非 Volume**：高度雾是场景全局效果，不像 AO 需要根据后处理 Volume 做动态切换。直接序列化在 Feature 上更简单，Inspector 里调参数即可实时预览；
- **仅 Game 相机**：Scene View 的深度附件在编辑器重绘时不稳定，雾的调试比实用价值大，因此限定 Game 相机；
- **`ConfigureInput(Depth)`**：确保 URP 在雾 Pass 之前生成 `_CameraDepthTexture`。

### 5.2 FogRenderPass：全屏后处理流程

```csharp
public override void Execute(ScriptableRenderContext context, ref RenderingData renderingData)
{
    // 1) 写入所有材质参数 (11个 float/half4)
    material.SetColor(s_FogColor, settings.fogColor);
    material.SetFloat(s_FogDensity, settings.fogDensity);
    // ... 省略其余 9 个参数 ...

    CommandBuffer cmd = CommandBufferPool.Get("Post Height Fog");

    // 2) Blit 拷贝场景 → 临时 RT
    cmd.GetTemporaryRT(s_TempID, desc, FilterMode.Bilinear);
    cmd.Blit(source, s_TempID);
    cmd.SetGlobalTexture(s_MainTex, s_TempID);       // _MainTex = 场景颜色

    // 3) 全屏 DrawProcedural → frag 读 _MainTex + 深度 + 主光 → 合成雾 → 写回 source
    cmd.SetRenderTarget(source, DontCare, Store);
    cmd.DrawProcedural(Matrix4x4.identity, material, 0, Triangles, 3, 1);
}
```

**为什么用 `DrawProcedural` 而非 `cmd.Blit`**：`cmd.Blit` 在 URP 某些版本下顶点变换与 `GetFullScreenTriangleVertexPosition` 不一致，可能导致黑屏。`DrawProcedural` + 内置全屏三角生成函数是最稳定的全屏后处理方式。

### 5.3 HeightFog.shader：Frag 完整流程

```hlsl
half4 Frag(Varyings input) : SV_Target
{
    half4 color = SAMPLE_TEXTURE2D_X(_MainTex, sampler_MainTex, input.uv);
    float depth = SampleSceneDepth(input.uv);

    // === 1) 天空盒检测 ===
    bool isSkybox = false;
    #if UNITY_REVERSED_Z
        if (depth < 1e-7) isSkybox = true;
    #else
        if (depth > 0.9999999) isSkybox = true;
    #endif

    // === 2) 深度 → 世界空间 + 视线方向/距离 ===
    float3 worldPos = ComputeWorldSpacePosition(input.uv, depth, UNITY_MATRIX_I_VP);
    float3 rayVec   = worldPos - _WorldSpaceCameraPos.xyz;
    float  dist     = length(rayVec);
    float3 rayDir   = rayVec / max(dist, 1e-4);
    if (isSkybox) dist = 10000.0;     // 天空盒: 固定 10km 视距

    // === 3) 解析高度积分 (见 §3.1) ===
    float a = _FogDensity;
    float b = _HeightFalloff;
    float camHeight = _WorldSpaceCameraPos.y - _FogHeightStart;
    float t = b * rayDir.y;
    float fogAmount;
    if (abs(t) > 0.0001)
        fogAmount = (a/b) * exp(-camHeight*b) * (1.0-exp(-dist*t)) / rayDir.y;
    else
        fogAmount = a * dist * exp(-camHeight*b);
    fogAmount = 1.0 - exp(-fogAmount);

    // === 4) 近处淡入 + 天空盒消散 ===
    fogAmount *= smoothstep(_FogStartDistance, _FogStartDistance + _FogStartFadeRange, dist);
    if (isSkybox && rayDir.y > 0.0)
        fogAmount /= (1.0 + rayDir.y * _SkyboxZenithFade);

    fogAmount = min(saturate(fogAmount), _MaxFogOpacity);

    // === 5) 方向光散射 ===
    Light mainLight = GetMainLight();
    float cosTheta = dot(rayDir, normalize(mainLight.direction));
    float phase = HenyeyGreenstein(cosTheta, _ScatteringG);
    float scatterDist  = max(dist - _InscatterStartDistance, 0.0);
    float scatterAtten = 1.0 - saturate(exp2(-scatterDist * 0.01));
    float lightLuma = dot(mainLight.color, half3(0.299, 0.587, 0.114));
    float scatter   = saturate(phase * _SunScatterIntensity * scatterAtten * lightLuma);
    half3 fogColor  = lerp(_FogColor.rgb, _InscatterColor.rgb, scatter);

    // === 6) 合成 ===
    color.rgb = lerp(color.rgb, fogColor, fogAmount);
    return color;
}
```

### 5.4 参数一览与项目中使用值

| 参数 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `_FogColor` | `(0.55, 0.68, 0.85)` 浅蓝灰 | 基础雾色，低处/远处的主色调 |
| `_FogDensity` | 0.008 | 密度基数，越高雾越浓（与 `_HeightFalloff` 协同作用） |
| `_MaxFogOpacity` | 0.35 | 雾量上限 clamp，防止完全遮蔽远处 |
| `_FogHeightStart` | 0 | 雾基准高度（世界 Y），低于此高度雾量最大 |
| `_HeightFalloff` | 0.05 | 高度衰减率，越大高处清得越快（0.02=平缓，0.1=锐利） |
| `_FogStartDistance` | 15 | 近处雾淡入起点（米） |
| `_FogStartFadeRange` | 25 | 淡入过渡距离（米） |
| `_SkyboxZenithFade` | 15 | 天空盒天顶消散强度，越大天顶越清澈 |
| `_InscatterColor` | `(1.0, 0.95, 0.8)` 暖黄 | 逆光方向雾的暖色散射色调 |
| `_ScatteringG` | 0.55 | HG 相位前向散射参数（>0 前向，<0 后向） |
| `_SunScatterIntensity` | 0.45 | 散射强度 |
| `_InscatterStartDistance` | 50 | 散射生效起始距离（米），近处散射不明显 |

## 6. References

1. **E. J. McCartney.** "Optics of the Atmosphere: Scattering by Molecules and Particles." *John Wiley & Sons, 1976*. — 大气光学基础，消光系数与指数高度衰减模型来源。
2. **L. G. Henyey, J. L. Greenstein.** "Diffuse Radiation in the Galaxy." *Astrophysical Journal, 1941*. — Henyey-Greenstein 相位函数原始论文。
3. **Matt Pharr, Wenzel Jakob, Greg Humphreys.** "Physically Based Rendering: From Theory to Implementation." *Chapter 11: Volume Scattering*. — 参与介质透射率积分与解析 Raymarching 的理论基础。
4. **Unity Technologies.** "URP Scriptable Renderer Features." *Unity Manual*. — `DrawProcedural` + `ScriptableRenderPassInput.Depth` 集成方式。
