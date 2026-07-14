---
title: "Unity URP：SSR 实现"
course: "Classic Sponza Showcase"
source: "Assets/OurFunction/SSR/"
order: 25
---

# Unity URP：SSR 实现

> 基于 URP ScriptableRendererFeature 的屏幕空间反射（Screen Space Reflection）记录采用视空间 Ray Marching + 二分求精 + 时域抖动，在 `BeforeRenderingTransparents` 阶段计算反射后叠加到场景，支持 roughness 自适应 Mip blur、fresnel 衰减、dither 去带、Debug 视图。
>
> 代码位于项目 `Assets/OurFunction/SSR/`，包含：`SSRRenderFeature.cs`、`SSR.shader`。

## 1. Introduction
### Pre：ShowCase
#### SSR on
1. full showreel
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17839968894231.png)

2. Hit Mask
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_178399697240.png)
3. Reflective color
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17839970203275.png)
#### SSR off
![](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/%E4%BC%81%E4%B8%9A%E5%BE%AE%E4%BF%A1%E6%88%AA%E5%9B%BE_17839968062211.png)
### 1.1 Why SSR？
- 第一，**Reflection Probe 静态、无屏幕空间精度**——probe 在预烘焙位置采样 cubemap，无法反映动态物体和近距离精确反射；
- 第二，**无 SSR 则完全缺失镜面反射**——光滑材质（金属、水面、玻璃）在 URP 默认管线中完全依赖 Skybox 或 probe，缺乏真实的环境反射；
- 第三，**Ray Marching 的 artifact 问题**——简单的前向步进容易漏过薄几何、屏幕边缘反射截断生硬、低 roughness 材质产生锯齿。
### 1.2 实现思路
- **核心机制**：在视空间做 **Ray Marching + 二分求精（Binary Refinement）**——从 GBuffer 读取法线 + smoothness，计算反射方向，沿视线方向以自适应步长（`stride / sin(θ)` 补偿斜向步进）前向 Marching，hit 后二分 16 步精确定位交点。Composite Pass 中用 roughness 自适应 Mip level 采样反射颜色，fresnel + smoothness + ao 加权混合。
- **Dither 去带**：8×8 Bayer 或 Interleaved Gradient Noise（IGN）抖动反射 UV，以低步数（默认 96）覆盖连续反射面。
- **架构**：`SSRRenderFeature` 在 `BeforeRenderingTransparents` 注入，强制开启 `DepthTextureMode.Depth | DepthNormals | MotionVectors`。
- 2 个 Pass：
1. Trace（写 `_SSR_ReflectionMap`，含 hit UV + mask）→ 
2. Composite（读 GBuffer 合成反射）。



## 2. KeyWords

| 关键词                         | 简单解释                                       | 具体实现                                               |
| :-------------------------- | :----------------------------------------- | :------------------------------------------------- |
| **View-Space Ray Marching** | 在视空间沿反射方向步进，每步投影到屏幕比较深度                    | `FragTrace` 中 使用给定Steps的 for 循环                    |
| **Binary Refinement**       | hit 后二分 16 步缩小交点误差                         | `BINARY_STEP_COUNT=16` 逐半收缩                        |
| **Adaptive Stride**         | 斜向步长 = `stride / sqrt(1 - viewReflectDot)` | 补偿掠射角步长不足，向给定角度斜向marching补偿                        |
| **Roughness Mip Blur**      | 根据 smoothness 选择 Mip level 采样反射颜色          | `SAMPLE_TEXTURE2D_X_LOD(_MainTex, uv, blurAmount)` |
| **Dither (Bayer8×8 / IGN)** | 时域/空域抖动反射 UV 偏移去带                          | `SSR_Dither8x8` / `SSR_IGN`两种dithering逻辑以加大精度      |
| **Fresnel**                 | 掠射角反射更强，正面反射更弱                             | `fresnel = 1 - dot(viewDir, -normal)` 加权反射         |

## 3. Technical Breakdown

### 3.1 视空间 Ray Marching (Pass 0: Trace)

#### 3.1.1 反射方向计算

从 GBuffer 读取 world-space normal + smoothness，反射视线方向得 world-space 反射向量，再变换到视空间做步进：

```hlsl
float3 viewDir      = normalize(worldPos - _WorldSpaceCameraPos);
float3 reflectionRay = reflect(viewDir, normal);                // world-space
float3 reflectionRayVS = mul(_SSR_ViewMatrix, float4(reflectionRay, 0.0)).xyz;
reflectionRayVS.z *= -1.0;
```

