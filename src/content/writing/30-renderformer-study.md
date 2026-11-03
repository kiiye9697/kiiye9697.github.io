---
title: "RenderFormer：从三角网格到 HDR 图像"
course: "神经渲染 · 论文学习与实验"
source: "https://microsoft.github.io/renderformer/"
order: 30
---

RenderFormer通过注意力网络，将三角网格、材质和相机转换为HDR图像。我完成了官方模型推理与Cycles参考对照，并在Cornell场景族上观察从头训练的过程。

官方V1 Base权重在Cornell示例上的**PSNR为38.30 dB、SSIM为0.9771**。参考与预测使用相同场景和相机，指标在Reinhard线性RGB上计算。

![官方Cornell示例：参考、模型预测与误差](/images/renderformer/official-comparison.png)

另构建192组Cornell配置，按完整配置划分训练、验证和测试。从头训练10000步后，128张验证图的**平均PSNR为21.46 dB、SSIM为0.8163**；同一验证集上的官方权重为8.63 dB、0.2251。

这组场景与上方官方示例不同，不能直接比较分数。训练目前暂停，尚未进行最终测试。

![完整验证集的PSNR与SSIM曲线，虚线为同一验证集上的官方权重](/images/renderformer/validation-curves.svg)

固定视角中，模型先恢复大面积颜色与布局，再逐渐形成物体轮廓；偏色、边缘和阴影仍有误差。原生Sponza则保留完整几何与材质作为复杂输入案例，用于分析V1的表示限制。

[课程报告](https://www.kiiye9697.cn/renderformer-study/assets/course-report.docx) · [方法与实验](https://www.kiiye9697.cn/renderformer-study/) · [训练结果](https://www.kiiye9697.cn/renderformer-study/course-training.html) · [代码](https://github.com/kiiye9697/renderformer-study)
