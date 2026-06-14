---
title: "GAMES104 Advanced Topic（1）：Dynamic Global Illumination and Lumen"
course: "GAMES104 现代游戏引擎"
source: "C:\\Users\\kiiye\\Desktop\\Git\\Notes_For_md\\TA课程\\GAMES104-现代游戏引擎\\GAMES104 Advanced Topic（1）：Dynamic Global Illumination and Lumen.md"
order: 17
---

>里面包含了大量的GI算法，和Games202中提到了部分技术，有很多的部分进行对应的匹配，保证整体的逻辑完备。
# GI基础
>这里讲得相对Games202简陋许多，可以考虑阅读games202相关的笔记材料。

![](https://oss.kiiye9697.cn/20260501004550412.webp)
针对GI，我们将环境中的所有光照利用渲染方程，采样四面八方的光线进行对应的关系概念并在实时级别渲染。在这种情况下，我们的light source是无限多的，而我们的次级光源会视为二级光源进行第二次的光线贡献，这是增加光线表现最重要的部分之一。
## Monte Carlo Ray Tracing
采样的复杂度高，在Nvidia的性能优化级别下，实时成本只能接近1spp
![](https://oss.kiiye9697.cn/20260501144428083.webp)
Sampling的重要性采样是关键，用于优化noise的平均情况。
![](https://oss.kiiye9697.cn/20260501145512370.webp)
重要性采样可以极大优化低成本下的优化相应效果。由PDF到有选择性的采样会优化的表面模型。
![](https://oss.kiiye9697.cn/20260501145852413.webp)

## Reflective Shadow Map（RSM）
光子映射注入场景的一种方法；我们将直接光照的部分记录下来作为次级光源的map，将Xp出的出射逻辑，散射系数，在Xp处再进行一次Shading进行GI光照处理。
（注意，分子的四次方中有两个平方的部分是用于归一化处理的公式，负责对应的方向向量的拉伸）
![](https://oss.kiiye9697.cn/20260501150408654.webp)
- 这种方法在ScreenSpace逐像素的照明次级光源的时候，随着分辨率其复杂度是有显著的复杂度提升的，因此我们需要在次级光源的采样分布里面进行进一步的优化和mipmap多层级进行追踪；如果我们使用低分辨率的sum，我们可以发现大量的光照贡献是可以**复用**的。如果我们的采样点空间位置很稀疏，那么我们**不需要**有效的插值，由于这种高频的部分略少，我们就可以选择性的对这一部分单独插值处理。
### Pros And Cons
![](https://oss.kiiye9697.cn/20260501151110623.webp)
## Light Propagation Volume（LPV）
>*From CryEngine3-SIGGRAPH 2009*.

我们利用体积划分的逻辑，根据六面体传输irridance每一帧进行更新，直到所有的irridance平均好后将对应的光线贡献相叠加。在进行表达的时候，我们将体素中radiance插值成SH，对场景中的物体进行Shading。这种六面体的分布成为Propagation。
![](https://oss.kiiye9697.cn/20260501153657731.webp)
## Sparse Voxel Octree for Real-Time Global Illumination（SVOGI）
我们的LPV时设定的整个体积进行划分和迭代，而如果我们想用传统的光栅化管线做这一部分处理的话，可以考虑的一种方式就是Surface Rendering，也就是将物体表面做一个相应的划分，我们利用OctTree对整个光线场景划分以及对应层级的插值逻辑来进行平均算法。
>八叉树的体素化阴影，空间中的场景由于分布不均匀所以使用系数八叉树进行空间的表达是一种比较优秀的表现方法，不过这个数据结构相当复杂，为了优化适应稀疏场景的要求。
  如果我们进行多层的分化，也是一种好的溯源流程进行cones的pbr光照。
![](https://oss.kiiye9697.cn/20260501154959153.webp)
## VXGI（Voxelization Based Global Illumination）
我们利用**CILPMAP**来存储体素的信息，我们采用不同精度的LOD Map设计不同分辨率的体素网格，这样我们就不必构建high cost的稀疏八叉树结构。这种高度并行的方式对于CUDA运算是更加高效、直观的可以进行处理的一种方式。
### Updating
通过这种数据逻辑，我们的世界位置更新，我们不需要中间步骤，我们只需要更新对于网格体的变化的相邻网格信息就可以优秀的网格体划分了；我们将其投影到x、y平面分别做相应的体素划分逻辑，就可以优秀的完成这一划分步骤了。
![](https://oss.kiiye9697.cn/20260501160200979.webp)
在这种情况下的体积划分，我们的网格粗细在ScreenSpace上映射的像素大小大致一致，这是通过体积倍率和距离倍率近似一致而获得的一种等距离效果。
### Opacity
并非所有的面都可以进行直接透光，我们需要沿着不同的面分别计算出不一样的透明度，这样我们在Build的时候需要对不同方向计算一次透光率存储进入.
### Light Injection
我们利用RSM注入直接光照，利用Cone Tracing对应diffuse的表现对于Specular相关的多个方向。
由于diffuse材质的分散特性，我们也可以根据opacity将其扩大对应的面积，取不同层级的cilpmap逐渐降低光线的贡献，最终达到收敛。
![](https://oss.kiiye9697.cn/20260501160712298.webp)
是一种实际部署中有一定 成功贡献的方法
### Cons
有一些透明度的表现在Alpha Blending‘时候容易产生漏光效果+部分存在不正确的透明度遮挡。
![](https://oss.kiiye9697.cn/20260501161043746.webp)
## Screen Space Global Illumination（SSGI）
>上述的记录都是基于RSM的光子注射逻辑搭配hierarchy逻辑，进行层次划分以获得smooth的outcome，而这种逻辑是Screen Space方向进行处理的一种技术。
### General Idea
我们将直接屏幕中渲染的效果，在图像域直接进行间接光照的计算。
由于我们在屏幕空间能够获取到对应的光照的次级光照部分，还有对应屏幕空间的反射部分以及法线部分有不同的寻找对应的光照点+反射点来根据Depth Buffer来寻找对应的光照点进行综合，实现间接光照的rid贡献计算叠加回屏幕空间。
![](https://oss.kiiye9697.cn/20260501161647214.webp)
在进行rayCustering时，我们常见的方式就是LinerRaymaring，利用Depth Test来找到对应的反射点，进行对应的间距处理。
![](https://oss.kiiye9697.cn/20260501162219528.webp)
由于这种Steps迭代时的步数过多，我们需要存储不同层级的buffer，并每一层记录Hi-Z（不记录平均，记录最大保证碰撞的可能性情况）来保证对应的Bouding部分来优化对应的迭代。
>这个复杂度时Log2的。这种HierachicalMarching会有未相交变快，相交减Steps逼近，会大大提升相应效率。
### Ray Reuse
如果不考虑光线的遮挡关系，我们对相同的采样点，我们如果存储了对应的光线点的贡献的时候，我们的输入部分的Sampling Point可以完全Reuse的部分。 
![](https://oss.kiiye9697.cn/20260501162552662.webp)
### Summary： Pros And Cons
Pros：
- 我们可以优秀的处理细腻的接触阴影
- 精确的光线命中点
- 与屏幕空间的复杂度不直接相关（层次加速优化）
- 可以每一帧更新以处理动态物体
Cons：
1. 我们无法了解屏幕空间外的部分。
![](https://oss.kiiye9697.cn/20260501162837954.webp)
# Lumen系统：基于SDF的光线追踪
## Why Not Ray Trace
- 在实时级别的需求来说，只能使用1/2 ray per pixel。但是高质量的GI需要上百条ray进行拟合补充。
- 采样的问题很大，低质量、不均匀的噪点很明显，也会有很多漏光、光线更新过慢的问题 光线的更新也很慢。
- 噪声是不连续的。
>因此我们的逻辑idea就是在屏幕空间放若干个探针采样来获取真实物体的表面获取光照，来获取优秀的逼真效果。
>也就是说，我们不逐像素做间接光采样，使用紧贴表面的稀疏探针做采样，然后插值获得像素的间接光照
## Phase1：Fast Ray Trace in Any Hardware
>这一部分算法用于解决在任何硬件上快速的处理硬件算法的相交。
### SDF（Signed Distance Field）
我们计算mesh表面最近的距离。内外符号不一致，计算绝对距离；mesh上为0.
这种效果在数学上和距离是等价的，且这种表示形式是空间上的连续场，是一个可微的信息。
#### Per-Mesh SDF
由于存储SDF过于昂贵，对空间进行一次逐个表示是一个很费的过程，因此我们考虑对逐个Mesh进行SDF的设计以及存储，之后在场景中进行线性变换后，由局部空间转换到世界空间就可以完整的整合。
>对于不等比例的放缩需要一些trick修正SDF的表现。
![](https://oss.kiiye9697.cn/20260501172636330.webp)

SDF对于细面难以表达，我们会对整体进行一个近似的扩大，来保证其不会影响吧对应的遮挡关系。
#### RayTracing with SDF
这是一种经典算法.由SDF的情况下，利用球距离进行迭代既可以实现RayMarching方法.
#### ConeTracing with SDF
对于面积光源，我们可以根据对应的SDF，可以找到一个切线的张角，可以近似来估计合理光线可以的照射角度，类似soft Shadow。
![](https://oss.kiiye9697.cn/20260501173100998.webp)
#### Sparse Mesh SDF
我们利用稀疏矩阵存储，可以利用压缩算法来优化对应的体素阈值后的部分来压缩SDF的存储。（不过阈值过大的情况会显著影响sdf的步进效率）
![](https://oss.kiiye9697.cn/20260501173721662.webp)
#### Mesh SDF LOD
有趣的一点是，我们根据这个距离的插值求梯度可以根据SDF获取mesh的法线分布。通过对梯度的不同层级细分我们可以获得不同精细程度的LOD，
![](https://oss.kiiye9697.cn/20260501173247553.webp)
通过不同层级的SDF LOD也可以合理的优化对应层级，不仅可以优化存储，也可以提高表现效果。
![](https://oss.kiiye9697.cn/20260501173854078.webp)
### Global SDF
对于不同的场景中，我们需要同时使用Mesh SDF以及Global SDF来保证对应的tracing cost被压低在可以允许的范围内。这样我们在做任何方式的raytraicng的时候，都优于硬件光追和光线的BVH相交逻辑。
我们在SDF这种形式进行表示的时候，我们的SDF相交就可以优秀的进行处理，来保证不同距离的时候进行不同的SDF层级划分，优化平衡对应的性能和光照表现。
![](https://oss.kiiye9697.cn/20260501174255263.webp)
## Phase2：Radiance Injection and Caching

### Mesh Card
在进行GI的时候，实际上无论是否在屏幕空间被绘制，都应该接收应有的光照，因此我们在考虑全局光照的时候，我们从六个面分别拍摄来记录basecolor情况，创建AABB BOX进行缓存处理。
![](https://oss.kiiye9697.cn/20260501180711043.webp)

### Generate Surface Cache
![](https://oss.kiiye9697.cn/20260501180828254.webp)
首先，我们根据Card去获取对应不同精度的Card并评估需求以不同精度格式存储对应的信息
在Pass2，我们把每一帧记录在可见范围的Card部分记录快照读入一个4096 * 4096的缓存，我们以**Instance**作为最小操作单位记录其缓存并将其根据Screen Space的远近记录进入不同的缓存当中。
在每一帧，我们都会进行对应的更新，重新记录对应的Card返回缓存。
![](https://oss.kiiye9697.cn/20260501181238232.webp)
对于不同的Cache情况，我们都在硬件层进行压缩进行不同层的存储。
### Compute Light
- 我们并不关心光线**直接**照亮了哪些表面，我们真的做全局光照的时候，我们想要知道的就是我们能否在Surface Cache获取当前帧的radiance来得知其光照情况，得到这个世界的相应的缓存光照信息。
>从这个逻辑上我们可以把这个Cache理解为对当前帧irridance情况的一个**快照**，即通过这个缓存我们能通过查询的方式得知对应点到底有多亮。
- 详细的流程如下，这是lumen工作的一个完整逻辑：
1. 直接通过这一帧的Surface Cache完成相应的光照处理采样成对应Space的Voxel Light。
2. **上一帧**的世界光的体素表达被多根光线的表达被返回给这一帧的Cache用于预测这一阵的间接光照。这种逻辑为类似Temporal的一种上一帧预先查找逻辑
3. 综合计算直接+间接光照来生成最后的光线接收效果。

![](https://oss.kiiye9697.cn/20260501181958863.webp)

