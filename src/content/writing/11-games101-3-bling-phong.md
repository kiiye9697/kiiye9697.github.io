---
title: "GAMES101(3)-纹理映射及Bling-Phong光照模型的实现"
course: "GAMES101 现代计算机图形学入门作业"
source: "C:\\Users\\kiiye\\Desktop\\Git\\Notes_For_md\\TA课程\\GAMES101-现代计算机图形学入门作业\\GAMES101(3)-纹理映射及Bling-Phong光照模型的实现.md"
order: 11
---

# 写在前面
事实证明泥工的考试题主打一个随心所欲，今年直接和往年题不在一个难度，甚至会有意料外的问题。事已至此，先来进行紧张刺激的图形学study算球。
Update：修改后的节约编译框架需要完全理解之后在进行对应部分修改，否则下文出可能出现不可预期的问题却看不出来。
# 作业要求
在这次编程任务中，我们会进一步模拟现代图形技术。我们在代码中添加了 Object Loader(用于加载三维模型), Vertex Shader 与 Fragment Shader，并且支持 了纹理映射。 而在本次实验中，你需要完成的任务是:
1. 修改函数rasterize_triangle(const Triangle& t) in rasterizer.cpp: 在此 处实现与作业2类似的插值算法，实现法向量、颜色、纹理颜色的插值。 
2. 修改函数get_projection_matrix() in main.cpp: 将你自己在之前的实验中 实现的投影矩阵填到此处，此时你可以运行./Rasterizer output.png normal 来观察法向量实现结果。 
3. 修改函数phong_fragment_shader() in main.cpp: 实现 Blinn-Phong 模型计 算Fragment Color. 
4. 修改函数 texture_fragment_shader() in main.cpp: 在实现 Blinn-Phong 的基础上，将纹理颜色视为公式中的 kd，实现 Texture Shading Fragment Shader. 
5. 修改函数 bump_fragment_shader() in main.cpp: 在实现 Blinn-Phong 的 基础上，仔细阅读该函数中的注释，实现Bumpmapping. 
6. 修改函数 displacement_fragment_shader() in main.cpp: 在实现 Bump mapping 的基础上，实现displacement mapping.
# 实现
## 事先准备
将作业一、作业二中相关的内容补充好，首先要完善好渲染的颜色填充方法，而且补全透视投影的矩阵方法：这里按理说还是按照z正方向进行，我们在这里先如此假设并按照之前的代码补全对应方法实现。
### 复习：重心坐标以及应用
对于三角形的插值坐标：
设三角形的三个顶点为 A、B、C，平面上任意一点 P 可以唯一地表示为这三个顶点的线性组合：、
P=αA+βB+γC
其中 α、β、γ 是权重系数，满足：
α+β+γ=1
这三个权重系数 (α,β,γ) 就是点 P 相对于三角形 ABC 的重心坐标。通过这个坐标能唯一的确定这个点，在记录顶点位置的情况下能够得到合理的插值系数。
此处的计算方式是：
其实就是两个三角形面积比的形式，这里使用的是两个向量叉乘并取绝对值的方法，也就是两个向量放在一起取行列式的结果。这组插值系数得到了广泛应用，是一种经典的插值算法。
$$
c_1 = \frac{x(y_1 - y_2) + (x_2 - x_1)y + x_1 y_2 - x_2 y_1}{x_0(y_1 - y_2) + (x_2 - x_1)y_0 + x_1 y_2 - x_2 y_1}
$$

$$
c_2 = \frac{x(y_2 - y_0) + (x_0 - x_2)y + x_2 y_0 - x_0 y_2}{x_1(y_2 - y_0) + (x_0 - x_2)y_1 + x_2 y_0 - x_0 y_2}
$$

$$
c_3 = \frac{x(y_0 - y_1) + (x_1 - x_0)y + x_0 y_1 - x_1 y_0}{x_2(y_0 - y_1) + (x_1 - x_0)y_2 + x_0 y_1 - x_1 y_0}
$$
 
 
 ​​
