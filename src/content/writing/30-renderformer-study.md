---
title: "RenderFormer：从三角网格到 HDR 图像"
course: "神经渲染 · 论文学习与复现"
source: "https://microsoft.github.io/renderformer/"
order: 30
---

这个项目用RenderFormer研究Transformer怎样读取三角网格、材质和相机，并从参考渲染中学习生成HDR图像。

[学习入口](https://www.kiiye9697.cn/renderformer-study/) · [实验记录](https://www.kiiye9697.cn/renderformer-study/experiments.html) · [代码](https://github.com/kiiye9697/renderformer-study)

## 方法

模型包含场景Transformer、视角Transformer和DPT图像解码器。场景三角形交换特征，射线束查询读取场景信息，最后解码为图像。[方法笔记](https://www.kiiye9697.cn/renderformer-study/learn.html)按输入表示、注意力、网络结构、监督损失和评估展开。

## 实验

官方Cornell Box用于核对场景转换、参考渲染与预训练推理。课程训练限定在Cornell场景族，按完整配置划分训练、验证和测试，观察材质、位置与光照变化下的学习效果。

原生Sponza保留网格和材质，用来检查复杂场景的输入能力。几何简化、缺失贴图或不兼容的光照表示都会改变比较条件，不能把这些误差直接归因于模型。

新一轮参考图尚待验收，正式训练未开始。历史相机与光源边界测量单独保留，不与新基线合并。[实测记录](https://www.kiiye9697.cn/renderformer-study/experiments.html)中说明各组版本、颜色处理与指标范围。

## 数据与报告

模型输入和参考应共享几何、法线、材质与相机；线性HDR用于保存与计算，展示时采用相同曝光和颜色处理。参考图还需要检查直接光、间接光、反弹次数与采样稳定性。

[参考图标准](https://www.kiiye9697.cn/renderformer-study/reference.html)集中记录这些要求。未确认的参考和未运行的结果不会作为训练效果发布。
