---
title: "GAMES202 Notes（7）-Lecture14 A Glimpse of Industrial Solution"
course: "GAMES202 高质量实时渲染"
source: "C:\\Users\\kiiye\\Desktop\\Git\\Notes_For_md\\TA课程\\GAME202高质量实时渲染\\GAMES202 Notes（7）-Lecture14 A Glimpse of Industrial Solution.md"
order: 7
---

>由于课程发布于2021年，所以大部分的解决方案可能随着行业发展成为经典而非一线的直接算法，特此注意。
# Temporal Anti-Aliasing(TAA)
出现走样原因:在光栅化的过程中没有足够多的采样量导致的，终极的处理方法是使用更多的采样补全信息。对于TAA里说，我们跨帧来使用更多的信息来优化锯齿；通过跨帧统筹来优化可使用的帧数目来提升采样量以提升效果。
![](https://oss.kiiye9697.cn/20260429141749409.webp)
	如果我们随机进行temporal采样，那么效果其实容易出现不均匀分布，如果场景产生运动，我们应该考虑利用几何移动向量，匹配对应的运动Sample利用MotionVector来进行优化Temporal信息。
## Glimpse of DLSS
>里面相对来说DLSS：如果出现temporal failure，那么clamping的效果越来越差，把上一帧的像素值先在这一帧的像素值的范围内clamp再使用时会出现严重的伪影效果。
>因此，我们需要有合理的信号处理方式：并利用DLSS学习优化Temporal来优化渲染效果。
>在训练网络的时候我们需要有网络的优化表现，将30ms的适配进行进一步的优化
- 其实是存在竞品的，就是AMD生态的fsr。
![](https://oss.kiiye9697.cn/20260429205903567.webp)
# Additional Note：SSAA+MSAA
- ssaa就是显著的渲染原来分辨率四倍的效果再将其降低采样减少，会严格造成相应的四倍计算开销的代价。
- MSAA做了一个相应的近似：
1. 我们假设同一个简单集合体，所有的样本做同一次shading；我们维护一个表保证对应的效果和对应的颜色+深度
2. 我们采用比较聪明的着色方法，允许部分采样的复用，允许sample的重复考虑，尽量复用跨像素的部分。
![](https://oss.kiiye9697.cn/20260429201358757.webp)
# Additional Note（Image Base AA）：SMAA
（Enhanced subpixel morphological aa）：FXAA->MLAA->SMAA;这是一套图像中的抗锯齿办法。
>G-Buffer不应该进行反走样，法线也是，这一部分进行模糊后其数据就失去了其应有的意义了。

#  Deferred Shading（八股必吃榜）
## Why Deferred？
- 一种令shading更高效、更快的办法：
对于传统的流程：
- Triangles-> fragments->depth ->shading->pixel
只有所有的片元都需要被渲染的情况下，这种逻辑的渲染才不会有性能损耗。（这种情况要求全部管线都会通过深度测试）
在这种情况下，我们的管线复杂度是：Complexity=O（#Fragment * # light）。
 因此，这种情况下，我们能否只shading能被渲染的部分以优化这部分逻辑呢？
 
## Modifying the rasterzation process
- Pass1：进行Depth Prepass：这次渲染我们的核心目标的更新深度缓存，保证我们渲染层只保留需要呗渲染的部分
- Pass2：我们已经知道了最浅的深度，因此只有我们深度小于等于给定深度值的部分会进入渲染流程
这种情况下，我们能极大的支持多光源的算法：将复杂度优化到O（#fragment * # light）->O(# fragment+#light)，由于依赖于深度图AA，因此不适用于AA技术。
- 在这流程中不支持**AA**技术，不过可以通过**TAA**技术进行优化。
## Further：Tiled Shading
- 我们把屏幕空间也进行分块，并将每个分块也单独做Shading；通过这种方式我们可以减少单独的每个方块的Shading数量。是一种多光源体积做法。显然的，光线不会对所有分块产生贡献。
- 我们在光照计算的时候有一个按照距离平方的衰减，因此各种各样的光源的覆盖面是很有限的。所以每个光源辐射的贡献距离我们可以大致划定其球形状的一个覆盖范围，因此不是所有的光源我们都会影响到。
通过这种方法，我们可以将对应的光照变成视觉片元和平均shading效果。
![](https://oss.kiiye9697.cn/20260429225403443.webp)
## Further：ClusterShading
TiledShading的基础上，我们在原来的屏幕空间的层级分化优化到将其划分为视锥体形状的分化进行实现；我们基于深度图进行进一步的分化，这样来说我们进一步更细节的部分的受光程度就更加减少了每一个Cluster里面记录的光源的数量.
对于视锥体的划分，我们未必远处无法被渲染，值得关注。
![](https://oss.kiiye9697.cn/20260429231157819.webp)
#  Level of Detail Solution
常见的工作类似于：
- texture MipMap——找到正确层级来节省效果
- 运用LOD的方法一般成为级联：cascaded
常见function：
1. 级联阴影：我们在设计的时候会生成变分辨率的ShadowMap；在近处设计覆盖范围近的ShadowMap而在更远处一般选取更为稀疏精度的粗糙度ShadowMap。我们的阴影范围之间会存在部分重叠，以防止在层级过渡的时候，有计划的进行部分重叠，在重叠区域进行插值Blend来优化对应的处理方式。
2. cascade LPV：利用cascaded进行体素化Gi的优化
## Challenge
常见的困难点在于过渡区的问题，我们的在不同层级的过渡比较困难。一般而言我们考虑使用Overlap（重叠）+混合权重的方式对这一部分处理进行优化。
## Others：Geometric LoD
我们用不同顶点数的模型，或者物体的某部分利用高模和低模型进行混合，来选择合适的部分进行优化处理，综合的处理以获取合理的结果，只要保证每次三角形和像素的**比例、覆盖范围**是固定的，这样就能保证无论距离会有相同效果。如果存在Artifacts的渐变问题，我们使用TAA进行混合过度即可。——Further Nanite：GPU Driven+LOD。 
### Some Possible Problem
1. 不同层级的遮挡关系是否导致裂缝、漏光问题？
2. 不同层级的heavy程度迥乎不同，如何动态切换好其在GPU中的动态加载？（类似虚拟纹理，如何进行拟合和加载？）
3. Cliping/Culling Method？
4. 如何表示几何和三角面？（如几何纹理方式表达面 ）
>大部分的问题都在于高效的加速和工业实践效果。

# Global Illumination Solution
>一些GI的未来提升：GI近似+SSR估计，在使用一些混合的RTRT来混合优化，得到一个综合上最好的效果——综合算法解决使用一个hybrid Solution
## Software Ray-Tracing
利用高质量的SDF贴图物将靠近部分的物体进行处理光追的marching，远处使用更低质量的贴图进行Tracing。
对于非常强的方向光源和点光源（部分集中）——这部分使用Shadow Map
>未涉及的部分，我们使用分区的irridance在3D grid进行分区使用，使用Dymanic Diffuse GI/DDGI，利用Probe插值进行相应的光线混合逻辑。

## Hardware Ray-Tracing
- RTXGI Probe的部分
- 不用全部使用原始的集合体，使用low poly的模型进行大部分的混合逻辑。
>完结撒花！路上得来终觉浅，绝知此事要躬行。
                                                               2026.4.29
