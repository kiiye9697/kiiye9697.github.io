---
title: "RenderFormer：从三角网格到 HDR 图像"
course: "神经渲染 · 论文学习与复现"
source: "https://microsoft.github.io/renderformer/"
order: 30
---

这个项目用RenderFormer研究Transformer怎样读取三角网格、材质和相机，并从参考渲染中学习生成HDR图像。

[实验与对照图](https://www.kiiye9697.cn/renderformer-study/) · [代码与报告](https://github.com/kiiye9697/renderformer-study)

## 方法

模型包含场景Transformer、视角Transformer和DPT图像解码器。场景三角形交换特征，射线束查询读取场景信息，最后解码为图像。网络与数据流程图见[方法章节](https://www.kiiye9697.cn/renderformer-study/#method)。

## 实验

预训练阶段比较官方康奈尔盒和茶壶材质响应。服务器实验使用Bunny与简化Sponza，先冻结Transformer适配DPT，再冻结场景网络、联合适配视角Transformer与DPT，保留相同相机、材质和参考下的训练前后图。

128像素阶段完成30轮，整体误差下降，但建筑细节仍模糊。后续256像素实验使用2048 spp参考与归一化空间梯度损失，先训练DPT，再联合适配视角Transformer与DPT。按验证目标选第59轮，Bunny显示PSNR为19.61→35.55 dB；Sponza为3.08→16.47 dB。Sponza归一化边缘误差下降25.3%，但梁架和细柱仍然模糊。整图、固定局部裁剪与全部视图均保留在实验页。

[场景微调](https://www.kiiye9697.cn/renderformer-study/#training) · [论文边界条件](https://www.kiiye9697.cn/renderformer-study/#limits)

边界实验实际测试内部相机、内部光源、大面积光源和9光源。逐光源线性HDR相加未在本配置中改善直接预测，负结果与参考图一并保留。

## 数据与报告

代码和权重版本固定。PSNR与SSIM使用同一显示变换；不同分辨率和不同配置的指标分别记录。原始模型、EXR、H5与场景资产留在实验目录，网页发布展示图、指标与必要脚本。

[报告与数据下载](https://www.kiiye9697.cn/renderformer-study/#report)