## 重写渲染着色方法
这里我们正式进入3D图形的渲染领域，难度不能说完全一样，只能说是**直线上升**。
首先，我们观察类Triangle以及作业要求，我们发现需要插值的不只是颜色了，之前的插值方法只是为了反走样，但是现在更多的是用以记录颜色、法线、纹理坐标以及坐标插值等数值。
~~~ cpp
 Eigen::Vector3f color_sum(0.0f, 0.0f, 0.0f);
 Eigen::Vector3f normal_sum(0.0f, 0.0f, 0.0f); 
 Eigen::Vector2f texcoord_sum(0.0f, 0.0f);     
 Eigen::Vector3f shadingcoord_sum(0.0f, 0.0f, 0.0f);
~~~
在上一节中，我们实现了over_sampling操作实现了一定程度上的抗锯齿效果，这一次我们增加被插值的变量。
~~~ cpp
//以颜色为例展示插值方法
 Eigen::Vector3f interpolated_color = alpha * t.color[0] + beta * t.color[1] + gamma * t.color[2];
~~~
然后，根据作业说明的指导，我们知道此处的Z-Buffer算法将不再直接更新缓冲区，而是先存储起来再进行相应的渲染，便可以得到初步的着色方法使用。
~~~
 if (depth_sum < depth_buf[ind]) // 使用新的深度值进行比较
 {
     depth_buf[ind] = depth_sum;

     fragment_shader_payload payload
     (
         color_sum,       // 插值后的颜色
         normal_sum.normalized(), // 插值并归一化的法线
         texcoord_sum,    // 插值后的纹理坐标
         texture ? &*texture : nullptr
     );
     payload.view_pos = shadingcoord_sum; 
     // 获取最终颜色
     Eigen::Vector3f pixel_color = fragment_shader(payload);
     Eigen::Vector2i point(x, y);
     set_pixel(point, pixel_color);
 }
