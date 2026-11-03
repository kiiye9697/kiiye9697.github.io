---
title: "RenderFormer：从三角网格到 HDR 图像"
course: "神经渲染 · 论文学习与实验"
source: "https://microsoft.github.io/renderformer/"
order: 30
---

RenderFormer将三角网格、材质和相机编码为token，通过场景Transformer、视角Transformer和DPT解码器生成HDR图像。我围绕这条计算过程，完成了官方模型推理、Cycles参考渲染和Cornell场景族训练实验。

官方V1 Base权重在Cornell示例上的PSNR为38.30 dB、SSIM为0.9771。参考与预测使用相同场景和相机，指标在Reinhard线性RGB上计算。

![官方Cornell示例：参考、模型预测与误差](https://www.kiiye9697.cn/renderformer-study/assets/course-control/cornell-control.png)

另构建192组Cornell配置，按完整配置划分训练、验证和测试。从头训练10000步后，128张验证图的平均PSNR达到21.46 dB、SSIM达到0.8163；同一验证集上的官方权重为8.63 dB、0.2251。这组场景与上方官方示例不同，不能直接比较分数。训练目前暂停，尚未进行最终测试。

固定视角中，模型先恢复大面积颜色与布局，再逐渐形成物体轮廓；偏色、边缘和阴影仍有误差。原生Sponza则保留完整几何与材质作为复杂输入案例，用于分析V1的表示限制。

[方法与实验](https://www.kiiye9697.cn/renderformer-study/) · [训练结果](https://www.kiiye9697.cn/renderformer-study/course-training.html) · [代码](https://github.com/kiiye9697/renderformer-study)
