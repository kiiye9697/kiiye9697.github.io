---
title: "GAMES101(7)-Path-Tracing路径追踪"
course: "GAMES101 现代计算机图形学入门作业"
source: "C:\\Users\\kiiye\\Desktop\\Git\\Notes_For_md\\TA课程\\GAMES101-现代计算机图形学入门作业\\GAMES101(7)-Path-Tracing路径追踪.md"
order: 15
---

> 本系列中最难的实现，也是很多算法的核心基础内容，完成这一部分才可以说是基础入门了计算机图形学的渲染方向。由于一些原因，本篇也会从框架角度力求更深入的分析，并且会试图基于MitSuba2进行这个渲染方法。

# 作业要求
在本次实验中，你只需要修改这一个函数: 
• castRay(const Ray ray, int depth)in Scene.cpp: 在其中实现 Path Tracing 算法 
## 可能用到的函数： 
• intersect(const Ray ray)in Scene.cpp: 求一条光线与场景的交点
• sampleLight(Intersection pos, float pdf) in Scene.cpp: 在场景的所有 光源上按面积uniform 地 sample 一个点，并计算该 sample 的概率密度 
•sample(constVector3fwi,const Vector3fN)inMaterial.cpp:按照该 材质的性质，给定入射方向与法向量，用某种分布采样一个出射方向 
•pdf(constVector3fwi,const Vector3fwo,constVector3f N)inMa terial.cpp:给定一对入射、出射方向与法向量，计算sample方法得到该出射 方向的概率密度 
•eval(constVector3f wi,constVector3fwo,constVector3fN)inMa terial.cpp:给定一对入射、出射方向与法向量，计算这种情况下的f_r值 可能用到的变量有： •RussianRouletteinScene.cpp:P_RR,RussianRoulette的概率
## 算法回顾：PathTracing
其相应的渲染方程如下：
$$
\begin{equation}
L_o(\mathbf{p},\omega_o)=
L_e(\mathbf{p},\omega_o)
+
\int_{\Omega^+}
f_r(\mathbf{p},\omega_i,\omega_o)\,
L_i(\mathbf{p},\omega_i)\,
(\omega_i\cdot\mathbf{n})\,
\mathrm{d}\omega_i
\end{equation}
$$
- 这一流程中L0为渲染的结果颜色，而Le为物体的自发光项，后续fr用于决定光线的吸收量与反射量，并进行光线的后续弹射（从这里看是一个递归的算法）
- 后面的项中：$$L_i(\mathbf{p},\omega_i)\,(\omega_i\cdot\mathbf{n})\,\mathrm{d}\omega_i
$$
1. Li​(p,ωi​)  
    沿方向 ωi​ 的**入射辐射亮度**（radiance），单位 W/(m²·sr)。  
    它已经是“每单位投影面积、每单位立体角”的功率。
2. (ωi​⋅n)=cosθ  
    把“斜着照”的面积放大效应去掉：  
    同样一束光，角度越斜，被照亮的**有效面积**越大，单位面积分到的能量越少。  
    乘 cosθ 就得到**垂直于光线的投影面积**上的功率。
    也就是说，我们对打进来的光线，也要根据其和法线的角度关系有自己的判断，更好的进行角度的判断。