~~~
这样，我们就获得了初步的直接颜色渲染方法，将这个方法使用于*main.cpp*的主入口处，注意根据其知道选择好类型，使用**normal_fragment_shader**而不是预设的shader，此处我们还并未实现所谓Phong模型等相关内容。
~~ 后记：其实这里的插值问题问题很大，后面会感受到，见bonus部分解释。~~
### 效果
可以看到还是有蛮明显的锯齿xd，这张沿用了2·2的超采样方法。
![](https://oss.kiiye9697.cn/NAS1.png)
这里突发奇想，用更多顶点的模型是否更好验证超采样的效果？于是又设计了16·16的超采样方法观察一下，我肉眼看不出效果。下面给出一个没有做抗锯齿方法的渲染效果，供参考。
![](https://oss.kiiye9697.cn/no%20AA.png)
说实话区别真的不大，而且这样渲染速度明显快很多，此后我们优先使用这种方法进行实现。
## phong_fragment_shader()的实现
现在正式进行光照的模拟，也就是落地Phong-Shader，Blinn-Phong光照模型。
### 原理回顾
![](https://oss.kiiye9697.cn/20250616215344521.png)
将光线分为高光，漫反射，高光三部分的叠加返回。
### 实现尝试：为什么效果如此之差？
现在我们再phong-shading方法中按照公式及逆行计算并返回。
~~~ cpp
Eigen::Vector3f phong_fragment_shader(const fragment_shader_payload& payload)
{
    Eigen::Vector3f ka = Eigen::Vector3f(0.005, 0.005, 0.005);
    Eigen::Vector3f kd = payload.color;
    Eigen::Vector3f ks = Eigen::Vector3f(0.7937, 0.7937, 0.7937);

    struct light {
        Eigen::Vector3f position;
        Eigen::Vector3f intensity;
    };

    auto l1 = light{ {20, 20, 20}, {500, 500, 500} };
    auto l2 = light{ {-20, 20, 0}, {500, 500, 500} };

    std::vector<light> lights = { l1, l2 };
    Eigen::Vector3f amb_light_intensity{ 10, 10, 10 };
    Eigen::Vector3f eye_pos{ 0, 0, 10 };

    float p = 150;

    Eigen::Vector3f color = payload.color;
    Eigen::Vector3f point = payload.view_pos;
    Eigen::Vector3f normal = payload.normal.normalized();

    Eigen::Vector3f result_color = { 0, 0, 0 };
    for (auto& light : lights)
    {
        // Step 1: Build the light
        Eigen::Vector3f light_dir = (light.position - point).normalized();
        
        // Ambient light
        Eigen::Vector3f ambient = ka.cwiseProduct(amb_light_intensity);

        // Diffuse light (nothing to do with camera place)
        float diff = std::max(0.0f, normal.dot(light_dir)); // cos
        Eigen::Vector3f diffuse = kd.cwiseProduct(light.intensity) * diff;

        // Specular light
        Eigen::Vector3f view_dir = (eye_pos - point).normalized();
        Eigen::Vector3f reflect_dir = (2.0f * normal * normal.dot(light_dir) - light_dir).normalized();
        float spec = std::pow(std::max(0.0f, reflect_dir.dot(view_dir)), p);
        Eigen::Vector3f specular = ks.cwiseProduct(light.intensity) * spec;

        // Accumulate lighting effects
        result_color +=( ambient +specular+diffuse);
    }

    return result_color* 255.f;
}
~~~
这里我们将三种类型光都根据给定的参数做了处理，但是得到的效果不尽人意。
![](https://oss.kiiye9697.cn/wechat_2025-06-17_101839_295.png)
仔细看模型，我们发现着色跟**距离光线的距离远近无关**，跟眼睛位置有一定关系，高光不明显。我们重新审视给定的算法与公式间的关系，发现/r2的距离加权部分完全没有考虑在内，以至于光照着色时渲染出了平滑层的效果。
我们对于对应项进行修正：并添加进环境光中的对应部分。
~~~ cpp
 double light_r = (light.position - point).norm();
 float attenuation = 1.0f / (1.0f + 0.1f * light_r + 0.01f * light_r * light_r);
~~~
得到的效果是：
![](https://oss.kiiye9697.cn/wechat_2025-06-17_103008_625.png)
终于有光照的样子了！根据距离计算着色果然是对的。但是现在的颜色有些过于奇怪，只有白色的质感，怀疑是颜色空间的0-255出现了问题，实质上**根本不是！**，出现的问题有些多，逐步分析。
经过多次调试~~抄正确代码对比和效果比较~~，发现根本错误原因是漫反射项时错误使用了入射光与发现直接点乘而不是使用半程向量与发现方向进行点乘。这个故事告诉我们一定要把公式看明白严格实现再考虑其他的问题，以下是修改项目：
~~~ cpp
//以下是光线的对应渲染部分。
 Eigen::Vector3f l = light.position - point;
 Eigen::Vector3f v = eye_pos - point;
 Eigen::Vector3f h = (v + l).normalized();

 float r = l.norm(); // 光源到物体的距离
 float attenuation = 1.0f / (r * r); // 光强衰减

 // Ambient light
 Eigen::Vector3f ambient = ka.cwiseProduct(amb_light_intensity);

 // Diffuse light
 float diff = std::max(0.0f, normal.dot(l.normalized()));
 Eigen::Vector3f diffuse = kd.cwiseProduct(light.intensity) * diff * attenuation;

 // Specular light
 float spec = std::pow(std::max(0.0f, normal.dot(h)), p);
 Eigen::Vector3f specular = ks.cwiseProduct(light.intensity) * spec * attenuation;

 result_color += ambient + diffuse + specular;
~~~

### bonus：不要相信工作良好的代码就一定没有问题
另外，在调试的时候又发现了渲染三角形虽然上面得到了给定的方法，但是发现需要调整才能获得预期的结果。
我们发现，即使修改好了利用半程向量进行对应的光照模型计算，也会渲染不出真正的模型。观察后会得到只有ambient部分的效果：
![](https://oss.kiiye9697.cn/wechat_2025-06-17_111430_026.png)
在这里我们终于发现了问题：**重心坐标插值应该修改为透视插值方法！！！**，并且要注意的是，我们的
~~~ cpp
Eigen::Vector3f interpolated_color = (
    alpha * t.color[0] / v[0].w() + 
    beta * t.color[1] / v[1].w() + 
    gamma * t.color[2] / v[2].w()
) * Z;

Eigen::Vector3f interpolated_normal = (
    alpha * t.normal[0] / v[0].w() + 
    beta * t.normal[1] / v[1].w() + 
    gamma * t.normal[2] / v[2].w()
) * Z;
interpolated_normal.normalize();

Eigen::Vector2f interpolated_texcoords = (
    alpha * t.tex_coords[0] / v[0].w() + 
    beta * t.tex_coords[1] / v[1].w() + 
    gamma * t.tex_coords[2] / v[2].w()
) * Z;

// 使用view_pos而非t.v!
Eigen::Vector3f interpolated_shadingcoords = (
    alpha * view_pos[0] / v[0].w() + 
    beta * view_pos[1] / v[1].w() + 
    gamma * view_pos[2] / v[2].w()
) * Z;
~~~
#### 问题解决一：不直接使用重心插值而是透视插值
纯粹的重心插值的主要问题就是**经过透视投影的方法之后坐标会发生畸变，导致法向量等坐标会发生变形**。
解决：**使用透视矩阵下的重心坐标进行插值**，这样就能解决之后法线等插值的错误。
#### 问题解决二：使用视口坐标插值而非世界坐标透视插值
对于shadingcoords，我们要计算的是“**从视角看过去的模型所谓的位置**“，而不是考虑他在世界坐标系下的对应位置，在这里我们需要选择合理的坐标系进行合理的判断。
![](https://oss.kiiye9697.cn/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE_17-6-2025_113856_chat.deepseek.com.jpeg)
这里附加一些坐标空间的相关功能用来观察。从这里的说法不难判断应该使用的是什么。
在解决了所有的计算之后，我们正式进入了shader牛牛时代。
![](https://oss.kiiye9697.cn/wechat_2025-06-17_114521_658.png)
终于出现了！高光环境光和shader，感谢图形学。
## texture_fragment_shader()的实现
就是在上述Phong_Shader的基础上将对应的模型贴图根据接口提供的UV坐标提供对应模型的初始颜色值。Phongshader部分完全不变，只是将最初的color部分修改为从对应缓冲区加载的图像uv坐标中存储的颜色值，实际实现的时候发现给到的uv坐标有的地方是负数，进行一下修改。
~~~cpp
if (u < 0) u = 0;
        if (u > 1) u = 1;
        if (v < 0) v = 0;
        if (v > 1) v = 1;
        auto u_img = u * width;
        auto v_img = (1 - v) * height;
        auto color = image_data.at<cv::Vec3b>(v_img, u_img);
        return Eigen::Vector3f(color[0], color[1], color[2])
~~~

~~~ cpp
if (payload.texture)
{
    float u = payload.tex_coords.x();
    float v = payload.tex_coords.y();

    // 根据纹理坐标从纹理中获取颜色
    Eigen::Vector3f texture_color = payload.texture->getColor(u, v);

    return_color = texture_color / 255.f; // 将颜色值转换为 [0, 1] 范围

}
Eigen::Vector3f texture_color;
texture_color << return_color.x(), return_color.y(), return_color.z();
//后面进行Phong——shader的时候从贴图中读取建模实现。
~~~
但是获得的结果很令人困惑！得到的结果很奇怪。
![](https://oss.kiiye9697.cn/wechat_2025-06-17_120852_430.png)
这是什么？通过对框架中渲染管线的复盘发现，因为我们是通过编译产生输出图片的，因此纹理的贴图不是通过cmake指令进行修改，而是使用texture shader进行的相应解决。观察代码中的对应片段：
~~~ cpp
   r.set_texture(Texture(Utils::PathFromAsset("model/spot/hmap.jpg")));
~~~
很显然，再main函数里此时加载的部分是hmap的贴图，用以突出法线而非真正的奶牛贴图。我们从下文中“Texture相应的部分看才能发现真正需要的贴图，修改后在进行编译获得如下结果:
![](https://oss.kiiye9697.cn/be37fcb7-c617-4baf-85f9-b8e29c594863.png)
经过多方努力，使用Phongshader并完成纹理贴图的牛牛终于实现完成了。
## bump_fragment_shader（）的实现
### 原理回顾
这一算法实现的目的是完成法线凹凸贴图的渲染并且根据法线等进行光照计算。凹凸贴图是指计算机图形学中在三维环境中通过纹理方法来产生表面凹凸不平的视觉效果。它主要的原理是通过**改变表面光照方程的法线**，**而不是表面的几何法线**。
这种贴图方式的实现方式是在模型的顶点处记录好其对应的法线值，并且传入法向量的时候使用bumping_map之中记录的相应法向量,这种方法的实现基于逐像素的Phong光照模型，从而实现更高精度的纹理光照效果,这里对应一些量的公式如下：
#### 切线向量：与纹理的 u 坐标方向对齐的向量
$$
\mathbf{t} = \left( \frac{xy}{\sqrt{x^2 + z^2}}, \sqrt{x^2 + z^2}, \frac{zy}{\sqrt{x^2 + z^2}} \right)
$$

#### 副切线向量：与纹理的 v 坐标方向对齐的向量。
$$
\mathbf{b} = \mathbf{n} \times \mathbf{t}
$$

#### TBN 矩阵：将纹理空间内的坐标转映到世界坐标之中
$$
TBN = \begin{bmatrix} 
\mathbf{t}_x & \mathbf{b}_x & \mathbf{n}_x \\ 
\mathbf{t}_y & \mathbf{b}_y & \mathbf{n}_y \\ 
\mathbf{t}_z & \mathbf{b}_z & \mathbf{n}_z 
\end{bmatrix}
$$

#### 纹理高度差计算
$$
dU = kh \cdot kn \cdot \left( h\left(u + \frac{1}{w}, v\right) - h(u, v) \right)
$$
$$
dV = kh \cdot kn \cdot \left( h\left(u, v + \frac{1}{h}\right) - h(u, v) \right)
$$

#### 切线空间中的法线向量：利用uv坐标的纹理法线及逆行对应调节产生uv坐标下的位置矩阵。
$$
\mathbf{ln} = \begin{pmatrix} -dU \\ -dV \\ 1 \end{pmatrix}
$$

#### 世界空间中的法线更新
$$
\mathbf{n}_{\text{new}} = \frac{TBN \cdot \mathbf{ln}}{\| TBN \cdot \mathbf{ln} \|}
$$

### 代码实现
~~~ cpp
//计算相应需求的量用于更新法线贴图和相关技术。
 auto n = normal;
 auto x = n.x();
 auto y = n.y();
 auto z = n.z();
 Eigen::Vector3f t(x * y / sqrt(x * x + z * z), sqrt(x * x + z * z), z * y / sqrt(x * x + z * z));
 Eigen::Vector3f b = n.cwiseProduct(t);
 Eigen::Matrix3f TBN;
 TBN.col(0) = t;
 TBN.col(1) = b;
 TBN.col(2) = n;
 float u = payload.tex_coords.x(), v = payload.tex_coords.y();
 float width = payload.texture->width;
 float height = payload.texture->height;
 float dU = kh * kn * (payload.texture->getColor(std::min(u + 1.f / width, 1.f), v).norm() - \
     payload.texture->getColor(u, v).norm()
     );
 float dV = kh * kn * (payload.texture->getColor(u, std::min(v + 1.f / height, 1.f)).norm() - \
     payload.texture->getColor(u, v).norm()
     );

 //caluclate the normal through this function.
 Vector3f ln{ -dU,-dV,1 };

 //Change it back to wordspace,do not forget to normalize it.
 // Normal n = normalize(TBN * ln)   
 normal = (TBN * ln).normalized();

 Eigen::Vector3f result_color = { 0, 0, 0 };
 result_color = normal;
~~~
**此处注意我们需要手动将texture信息修改为hmap的对应纹理图样。**
![](https://oss.kiiye9697.cn/20250619154126901.png)
这样我们就成功的将纹理的凹凸贴图实现在了对应的模型之上。
## displacement_fragment_shader()的实现
> 这里的对应纹理替换方法就是在凹凸贴图方法基础上再进行一次纹理替换；
> 因为bump mapping只是改变了法向量使得视觉上出现了凹凸，但是实际上会在边缘露馅，而位·移贴图则是真的让三角形顶点进行了位移，只不过有代价，就是必须保证三角形顶点足够细致。
### 代码实现
~~~cpp
 point += kn * n * payload.texture->getColor(payload.tex_coords.x(), payload.tex_coords.y()).norm();
~~~
- 利用法向量和相应纹理坐标处的颜色做处理，对顶点的坐标真正的进行位移操作为不是只修改了法线改变了模型着色的纹理。
- 修改了顶点值后其法线自然有变化，在这个基础上在实现Phong_shader以完成其对应replacement方法的精密实现。
### 结果
通过光照和材质以及顶点唯一方法，我们获得了最终的结果：金属材质纹理牛！
![](https://oss.kiiye9697.cn/20250619161050390.webp)
## 提高部分一：导入其他模型以及对应纹理坐标进行验证
>根据作业要求，我需要一个带有顶点片元坐标的模型，以及其对应的uv
  贴图进行对应的模型渲染，需要修改渲染管线中选取片元的obj部分以及选取的模型图片png部分。模型的纹理贴图也已经给出。
  >一开始的选取的面数过多距离过远，且没有进行mipmap的纹理映射方法，导致其锯齿效果比较明显，故试寻找一个较为简单的模型。
  
  
  首先对相应的.obj文件进行普通渲染：
  - 这里我们做了相当一部分调整：为了更好的找到观察新模型的角度我们调整了相机的对应位置：
  ~~~ cpp
   Eigen::Vector3f eye_pos = { 1, 4, 10 }; 
  ~~~
  - 图形学底层逻辑中一般调整上下移动的是y方向分量，故此调整y值到2.并且x轴相对移动一些以便于更合适的角度。
  - 旋转角度也需要进行一部分的调整，从而将角度比较歪的模型加载进去。
  - 找到子目录在文件管理器中打开找到对应的位置放入obj和png贴图进行对应的模拟，就可以和给定模型一样模仿所有的给定效果了。
### 效果展示
- normal_shader：插值方法进行的RGB着色：
![](https://oss.kiiye9697.cn/20250619192109495.webp)
- phong_shader：有了较为合理的光照模型。
![](https://oss.kiiye9697.cn/20250619192311694.webp)
- texture_fragment_shader：早见于古早游戏的贴图效果（~~哦当然不是少女卷轴5~~）
>Trick:当我们加载自己设定的纹理坐标时，一般情况下发生的问题不是uv坐标超过1的范围，而是uv纹理坐标值出现了很大一部分附属而没有被正确读取。因此，我们需要加一个边界值处理。
~~~ cpp
//when actually use some model else,we need to ensure we load it right.
u = std::fmod(u, 1.0f);
if (u < 0) u += 1.0f;
v = std::fmod(v, 1.0f);
if (v < 0) v += 1.0f;
~~~
![](https://oss.kiiye9697.cn/20250619193011311.webp)
这下看起来已经有使用价值了。
- bump_fragment_shader：法线贴图：已经有了纂刻感和纹理感。
![](https://oss.kiiye9697.cn/20250619194053923.webp)
- displacement_fragment_shader：因为真的移动了边界点从而有更好的纹理效果，且有明显的明暗变化部分。~~那么，古尔丹，代价是什么？~~
![](https://oss.kiiye9697.cn/20250619194242293.webp)
## 提高部分二：实现双线性插值办法Vector3f getColorBilinear(float u, float v)
### 原理：
双线性插值方法就是在uv的纹理坐标上同时在水平，竖直方向上都进行一次插值，让颜色更加平滑。
![](https://oss.kiiye9697.cn/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE_19-6-2025_195222_blog.csdn.net.webp)
通过这种方式进行的插值更加平滑，但也不可忽视的显著增加了计算量。

不得不说，这次的效果十分明显！考虑提高部分一的最后一张图像，显然他的走样程度有着明显的下降。
![](https://oss.kiiye9697.cn/20250619195007114.webp)
最后再来进行一组对比图片：
### 普通的颜色值处理方法效果
![](https://oss.kiiye9697.cn/output.webp)
### 双线性插值颜色处理方法效果

![](https://oss.kiiye9697.cn/output.webp)
这一组的效果就没有上一组明显了。主要原因是：
1.原作业给定贴图质量较高，不是双线性插值主要解决的问题。
2.msaa能处理的边缘锯齿没有解决（而一般人们只关注走样最大的相关部分），故此没有特备的的优势。
## 后记
只能说学习的曲线像极了我起起落落的人生，难度陡增2333
