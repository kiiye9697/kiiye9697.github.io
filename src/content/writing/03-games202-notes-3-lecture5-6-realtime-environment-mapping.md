---
title: "GAMES202 Notes(3)-Lecture5、6-RealTime Environment Mapping"
course: "GAMES202 高质量实时渲染"
source: "C:\\Users\\kiiye\\Desktop\\Git\\Notes_For_md\\TA课程\\GAME202高质量实时渲染\\GAMES202 Notes(3)-Lecture5、6-RealTime Environment Mapping.md"
order: 3
---

>直播课设计原因 部分内容存在于lecture7，在此处做记录。
# Distance Field Soft Shadows
## Distance Functions
定义空间中任意一个点到物体表面的最小距离-一个距离场，正负表示在物体的内外，简单记为SDF(Signed Distance Field)，是一种可以通过预计算混合来表示距离的预处理而不用考虑几何上的复杂关系：
![利用SDF的Blending](https://oss.kiiye9697.cn/20260411214544642.webp)
>和最优传输理论有关的一种技术，感兴趣可以了解
## 常见应用
### RayMarching（常见体积云/雾渲染）：
通过距离场进行sphere tracing的算法：
在任意一点，我们都能知道这一点距离场景其他物体的最小距离，也就是说在这最小距离之内，无论如何寻找都不可能与物体相交。（类似一个安全距离的逻辑）->那么每次marching的步长都会是最小距离画的半径，这样我们必然不能相交，这样我们每一步迭代都可以保证我们光线没有穿过物体表面。（那么我们的截止条件也就是1-迭代足够多的step，2-击中某个物体表面）；
对于光线和场景的求交，如果我们需要计算多物体的场景，我们只需要知道这些物体sdf中最小值代表的部分就可以进行RayMarching。
![SDF的原理showcase](https://oss.kiiye9697.cn/20260411215716593.webp)
#### Weeknes
- 做三维的体积雾效果时，他的存储需要vector3是很复杂的
- 运动的物体是可以应用原有sdf，但是存在**几何变形**的物体，会需要动态计算新的ao，cost很大。
### 基于SDF的软阴影
利用sdf和视口的射线投射，将射出的光线和object的sdf相交，试探角度直到SDF=0，即可获得未被遮挡的光线角度
![在Marching途中取切线以获取安全角度](https://oss.kiiye9697.cn/20260413144920527.webp)
朴素的算法中Marching方向+Marching点->通过arcsin取切线；不过在计算中我们一般不考虑使用反正弦这种复杂的计算逻辑，因此我们更考虑使用拟合函数处理近似模拟这个阴影角，通过因子k修正，再保证角度不超过1就可以保证角度的范围。
![算法的近似](https://oss.kiiye9697.cn/20260413145230031.webp)
- k主要决定了什么时候你的阴影scale达到1，那么也就是说，这个阴影的算法效果软硬取决于k的scale，k越大阴影程度越硬。->拟合sigmoid函数的效果是近似的，不过k固定的常数效率显见的更高。安全角度越大，这个阴影scale的近似越软。
#### Strength
- 速度相对应的更快于pcss（不考虑SDF的生成），且这种情况下阴影软硬是一套的，受到k约束。
- 渲染的阴影质量高
#### Weakness
- 存在漏光问题
- 预计算+存储SDF是一个costing的部分。
### Bonus：利用SDF生成的无线分辨率字体效果
一个工程案例和生成，感兴趣可以了解，例如TextMeshPro的效果：
![SDF效果的字体](https://oss.kiiye9697.cn/20260413151039785.webp)
### Bonus：SDF贴图的生成逻辑
简单的一种常见的，线性时间的生成算法，参考知乎文章了解：8ssedt算法
[(9 封私信 / 16 条消息) Tech-Artist 学习笔记：Signed Distance Field 8SSEDT 算法 - 知乎](https://zhuanlan.zhihu.com/p/518292475)

# Shading from environment lighting
## EnvironmentLighting
常见的呈现逻辑为IBL，Image-Base-Lighting，即基于图像的光照；利用一张cubemap/spherical贴图来作为distantmapping的逻辑。
利用IBL的Shading Method：
>显见的是，再计算这个方程的时候可见性项无需考虑（无限远），将ibl记录好的预计算值投射到项数处解决问题。
![IBL中考虑的渲染方程](https://oss.kiiye9697.cn/20260413160538225.webp)
 通用的Equation Solve方法是采用蒙特卡洛方法解决：数值上的无偏差解法
作为数值方法的蒙特卡洛方法的解非常的慢，也就是说**采样方法**一在片元着色器中不推荐进行使用应用。->最近的应用并非绝对如此，不过尽量减少采样function的进行。 
![观察发现，不同的材质表面的反射范围不同](https://oss.kiiye9697.cn/20260413161152681.webp)
 一种显性的快速近似：在针对某方向的采样时的积分限的曲线调优，在线处（偏光滑的函数表达式）、有的特殊小积分限时，误差可以接受。
 ![对积分公式的快速近似](https://oss.kiiye9697.cn/20260413172816255.webp)
### Step1：PreFiltering
在渲染之前，我们将ibl的贴图（brdf的涉及范围），在有了环境光的情况下，我们就可以PreFilter出这个光照贴图，先生成出不同卷积核下光照图后输出，使用的时候进行对应的三线性插值逻辑查询任意大小filter的效果。 
##### Why PreFiltering?
对贴图进行采样逻辑的时候，我们其实可以通过gaussian过的图像来模拟光线在漫反射时候的采样范围！也就是对image贴图的某个范围内的光线处取平均模糊和在反射方向内查询多个角度取平均的粗糙表面效果是相似的！
![对于多范围内的filtering和bedf采样范围立体角的近似](https://oss.kiiye9697.cn/c5cefc5f-bcf8-4167-ad69-5ee46d25344c.webp)
### Step2：TheSplitSum
 - 我们将brdf部分拆分出来，我们暴力的预计算菲涅尔和粗糙度项时，由于菲涅尔项的存储维度过大（4维度），不适合**直接**预计算，因此我们不能完全采用PreCompute来解决问题。
 ![光谱计算和](https://oss.kiiye9697.cn/20260413202536934.webp)
 利用Schlick近似，我们将其中一个变量拆解出去，这样我们预计算的参数空间就比较简单，适用于进行Precompute，具体的近似逻辑为：我们将BaseColor的R0，基础反射率的依赖提取出来，使得BRDF的积分部分只考虑粗糙度和入射角zeita存在对应的依赖，并将R0作为预计算的一部分设计到里面；
![显式计算BRDF中的F项解决](https://oss.kiiye9697.cn/20260413204342865.webp)
这样的话，我们可以将粗糙度和Zeita的部分，使用一张Texture贴图的R G 通道进行两次查表，就可以获取到BRDF中需要积分部分的预计算逻辑。（这里主要涉及到MicroFacet理论。）这里预计算的查找表称为**LUT**。
  ![预计算环境的Shading](https://oss.kiiye9697.cn/20260413204833222.webp)
  通过这种预计算的逻辑，我们可以获得相似于PathTracing的效果；
  对于split sum,我们认为近似->spilt integal；
  对于不同种类的BRDF，这张图是相应固定的，可以认为是一大优势。
## Shadow From Environment
- 这是一种难以解决的问题：由于环境光是多光源问题，难以计算无限远处环境光渲染后的场景设计；如果视为多光源问题进行解决的话，其开销是等价于灯的数目的，是一个很复杂的问题。
- 在采样的时候，由于从任何一个shading point，你很难从任意一个点考虑到四面八方所有不同方向的遮挡情况，因此无法进行重要性采样的参数，也就无从的那个谈起采样遮挡的部分。 
### 工业上的解决办法
使用最主要的贡献光作为REFER，作为主光作为阴影的来源。
### Related Work
- Light cuts：离线渲染的子光源角度
- RTRT：实时的光线追踪方法，有待成为最终的解决方案
- Imperfect shadow maps
- Prt：预计算的辐照度传递；
# Real-time Environment Lighting
## 一些准备知识
>由于主播修过积分变换与场论这门课程，这里写的比较简短，详情可以了解一下复变函数与积分变化部分的知识。
- 傅里叶变换
- 高低通滤波：获取高频/低频信号
![时域频域的调整](https://oss.kiiye9697.cn/20260413213341405.webp)
- 任何两个信号的乘积都可以在某种意义上视为一种滤波操作.
## Spherical Harmoonics(球谐函数)
- 一系列二维的、定义在球面上的基函数
- 类似一维空间内的傅里叶级数理解
在第l阶有2l+1种球谐函数，l为阶数字序号由-l至l，前n阶有n²个函数。
![分层的一种表示特点](https://oss.kiiye9697.cn/20260413214104984.webp)
- 展开成二维的傅里叶变换再逆变换回来会存在曲线的缺失，不如直接再球面上进行分析处理，也避免一些走样和bias
- 基函数的创建是由Legendre来计算出对应的值来获取对应的函数值。
- 针对对应的阶，我们要对同一阶的函数进行一个插值，对应的权重系数我们有一个正交基的相对投影（泛函分析的表示逻辑）
- 利用有限阶的函数，我们将这个函数还原回来，利用的信息从低频向高频逐步细化逐渐逼近原信息而返回。
- 颜色表示的是值的符号，是在函数空间的投影。
### Pros And Cons
Pros：良好的**正交性**，**旋转不变性**
CONS:对于高频信息的还原恢复有限，需要相当高阶的基函数进行还原；且要求场景是一种**静态场景**，预计算的BRDF信息无法替换，对于动态场景比较有限。
### For BRDFs
我们在计算diffuse的BRDF时，将其投影到sh表面进行表示的时候，我们惊讶的发现大致在l=3（**SH在阶段第三项**）左右的部分时，我们就发现对应的BRDF项已经存在了差不多的细节收敛；可以说这个信息也是比较低频的。
![BRDF Diffuse在SH投影时候的表现](https://oss.kiiye9697.cn/20260413224435089.webp)
既然diffuse的BRDF信息都可以用三项拟合，那么Lighting项在上述部分（见上文PreFILTERING部分）对其相乘可以理解为一个**低通滤波**，那么我们就更可以进行SH的拟合了。
![Bouns 神秘的博士论文](https://oss.kiiye9697.cn/20260413230255127.webp)
### SH中的B(I)的性质
- 正交
- 易于重建
- 易于旋转-我们在基函数上投影的旋转，等价于我们旋转**所有基函数**后保存后续的参数；由于基函数是固定的，我们对基函数做的旋转等价于对其作为同阶的其他基函数对其进行线性组合——可以通过打表解决这个部分的问题。
![SH函数的良好性质](https://oss.kiiye9697.cn/20260413233628145.webp)
## PRT （precomputed radiance transfer）
### Introduction
 在这个部分，在光照 输入部分都可以用一张二维表预计算，BRDF部分是一个四维逻辑，不过我们由于上述部分已知我们的观察方向Viewplace,因此我们只需要预先存储对应角度的入射光照强度。
 如果按照这个逻辑，我们就把环境光照的部分拆分成了三张贴图的光照乘在一起利用加权获得光线的效果；在这个基础上，提出了一种算法PRT，通过预计算快速计算出带着光照的算法效果。
![SH预计算部分的表现](https://oss.kiiye9697.cn/20260413230947143.webp)
### Basic Idea
我们将上文的Environment Lightning中的积分公式记录为Lightning+LightningTrans两部分。
对于给定点我们的光线传播公式是固定的，会相对变化的只有可以拆分成逐光源×贡献的L项，这样我们可以直接将LightTransPort部分计算出来。
![PRT的基础理解](https://oss.kiiye9697.cn/20260413232017095.webp)
由于在除了可微渲染以外的其他领域，我们也鲜有考虑积分换序的精确度问题，我们直接通过频域分布提高信息密度，直接通过系数和预计算的TransPort，我们直接计算点乘就可以将其转化成一个很快速的点乘问题。
### Case For Diffuse
在这一步推广中，我们可以将逻辑变为任意一个函数Bp投影至Bq求系数的方法。不过由于Bp、Bq有良好的正交性质，在这一步的时候只有Bp=Bq的case积分值非0，可以展开为On复杂度的遍历计算。
![近似、等价位置](https://oss.kiiye9697.cn/20260413232838272.webp)

### Summary
- 我们预计算的时候，只要规范好light tranform的公式，我们甚至可以预计算LightTransForm的不同方式呈现进去。
- Weakness：烘焙的效果要求物体是静态的，利用SH的良好旋转性只能解决光照旋转的部分。
这样我们将环境光照的算法简化处理为：
$$
L ( {\bf o} ) \approx\rho\sum L_{i} T_{i} \underset{\ast} {}
$$
这是一种很适合Shader处理的公式结构。
### Case For Glossy
>这一部分在Lecture7继续展开，相应逻辑注意切换视频学习。

对于Glossy的材质，和Diffuse相比，主要的逻辑上，BRDF从函数变为一个完整的4D的函数（二维输入和二维输出（方位角判断））。
>Diffuse材质时，镜面反射时，我们只要得知incoming方向，根据镜面反射的公式我们很容易就可以获取到出射方位角，而glossy部分的光线在进行反射时，他的反射方向无法显式的对应得出；（四维的直接SH插值过于高频，不适合利用SH的低阶球谐函数进行插值拟合的计算。）

因此，我们朴素的解决方案是把这个预计算分为L（i）和Ti（o）两个项目分别进行存储，然后根据预计算的function组合成为矩阵（matrix）进行SH的查找（二维入射 * 二维出射），这样我们与计算出来的就是transport matrix查找表。
![Glossy SH投影](https://oss.kiiye9697.cn/20260417213501107.webp)
### TimeComplexity
对于diffuse的情况下，SH一般采用16阶，复杂度大概为16；而利用glossy的方式进行sh插值时候，由于算法原理上，复杂度为16  *  16.一般来说用到3~4阶进行sh拟合即可。
如果不考虑随时间变化的环境光（水平旋转类除外，水平旋转逻辑的环境光可以通过上文的SH函数旋转不变性解决。）
### Interreflections and Caustics
通过不同的光线路径，无论如何光线的路径都是L（lightning起）+LightTransPort结束。因此在实际上渲染的时候，我们只要把光线的传输路径都抽象存储为PRT进行计算。通过这种function我们可以计算任意复杂度的Light Trans。
![焦散与multi bounce Function](https://oss.kiiye9697.cn/20260417234906213.webp)
我们将SH函数展开观察，可以得出如果从一些方向来看，我们可以有相似的可视化逻辑；也就是说我们可以将其理解为一些我们将一些特殊的光照做出的贡献结果进行线性组合，来获取模拟全局lightning的照光表现
![多项基函数融合形成](https://oss.kiiye9697.cn/20260417235255652.webp)
我们可以从四维glossy的拆分逻辑的理解也可以明白，在任意的TransPort复杂程度下，我们都可以通过PRT进行逻辑的模拟，只不过是预计算的存储cost不同。