#### 3.1.2 自适应步长

反射方向越接近视线方向（`viewReflectDot` 越大），每步在屏幕空间的投影越小——固定步长会导致近垂直反射面采样不足。用 `1/sqrt(1-dot²)` 补偿：

```hlsl
float viewReflectDot        = saturate(dot(viewDir, reflectionRay));
float oneMinusViewReflectDot = sqrt(max(1.0 - viewReflectDot, 0.001));
float rayStride  = _SSR_Stride / oneMinusViewReflectDot;     // 自适应步长
float thickness  = _SSR_Stride * 2.0 / oneMinusViewReflectDot;
```
![](https://oss.kiiye9697.cn/20260421142817287.webp)
#### 3.1.3 Marching 循环

每步将当前位置投影回屏幕 UV，比较当前视空间深度与采样深度的 `LinearEyeDepth`：

```hlsl
for (int step = 0; step < 256; ++step) {
    if (step >= actualSteps) break;
    currentPosition += ray;                                   // 步进
    float4 uv = mul(ProjectionMatrix, currentPosition);       // 投影
    uv /= uv.w;
    uv.xy = uv.xy * 0.5 + 0.5;                              // NDC→UV
    if (uv.x < 0 || uv.x >= 1 || uv.y < 0 || uv.y >= 1) break; // 出屏

    float sampledDepth = SampleSceneDepth(uv.xy);
    depthDelta = currentPosition.z - LinearEyeDepth(sampledDepth, _ZBufferParams);
    if (depthDelta > 0.0 && depthDelta < rayStride * 2.0) { hit = 1; break; }
}
```

hit 条件：`depthDelta > 0`（反射点在几何后方）且 `depthDelta < rayStride*2`（不是太远，防止误 hit 远处几何）。额外 `depthDelta > thickness` 检查排除过厚的误检。

#### 3.1.4 二分求精

hit 后 16 步二分收敛：

```hlsl
for (int binaryStep = 0; binaryStep < BINARY_STEP_COUNT; ++binaryStep) {
    ray *= 0.5;
    if (depthDelta > 0.0) currentPosition -= ray;     // 前方→后退
    else                  currentPosition += ray;     // 后方→前进

    // 重新投影、比较深度
    // 若 abs(depthDelta) > 1/oneMinusViewReflectDot → 发散, 放弃
}
// 最终 backface 检测: dot(hitNormal, reflectionRay) > 0 → 背面 hit → 丢弃
```

#### 3.1.5 Trace Pass 输出

```hlsl
// R=hitUV.x, G=hitUV.y, B=maskOut*progress, A=1.0
return half4(currentScreenSpacePosition, saturate(maskOut * progress), 1.0);
```

- `maskOut`：屏幕边缘 mask（`SSR_ScreenEdgeMask`），UV 越靠近边缘越衰减
- `progress`：`smoothstep(0, 0.5, 1 - (distTraveled/maxDist)²)`，远处反射衰减

### 3.2 Dither 去带 (Pass 1: Composite)

低步数（96）Marching 在光滑面上产生明显的步进条带。Composite Pass 中对反射 UV 加抖动偏移：

```hlsl
// Bayer 8×8 模式: 确定型空域抖动
float dither = SSR_Dither8x8(uv * renderScale, 0.5);

// IGN 模式: 时域伪随机抖动 (Interleaved Gradient Noise)
float dither = SSR_IGN(pixelX, pixelY, frameIndex);

dither = dither * 2.0 - 1.0;                               // [-1,1]
float2 uvOffset = normalSS.xy * lerp(dither * 0.05, 0.0, stepS²);
```

- 高 smoothness（stepS² ≈ 1）：抖动压制到 0（镜面反射不需抖动，条带不明显）
- 低 smoothness：抖动最大（粗糙面需要更多采样去带）

### 3.3 Composite：反射合成

```hlsl
// 1) 反射颜色采样 (roughness 自适应 Mip blur)
float roughnessBlurAmount = lerp(0.0, 5.0, 1.0 - pow(stepS, 4.0));
float4 reflectedColor = SAMPLE_TEXTURE2D_X_LOD(_MainTex, sampler, reflectedUV, blurAmount);

// 2) 金属/非金属分离
float3 specular = lerp(float3(1,1,1), gb0.rgb, lerp(0.0, 0.6, metallic));
float3 blended  = source * (1-metallic) + reflectedColor * specular * metallic;

// 3) 反射权重 = mask * ao * fresnel * luminMask * intensity
float reflectionWeight = saturate(maskVal * ao * fresnel * luminMask * _SSR_Intensity);
result = lerp(source, blended, reflectionWeight);
```

- `fresnel`：`1 - dot(viewDir, -normal)`，金属 fresnel 受 `gb1.x` 调节
- `luminMask`：`pow(1 - saturate(lum-1), 5)`，极亮像素（光源本体）不反射
- `ao`：从 GBuffer1.y 读取，遮蔽区反射减弱

---

## 4. 执行时机与 URP 管线架构

### 4.1 管线插入点

```
═══════════════════════════════════════════════════════════════
URP 一帧

 (1) Depth PrePass → _CameraDepthTexture + DepthNormals + MotionVectors
 (2) DrawOpaqueObjects (Forward/Deferred) → cameraColorTarget
       └─ GBuffer: _GBuffer0(albedo), _GBuffer1(specular+ao), _GBuffer2(normal+smoothness)

 (3) ★ BeforeRenderingTransparents ★                       [SSR Pass]
       │  ┌─ SSRPass.Execute ─────────────────────────────┐
       │  │  1. Blit(source → TempSource)  (mipCount=8)    │  拷贝场景 (含 mip chain)
       │  │  2. Pass0 Trace:                               │
       │  │       Blit(null → _SSR_ReflectionMap)           │  低分辨率 (downsample+1)
       │  │       FragTrace 读 GBuffer2(法线+smoothness)    │
       │  │       → 视空间 Ray Marching + 二分 → hitUV+mask │
       │  │  3. Pass1 Composite:                           │
       │  │       Blit(TempSource → cameraColorTarget)      │  写回场景
       │  │       FragComposite 读 GBuffer0/1/2 +          │
       │  │       _SSR_ReflectionMap + _MainTex mip chain   │
       │  │       → roughness blur + fresnel + 混合         │
       │  │  4. 释放 ReflectionMap + TempSource             │
       │  └────────────────────────────────────────────────┘

 (4) DrawTransparents / Skybox
 (5) Post-Processing → Present
═══════════════════════════════════════════════════════════════
```

> **为什么是 BeforeRenderingTransparents**：
> SSR 必须在 Transparents 之前完成——透明物体需要反射不透明场景的结果，同时自己不被反射（简化处理）。SSR 仅反射 Opaque 已渲染的像素。

### 4.2 RT 与内存

| RT | 分辨率 | 格式 | 用途 |
| :--- | :--- | :--- | :--- |
| `_SSR_TempSource` | full², mipCount=8 | `cameraTargetDescriptor` | 场景拷贝 (含 mip chain 供 roughness blur) |
| `_SSR_ReflectionMap` | full/(downsample+1) | ARGBHalf | Ray Marching 结果 (hitUV + mask) |

峰值约 2 张全分辨率 RT (~33MB 1080p)。

### 4.3 特殊依赖

```csharp
camera.depthTextureMode |= DepthTextureMode.Depth
                         | DepthTextureMode.DepthNormals
                         | DepthTextureMode.MotionVectors;
```

强制开启深度+法线+运动矢量纹理，URP 在 Depth PrePass 中生成 `_CameraDepthNormalsTexture`（供 SSR 的屏幕空间坐标重建和 GBuffer 法线采样）。

---

## 5. 实现细节与关键代码

### 5.1 参数一览

| 参数 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `stepStrideLength` | 0.03 | 基础步长（视空间单位），越小越精确但需更多步数 |
| `maxSteps` | 96 | 最大步数 (8-256) |
| `minSmoothness` | 0.55 | 最小 smoothness 阈值，低于此值不计算 SSR |
| `intensity` | 0.75 | 反射强度 |
| `reflectSky` | false | 是否反射天空盒 |
| `downsample` | 0 | 反射图降采样 (0=全分辨率, 1=半分辨率) |
| `ditherMode` | InterleavedGradient | 抖动模式 (Bayer8×8 / IGN) |

## 6. References

1. **Morgan McGuire, Mike Mara.** "Efficient GPU Screen-Space Ray Tracing." *Journal of Computer Graphics Techniques, 2014*. — 视空间 Ray Marching + 二分求精范式。
2. **Chris Wyman.** "An Improved Screen-Space Ray Marching Algorithm." *HPG 2016*. — 自适应步长与 depth thickness 策略。
3. **Unity Technologies.** "URP Scriptable Renderer Features / DepthTextureMode." *Unity Manual*.
