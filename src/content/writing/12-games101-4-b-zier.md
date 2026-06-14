---
title: "GAMES101(4)-Bézier 曲线"
course: "GAMES101 现代计算机图形学入门作业"
source: "C:\\Users\\kiiye\\Desktop\\Git\\Notes_For_md\\TA课程\\GAMES101-现代计算机图形学入门作业\\GAMES101(4)-Bézier 曲线.md"
order: 12
---

# 写在前面
初始预期是在大一下学期完成所有的任务，但是现在看起来可能略显艰难。由于配置环境的设备在学校，而且目前正在努力完成一个游戏项目，所以这边暂缓了。最近过的有些挣扎，主要是比较孤单吧，一直忙而且付出和努力不太成正比，但是既然选择了那就继续实现Anyway.
# 作业要求
Bézier 曲线是一种用于计算机图形学的参数曲线。在本次作业中，你需要实 现de Casteljau 算法来绘制由 4 个控制点表示的 Bézier 曲线 (当你正确实现该 算法时，你可以支持绘制由更多点来控制的Bézier曲线)。 你需要修改的函数在提供的main.cpp文件中。
-  bezier：该函数实现绘制Bézier 曲线的功能。它使用一个控制点序列和一个 OpenCV：：Mat 对象作为输入，没有返回值。它会使 t在0到1的范围内进 行迭代，并在每次迭代中使 t增加一个微小值。对于每个需要计算的 t，将 调用另一个函数 recursive_bezier，然后该函数将返回在 Bézier 曲线上 t 处的点。最后，将返回的点绘制在 OpenCV ：：Mat对象上。 
-  recursive_bezier：该函数使用一个控制点序列和一个浮点数 t 作为输入， 实现de Casteljau 算法来返回 Bézier 曲线上对应点的坐标。
## 需要实现的算法:De Casteljau
De Casteljau 算法说明如下： 
1. 考虑一个p0, p1, ... pn 为控制点序列的 Bézier 曲线。首先，将相邻的点连接 起来以形成线段。
2. 用 t: (1−t) 的比例细分每个线段，并找到该分割点。 
3. 得到的分割点作为新的控制点序列，新序列的长度会减少一。 
4. 如果序列只包含一个点，则返回该点并终止。否则，使用新的控制点序列并 转到步骤1。 使用[0,1] 中的多个不同的 t 来执行上述算法，你就能得到相应的Bézier 曲 线。
# 实现
## 框架理解
在初始情况下，框架中已经给好了一个绘制**红色线条**，未进行抗锯齿处理的绘制方法，其中的最后一行代码中的[2]=255就是绘制对应颜色的点。
- 其实在这里有一个细节，这里的颜色赋予是直接取等，而后续要求中验证曲线是否贴合的时候需要将另一个绘制曲线颜色设定为绿色。但是这里的颜色赋予方法会将对应像素的颜色直接**覆盖**而不是混合，但是在框架中调用你自己使用的代码在默认函数之后。因此只要我们自己实现后上色的时候将=换为+=，就可以进行混合并获得预期效果。但是覆盖和混合还是有所区别的，这里顺手提一下。
~~~ cpp
void naive_bezier(const std::vector<cv::Point2f> &points, cv::Mat &window) 
{
    auto &p_0 = points[0];
    auto &p_1 = points[1];
    auto &p_2 = points[2];
    auto &p_3 = points[3];

    for (double t = 0.0; t <= 1.0; t += 0.001) 
    {
        auto point = std::pow(1 - t, 3) * p_0 + 3 * t * std::pow(1 - t, 2) * p_1 +
                 3 * std::pow(t, 2) * (1 - t) * p_2 + std::pow(t, 3) * p_3;

        window.at<cv::Vec3b>(point.y, point.x)[2] = 255;
    }
}
~~~
通过这种办法，通过绘制四个给定点我们就可以获得一个标准的贝塞尔曲线，了解了这个逐步绘制办法后，我们将要自己实现这一部分的内容。
### 初始效果
![](https://oss.kiiye9697.cn/bezier.webp)

## 实现recursive_bezier（）
这个函数的要求是根据传入的t权重以及绘制的四个控制点而返回利用De Casteljau计算后的坐标位置。注意，根据作业的框架的要求，我们在这个函数中只需要根据绘制point和传入权重计算对应值即可。
~~~ cpp
cv::Point2f recursive_bezier(const std::vector<cv::Point2f> &control_points, float t) 
{
    //Skip place
    if (control_points.size() == 1) {
        return control_points[0];
    }
    std::vector<cv::Point2f> new_control_points;
    //still keep upload
    for (size_t i = 0; i < control_points.size() - 1; ++i) {
        //count each point from this logic
        float x = (1 - t) * control_points[i].x + t * control_points[i + 1].x;
        float y = (1 - t) * control_points[i].y + t * control_points[i + 1].y;
        new_control_points.push_back(cv::Point2f(x, y));
    }

    // roll method
    return recursive_bezier(new_control_points, t);
}
~~~
## 实现bezier（）
在上面的方法中我们已经实现了已知权重之下的对应方法，那么仿照原有方法，我们将控制点传入并接收，以t为因子迭代遍历着色就可以得到了对应的曲线了。
~~~ cpp
void bezier(const std::vector<cv::Point2f> &control_points, cv::Mat &window) 
{
    // TODO: Iterate through all t = 0 to t = 1 with small steps, and call de Casteljau's 
    // recursive Bezier algorithm.
    for (double t = 0.0; t <= 1.0; t += 0.001)
    {
        auto point=recursive_bezier(control_points, t);
        window.at<cv::Vec3b>(point.y, point.x) += cv::Vec3b(0, 255, 0);//use overlay method to ensure the color result is added.
    }
}
~~~
注意这里我们使用了+=方法用于叠加混合颜色；和一开始给定的遍历方式相似，只不过我们将独立的算法部分封装成了一个迭代函数。
### 算法效果
![](https://oss.kiiye9697.cn/beziermixed.webp)
（这是颜色叠加的效果，学过美术的同学应该都知道我的算法里面假的是绿色）
# Higher-Level：抗锯齿方法
此次作业的update也是针对aa的一个提升需求：实现对Bézier 曲线的反走样。(对于一个曲线上的点，不只把它对应于一个像 素，你需要根据到像素中心的距离来考虑与它相邻的像素的颜色。)
我们计算出来的点坐标大概率并非是整数，所以我们要考虑这个坐标的位置来动态决定相邻3乘3的范围内所有像素点的颜色，根据距离动态插值；
这是我们一开始写好的插值办法：
~~~ cpp
void bezier(const std::vector<cv::Point2f> &control_points, cv::Mat & window) {
   
    int dx[8] = { 1, -1, 1, -1, 1, -1, 0, 0 };
    int dy[8] = { 1, -1, -1, 1, 0, 0, 1, -1 };

    for (float t = 0.0f; t <= 1.0f; t += 0.001f) {
        
        cv::Point2f point = recursive_bezier(control_points, t);

        // 计算当前点的整数坐标
        int x = static_cast<int>(point.x);
        int y = static_cast<int>(point.y);

        // 遍历当前点周围的 3x3 像素
        for (int i = -1; i <= 1; ++i) {
            for (int j = -1; j <= 1; ++j) {
                int neighbor_x = x + j;
                int neighbor_y = y + i;

                // 检查是否在图像范围内
                if (neighbor_x >= 0 && neighbor_x < window.cols && neighbor_y >= 0 && neighbor_y < window.rows) {//robust count

                    // calculate real distrance as weight
                    float distance = std::sqrt(std::pow(point.x - (neighbor_x + 0.5f), 2) + std::pow(point.y - (neighbor_y + 0.5f), 2));

                    // use 1-0 as method 
                    float weight = 1.0f - std::min(distance / 1.0f, 1.0f);

                    // green
                    cv::Vec3b& pixel = window.at<cv::Vec3b>(neighbor_y, neighbor_x);
                    pixel[0] = static_cast<uchar>(pixel[0] + weight * 0);       
                    pixel[1] = static_cast<uchar>(pixel[1] + weight * 255);      
                    pixel[2] = static_cast<uchar>(pixel[2] + weight * 0);     
                }
            }
        }
    }
}
~~~
~~好的作业四分享完成我们下期再见~~
## Wait：Worse or Better？
我们用覆盖的方式和原有曲线比较用以评估抗锯齿方法的效果，很遗憾出现如图效果：
![](https://oss.kiiye9697.cn/QQ20250711-180156.webp)
显然里面黄色的片段为重合部分，红色部分为新方法缺乏的部分，为绿色的部分为抗锯齿方法的填充。
不难发现，虽然有一定的补洞贡献，但是也缺乏了很多片段，因此我们应该再深入解决。起码不出现红色部分并且存在绿色部分为胜利。
可能是线性插值的衰减速度原因，导致靠近的像素也有问题。因此我们将其进行指数级衰减，来控制像素的颜色。
（ps：修改后的反走样效果也一般，可能是参数问题）。理论上应该有所修改，但是现在的效果差强人意，留一个问题在这）
其实对于这种低像素平面，我认为增加采样数据是最有效的方法，进行对比后曲线少点也不能视为失败的指标，应该用曲线的平滑程度的类似评判维度去观察。