在每次计算直接光照的时候，通过均匀采样任选一个方向，但很少会有光线可以hit光源，尤其当光源较小的时候，这种现象越明显，大量采样的光线都被浪费了。
因此在计算直接光照的时候改进为**直接对光源进行采样。这样所有采样的光线都一定会击中光源(如果中间没有别的物体)，没有光线再会被浪费。**
因而我们对被积分的项由立体角转化为光源面积：（以games101的课件作为参考）
![](https://oss.kiiye9697.cn/20251010165934190.webp)
### 计算：蒙特卡洛积分
在计算球面的相应积分时，进行积分器的话这一过程的计算复杂度过高，因而我们需要对这一积分进行估计拟合，常用的办法就是**蒙特卡洛积分**，下附公式以及相应参考文：

$$
\int_a^b f(x)\,\mathrm{d}x
\;\approx\;
\frac{1}{N}\sum_{i=1}^{N}\frac{f(x_i)}{p(x_i)},
\qquad
x_i\sim p(x)
$$

[(52 封私信 / 80 条消息) 蒙特卡洛积分 - 知乎](https://zhuanlan.zhihu.com/p/146144853)
### 加速Method
#### 重要性采样
（注意下：对谁采样，对谁积分。）
对于蒙塔卡罗积分中的Px项，上述位置还没有进行更详细的叙述，如果假设光源的分布是均匀（对于球面），那么$p(x)=1/(b-a)$，则简化为：

$$
\int_a^b f(x)\,\mathrm{d}x
\;\approx\;
\frac{b-a}{N}\sum_{i=1}^{N}f(x_i),
\qquad
x_i\sim\mathcal{U}(a,b)
$$
但是，既然我们在计算的时候意图获取的是光线方向射出来的光线计算，所以如果均匀采样会对计算的效率产生较大的影响；因而我们在采样的时候如果**已经知道的光源的分布信息**如PDF
（大多数渲染的场景下我们的光源是已知的，可以满足这一需求），那么我们就可以根据关键点来进行采样。
那么我们在重要性采样的时候，就把对应的p（xi）项目使用真实的概率分布函数进行计算，或者选择与原函数相似的易于计算函数，用于更快的拟合。
>注意：
重要性采样的关键不是说原始分布π(x)未知，所以我们要用p(x）来做样本生成，
而是因为相同的样本量，用π(x)分布采样得到的结果方差较大
而用p(x)采样的样本得到的结果方差较小。所以不必困惑重要性权重怎么计算，其实这不是个问题，因为我们是知道π(x)的。

#### 俄罗斯轮盘赌
在BRDF的计算项中，光线每次成功弹射都会进行下一次计算。一般地，我们都只能人为的限定反射的最大次数，以保证程序能够成功终止；而这种做法的精确度与深度值直接相关；
因而，我们有一种**无偏**的计算方法，能够通过给定一个终止概率，在每次即将进行下一步递归前进行一次判定来决定光线是否继续弹射：Russian Roulette；我们也成为俄罗斯轮盘切割法。
这一算法的逻辑为：
![](https://oss.kiiye9697.cn/20251010165126805.webp)
多次计算的逻辑下，本质上这就是一个利用几何分布来截断光线反射的trick，但是可以有效的解决光线的终止。
将其应用在路径追踪当中，这样巧妙的设定之下光线一定会在某次反射之后停止递归，并且计算的结果依然是无偏的，因为Radiance的期望不变。如下图所示。
![](https://oss.kiiye9697.cn/20251010165627254.webp)
# 实现
## 补全部分
### inline Intersection Triangle::getIntersection(Ray ray)
本质上就是再次复现Möller–Trumbore 算法，用来判定射线与对应片元是否相交。
~~~ cpp
inline Intersection Triangle::getIntersection(Ray ray)
{
   ...（上述部分略）
    // TODO find ray triangle intersection
    if (t_tmp < 0)
        return inter;

    inter.happened = true;
    inter.coords = ray(t_tmp);
    inter.normal = normal;
    inter.distance = t_tmp;
    inter.obj = this;
    inter.m = m;
    return inter;
}
~~~
### IntersectP(const Ray& ray, const Vector3f& invDir, const std::array& dirIsNeg)
用于判断包围盒中的物体是否真正被击中；（在作业要求中提及了是否需要关注tin=tout的情形，在这里留下一个悬念。）
~~~ cpp
inline bool Bounds3::IntersectP(const Ray& ray, const Vector3f& invDir,
                                const std::array<int, 3>& dirIsNeg) const
{
    // invDir: ray direction(x,y,z), invDir=(1.0/x,1.0/y,1.0/z), use this because Multiply is faster that Division
    // dirIsNeg: ray direction(x,y,z), dirIsNeg=[int(x>0),int(y>0),int(z>0)], use this to simplify your logic
    // TODO test if ray bound intersects
 
    float x_t_min = (pMin.x - ray.origin.x) * invDir.x;
    float x_t_max = (pMax.x - ray.origin.x) * invDir.x;
    float y_t_min = (pMin.y - ray.origin.y) * invDir.y;
    float y_t_max = (pMax.y - ray.origin.y) * invDir.y;
    float z_t_min = (pMin.z - ray.origin.z) * invDir.z;
    float z_t_max = (pMax.z - ray.origin.z) * invDir.z;

    if (!dirIsNeg[0]) std::swap(x_t_min, x_t_max);
    if (!dirIsNeg[1]) std::swap(y_t_min, y_t_max);
    if (!dirIsNeg[2]) std::swap(z_t_min, z_t_max);

    float t_in = std::max(x_t_min, std::max(y_t_min, z_t_min));
    float t_out = std::min(x_t_max, std::min(y_t_max, z_t_max));
    if (t_in < t_out && t_out >= 0) return true;
    return false;
}
~~~
### Intersection BVHAccel::getIntersection(BVHBuildNode* node, const Ray& ray) const
这一逻辑旨在通过根节点相应的包围盒逐个向下进行判断，通过光源的参数对树进行搜索，向下逐层遍历并寻找更下一级的相交关系。
~~~ cpp
Intersection BVHAccel::getIntersection(BVHBuildNode* node, const Ray& ray) const
{
    std::array<int, 3> disIsNeg = { ray.direction.x > 0, ray.direction.y > 0, ray.direction.z > 0 };
    Intersection inter;
    //没有发生相交
    if (!node || !node->bounds.IntersectP(ray, ray.direction_inv, disIsNeg))
    {
        return inter;
    }
    //solve leaf method
    if (!node->left && !node->right)
    {
        return node->object->getIntersection(ray);//在包围盒中取对应结构计算相交
    }
    //若达到中间节点位置，进行先序遍历
    Intersection leftInter = getIntersection(node->left, ray);
    Intersection rightInter = getIntersection(node->right, ray);

    return leftInter.distance < rightInter.distance ? leftInter : rightInter;
}
~~~
## 实现部分（PathTracing的Ray部分算法实现）
### 初步实现
根据作业安排中提供的伪代码框架，我们进行相应部分的研究：
![](https://oss.kiiye9697.cn/20251010191136974.webp)
我们的工作就是将这一部分转化成框架中的模式实现。（注意观察作业要求中的内容，有有帮助的api部分）
我们实现一下对应的实现部分：
~~~ cpp
Vector3f Scene::castRay(const Ray &ray, int depth) const
{

    // TO DO Implement Path Tracing Algorithm here

    //先判定相交和发光情况
    Intersection p_inter = intersect(ray);
    if (!p_inter.happened) {
        return Vector3f();
    }
    if (p_inter.m->hasEmission()) {
        return p_inter.m->getEmission();
    }

    float EPLISON = 0.0001;
    Vector3f l_dir;
    Vector3f l_indir;

    // sampleLight(inter, pdf_light)
    Intersection x_inter;
    float pdf_light = 0.0f;
    sampleLight(x_inter, pdf_light);

    // Get x, ws, NN, emit from inter
    Vector3f p = p_inter.coords;
    Vector3f x = x_inter.coords;
    Vector3f ws_dir = (x - p).normalized();
    float ws_distance = (x - p).norm();
    Vector3f N = p_inter.normal.normalized();
    Vector3f NN = x_inter.normal.normalized();
    Vector3f emit = x_inter.emit;

    // Shoot a ray from p to x
    Ray ws_ray(p, ws_dir);
    Intersection ws_ray_inter = intersect(ws_ray);
    // If the ray is not blocked in the middle
    if (ws_ray_inter.distance - ws_distance > -EPLISON) {
        l_dir = emit * p_inter.m->eval(ray.direction, ws_ray.direction, N)
            * dotProduct(ws_ray.direction, N)
            * dotProduct(-ws_ray.direction, NN)
            / std::pow(ws_distance, 2)
            / pdf_light;
    }

    // Test Russian Roulette with probability RussianRoulette
    if (get_random_float() > RussianRoulette) {
        return l_dir;
    }

    l_indir = 0.0;

    Vector3f wi_dir = p_inter.m->sample(ray.direction, N).normalized();
    Ray wi_ray(p_inter.coords, wi_dir);
    // If ray r hit a non-emitting object at q
    Intersection wi_inter = intersect(wi_ray);
    if (wi_inter.happened && (!wi_inter.m->hasEmission())) {
        l_indir = castRay(wi_ray, depth + 1) * p_inter.m->eval(ray.direction, wi_ray.direction, N)
            * dotProduct(wi_ray.directiond, N)
            / p_inter.m->pdf(ray.direction, wi_ray.direction, N)
            / RussianRoulette;
    }

    return l_dir + l_indir;
}
~~~
如果按照当前的pathtracing方法实现会产生如下的图像，可以发现光源只有左侧的墙壁成功发光，这里提及前面的伏笔——**没有判断tmin=tmax情况下的相交判定**。
![](https://oss.kiiye9697.cn/20251010195140437.webp)
在先前的函数 IntersectP(const Ray& ray, const Vector3f& invDir, const std::array& dirIsNeg)中，有一行：
~~~ cpp
if (t_in <t_out && t_out >= 0) return true;
~~~
可以发现我们没有把特殊情况t_in=t_out来判断成一个成功相交情景，将其加入等于的判定后再次进行对应的渲染。
![](https://oss.kiiye9697.cn/Games101%20Assign7.webp)
可以看到由于迭代深度的问题，其噪点较多，但是不难发现其原理逻辑是正确的。
### 提高部分
#### Part1：Microfacet
sample,eval,pdf，实现了最基础的Diffuse材质。请在不破 坏这三个函数定义方式的情况下修改这三个函数，实现Microfacet模型。
由于我们不对重要性采样进行实现，因此对框架不发生改动，我们通过增加表面求交的计算等逻辑来实现对应的微表面模型。
##### 回顾：微表面模型
实现的时候使用的主要参考：[(49 封私信 / 10 条消息) 从零开始学图形学：写一个光线追踪渲染器（二）——微表面模型与代码实现 - 知乎](https://zhuanlan.zhihu.com/p/350405670)
在应用当中，我们使用的模型BRDF项为：
$$
f(w_i, w_o) = \frac{D(h) F(w_i, h) G(w_i, w_o, h)}{4 (n, w_i) (n, w_o)}
$$

和常规brdf的相比：

$$
f_r(p, \omega_o, \omega_i) = \frac{dL_o(p, \omega_o)}{L_i(p, \omega_i) \cos \theta_i \, d\omega_i}
$$
简要对照来说：

| 特性            | 基本 BRDF 定义公式                                                                                           | Microfacet BRDF                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **公式形式**      | $$f_r(p, \omega_o, \omega_i) = \frac{dL_o(p, \omega_o)}{L_i(p, \omega_i) \cos \theta_i \, d\omega_i}$$ | $$f(w_i, w_o) = \frac{D(h) F(w_i, h) G(w_i, w_o, h)}{4 \cdot (n \cdot w_i) \cdot (n \cdot w_o)}$$ |
| **物理意义**      | 描述出射辐亮度与入射辐照度的比值，是最基本的 BRDF 定义。                                                                        | 在基本 BRDF 定义的基础上，引入了微平面分布、菲涅尔效应和几何阴影项，用于更精确地描述材质的反射特性。                                             |
| **适用场景**      | 适用于理论分析和简单材质模型（如 Lambertian 漫反射）。                                                                      | 适用于复杂材质模型（如金属、粗糙表面等），常用于高精度渲染和物理真实感模拟。                                                            |
| **复杂度**       | 简单，仅涉及基本的辐射度学关系。                                                                                       | 复杂，包含多个项以描述微观表面特性。                                                                                |
| **是否包含微平面模型** | 不包含。                                                                                                   | 包含微平面模型，通过 $$D(h)、F(w_i, h)、G(w_i, w_o, h)$$ 描述微观表面特性。                                            |
| **是否考虑菲涅尔效应** | 不考虑。                                                                                                   | 通过 $$F(w_i, h)$$ 考虑了菲涅尔效应，描述反射率随入射角的变化。                                                           |
| **是否考虑几何阴影**  | 不考虑。                                                                                                   | 通过 $$G(w_i, w_o, h)$$ 考虑了几何阴影效应，描述微平面之间的遮挡关系。                                                     |
| **能量守恒**      | 通过公式中的 $$\cos \theta_i ,d\omega_i$$隐式满足能量守恒。                                                           | 通过分母中的 $$4 \cdot (n \cdot w_i) \cdot (n \cdot w_o)$$ 和几何阴影项 \(G\) 显式确保能量守恒。                       |
##### 修改和实现
在工业界当中，我们大多使用GGX项来获得较为客观的微表面模型材质;
(值得注意的是，几何衰减存在相应逻辑)
![](https://oss.kiiye9697.cn/20251015173422577.webp)
首先，观察Material.hpp，可以发现对于材质，我们需要修改的是其对应的pdf，eval以及sample逻辑。在原有的switch基础上我们需要新增case：MICROFACET，并且在材质类的枚举中对其进行相应的声明。
~~~ cpp
enum MaterialType { DIFFUSE,MICROFACET};
~~~
为了GGX、G等项的计算，我们在Metarial.H中添加相应的项：
~~~ cpp
inline float G_s(float NdotV, float a)
{
    float k = (a + 1) * (a + 1) / 8;
    return NdotV / (NdotV * (1 - k) + k);
}

inline float G(Vector3f i, Vector3f o, Vector3f N, float a)
{
    float NdotI = clamp(0.0, 1.0, dotProduct(N, i));
    float NdotO = clamp(0.0, 1.0, dotProduct(N, o));
    return G_s(NdotI, a) * G_s(NdotO, a);
}
//calculate is normal disturbion
//Noitice:we must keep sure all the dot result between 0 and 1
inline float D_GGX(Vector3f h, float r, Vector3f N)
{
    float r2 = r * r;
    float NdotH = clamp(0.0, 1.0, dotProduct(N, h));  //有点乘就需要约束！！
    float NdotH2 = NdotH * NdotH;
    float res = r2 / (M_PI * (NdotH2 * (r2 - 1) + 1) * (NdotH2 * (r2 - 1) + 1));
    return res;
}
~~~
> 在本次实现时，我们对采样的method以及pdf的没有进行相应项目的修改，主要进行的时eval项对于光线的相交逻辑进行了修改：
~~~ cpp
//关键位置：Metarial.hpp中eval（），我们利用写好的FG等项目计算颜色赋值
case MICROFACET:
{
    float cosalpha = dotProduct(N, wo); //wo是观测方向
    if (cosalpha > 0.0f) {
        Vector3f h = (-wi + wo).normalized();
        float F = 0.f;
        fresnel(-wi, N, ior, F);
        float down = 4 * fabs(clamp(0.0, 1.0, dotProduct(N, -wi)) * clamp(0.0, 1.0, dotProduct(N, -wi))) + 0.00001;
        float up = F * G(-wi, wo, N, roughness) * D_GGX(h, roughness, N); //F * G * D
        return (up / down) * Kd; //加上Kd就实现了颜色，当然主函数记得给材质设置Kd
    }
    else
        return Vector3f(0.0f);
    break;
}
~~~
在Main.cpp，我们将分辨率改为1024×1024，并在spp处修改为256（令效果更加正确）；通过这种逻辑优化效果并将之前box部分换成microfacet材质的金属球并观察：
~~~ cpp
// Change the definition here to change resolution
Scene scene(2048, 2048);

Material* red = new Material(DIFFUSE, Vector3f(0.0f));
red->Kd = Vector3f(0.63f, 0.065f, 0.05f);
Material* green = new Material(DIFFUSE, Vector3f(0.0f));
green->Kd = Vector3f(0.14f, 0.45f, 0.091f);
Material* white = new Material(DIFFUSE, Vector3f(0.0f));
white->Kd = Vector3f(0.725f, 0.71f, 0.68f);
Material* light = new Material(DIFFUSE, (8.0f * Vector3f(0.747f+0.058f, 0.747f+0.258f, 0.747f) + 15.6f * Vector3f(0.740f+0.287f,0.740f+0.160f,0.740f) + 18.4f *Vector3f(0.737f+0.642f,0.737f+0.159f,0.737f)));
light->Kd = Vector3f(0.65f);
Material* Microfacet1 = new Material(MICROFACET, Vector3f(0.0f));
Microfacet1->ior = 5;
Microfacet1->roughness = 0.06;
Microfacet1->Kd = Vector3f(0.14f, 0.60f, 0.091f);
Material* Microfacet2 = new Material(MICROFACET, Vector3f(0.0f));
Microfacet2->ior = 5;
Microfacet2->roughness = 0.2;
Microfacet2->Kd = Vector3f(0.67f, 0.065f, 0.05f);
~~~
由于spp和像素point数史诗级提升，因此我们需要进入漫长等待并观察：

然后我们将对应部分的函数增加case：,MICROFACET，并在main函数中定义对应材质的物体放置于空间当中；

>`.hpp` 文件通常是头文件，会被多个源文件（`.cpp` 文件）包含。如果没有使用 `inline`，会导致函数被多次定义，从而引发链接器错误;因此我们在定义如GGX的函数function时，应当注意实现时将其内联或者创建相应的源文件以防止编译时候产生重定义问题。、


(Spp的1024 Steps可能过于复杂了，因此我们考虑输出的时downSample的情形。）
效果：（1024乘1024，256spp）
![](https://oss.kiiye9697.cn/Microfacet.webp)
效果2：（512×512，1024spp）
#### Part2：多线程加速
我们试图将多线程应用在 Ray Generation 上，同时需要注意实现时可能涉及的冲突。
对于cpp多线程编程，我们需要头文件thread、mutex。对于其的一些使用以及由单线程转写多线程的method，我们推荐一下学习资料：
[C++ 多线程库  | 菜鸟教程](https://www.runoob.com/cplusplus/cpp-libs-thread.html)
[C++ 标准库  | 菜鸟教程](https://www.runoob.com/cplusplus/cpp-libs-mutex.html)
其中：
- 每个线程负责处理一组像素，彼此之间没有数据依赖；
- 每个线程独立计算像素颜色值，使用自己的局部变量（如 `Vector3f color`）进行累加和归一化，不需要与其他线程共享数据。
除此之外，我们在考虑进程更新的时候，由于有公共变量来计算当前进行的像素值，我们需要将当前的元素值记录并更新，而代码源部分进度更新线程与渲染线程之间没有直接的数据依赖关系。它通过读取 `completed_pixels` 来更新进度条，而渲染线程负责更新 `completed_pixels`。
>由于文件的读写相关操作中，用于fopen和fclose部分的文件读写指针为公共资源，如果进行多线程写入会有占用冲突的问题导致文件产生一定冲突，故本部分没有做对应处理。

~~~ cpp
void Renderer::Render(const Scene& scene)
{
    std::vector<Vector3f> framebuffer(scene.width * scene.height);

    float scale = tan(deg2rad(scene.fov * 0.5));
    float imageAspectRatio = scene.width / (float)scene.height;
    Vector3f eye_pos(278, 273, -800);
    int m = 0;

    // change the spp value to change sample ammount
    int spp = 16;
    //int spp = 1024;
    std::cout << "SPP: " << spp << "\n";
    const int total_pixels = scene.width * scene.height;
    std::atomic<int> completed_pixels(0);
    const int num_threads = std::thread::hardware_concurrency();
    std::vector<std::thread> threads;
    std::mutex mutex;

    // 进度更新函数
    auto update_progress = [&]() {
        while (completed_pixels < total_pixels) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
            float progress = static_cast<float>(completed_pixels) / total_pixels;
            UpdateProgress(progress);
        }
        };

    // 启动进度更新线程
    std::thread progress_thread(update_progress);

    // 线程工作函数，lamda表达式
    auto worker = [&](int start, int end) {
        for (int pixel_idx = start; pixel_idx < end; pixel_idx++) {
            //将整个流程单独拆分出来计算。
            int i = pixel_idx % scene.width;
            int j = pixel_idx / scene.width;

            float x = (2 * (i + 0.5) / (float)scene.width - 1) *
                imageAspectRatio * scale;
            float y = (1 - 2 * (j + 0.5) / (float)scene.height) * scale;

            Vector3f dir = normalize(Vector3f(-x, y, 1));
            Vector3f color(0.0f);

            for (int k = 0; k < spp; k++) {
                color += scene.castRay(Ray(eye_pos, dir), 0);
            }
            color = color / spp;

            framebuffer[pixel_idx] = color;

            // 原子递增计数
            completed_pixels++;
        }
        };

    // 创建渲染线程
    int chunk_size = total_pixels / num_threads;
    for (int t = 0; t < num_threads; t++) {
        int start = t * chunk_size;
        int end = (t == num_threads - 1) ? total_pixels : start + chunk_size;
        threads.emplace_back(worker, start, end);
    }

    // 等待所有渲染线程完成
    for (auto& thread : threads) {
        thread.join();
    }

    // 等待进度线程完成
    progress_thread.join();
    UpdateProgress(1.0f);

    // save framebuffer to file
    FILE* fp = fopen("binary.ppm", "wb");
    (void)fprintf(fp, "P6\n%d %d\n255\n", scene.width, scene.height);
    for (auto i = 0; i < scene.height * scene.width; ++i) {
        static unsigned char color[3];
        color[0] = (unsigned char)(255 * std::pow(clamp(0, 1, framebuffer[i].x), 0.6f));
        color[1] = (unsigned char)(255 * std::pow(clamp(0, 1, framebuffer[i].y), 0.6f));
        color[2] = (unsigned char)(255 * std::pow(clamp(0, 1, framebuffer[i].z), 0.6f));
        fwrite(color, 1, 3, fp);
    }
    fclose(fp);
}
~~~
经过测试，默认steps下的处理速度提高大概50%（很草率的实验）。本机cpu为9950x，而对应的渲染速度同比从1min12s左右下降到36s左右的规模。效果比较可观。


