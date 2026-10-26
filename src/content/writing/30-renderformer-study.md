---
title: "RenderFormer：从三角网格到 HDR 图像"
course: "神经渲染 · 论文学习与复现"
source: "https://microsoft.github.io/renderformer/"
order: 30
---

这个项目以 Transformer 为学习方法，以 SIGGRAPH 2025 的 RenderFormer 为图形学应用实例。我希望弄清楚网络如何读取几何、材质和相机，怎样学习光照响应，以及它在哪些场景会失败。这里是课程学习与复现实验记录，不是论文作者的官方项目，也不把模型视为可以直接替换 Unity 完整渲染管线的产品。

[打开交互学习与实验页](https://www.kiiye9697.cn/renderformer-study/) · [复现仓库](https://github.com/kiiye9697/renderformer-study) · [官方论文与代码](https://microsoft.github.io/renderformer/)

## 学习路径

1. [方法与两阶段数据流](https://www.kiiye9697.cn/renderformer-study/#method)：从三角形 token、注意力到射线查询与图像解码。
2. [完整中文精读](https://www.kiiye9697.cn/renderformer-study/#paper-reading)：按论文结构理解输入表示、训练监督和实验结论。
3. [实际输入输出](https://www.kiiye9697.cn/renderformer-study/#input-output)与[训练记录](https://www.kiiye9697.cn/renderformer-study/#training)：区分论文主方法与下载的发布配置，解释 epoch、optimizer step 和有效 batch；[详细文字协议](https://github.com/kiiye9697/renderformer-study/blob/main/research/input-output-training.md)保留源码依据。
4. [真实 A/B 实验](https://www.kiiye9697.cn/renderformer-study/#experiments)：A 始终是 Cycles 参考，B 始终是 RenderFormer 预测，误差图使用固定色标。

## 网络实际接收什么

场景不是一张输入照片，而是一组三角形顶点、顶点法线、材质属性及相机。锁定的发布版 `renderformer-v1-base` 使用每三角形 13×32×32 的材质小块；其中包括 diffuse、specular、roughness、normal-map 和 emissive。展平后是 13312 维，再编码为 768 维特征。这与原论文主线十个常量材质属性的讲解需要明确区分。

第一阶段建立与视角无关的内部场景表示。第二阶段用相机射线束产生查询，通过交叉注意力读取场景特征，再生成图像。512×512 图像采用 8×8 射线束时有 4096 个查询，而不是把整个场景预先光栅化成输入图。

当前发布 pipeline 对输出执行：

$$
I_{\mathrm{linear}}=10^z-1.
$$

这里 $z$ 是模型的对数 HDR 表示；线性 HDR 结果、训练损失以及经曝光、色调映射、sRGB 转换的展示图片是三个不同层次。网页图片看起来接近，不意味着亮度峰值与能量误差也小。

## 八组真实配置留下了什么发现

已完成官方 Cornell box、五档金属茶壶材质/墙色配置，以及 Sponza 建筑的内部和外部相机诊断。两边共用转换后的几何与相机，使用固定的显示处理，并保存线性域指标。

- Cornell box 的显示域 PSNR 为 33.65 dB、SSIM 为 0.9764，说明本次预训练推理在该配置上较接近参考。
- 低粗糙度金属茶壶只有少数高光像素就能主导 HDR 平方误差。4096 与 8192 采样参考的检查表明，本次差异并非主要由参考噪声造成。不能只看压缩后的显示指标。
- Sponza 内部相机的 PSNR 为 7.78 dB、SSIM 为 0.3203，出现偏暗和结构失真。外部相机诊断仍有明显问题；背景比例不同，不能直接用整图分数变化证明单一原因或泛化改善。

墙色实验分别记录茶壶与地面的固定区域响应。金属壶上的颜色变化可能体现镜面或粗糙反射，不能单独称作漫反射颜色渗透，也不能在没有光路分解的情况下断言纯某类间接光。

[查看参数曲线与区域测量](https://www.kiiye9697.cn/renderformer-study/#response-curves)

## 受限微调：误差改善与适配代价

上述八组历史结果来自 512 像素预训练推理。后续已在 256 像素上完成独立教学微调：固定 RenderFormer 主干，只更新 10,595,203 个 DPT 输出头参数。两个固定场景族共 80 帧，按完整配置组与相机扇区划分为 48 帧训练、16 帧验证、16 帧测试。它是同场景族的受限适配，不是完整模型从零训练或未知场景泛化证明。

实际 microbatch=8、梯度累积=1，每 epoch 6 次参数更新。25 轮、150 步后按验证规则早停，选择第 13 轮最佳权重，验证 log HDR MSE 为 0.00305448，初始为 0.00843297。此后训练误差仍降、总体验证却回升，不能把延长 epoch 当成收敛保证；这里的停止只表示操作性的验证平台期，不是数学最优。

对同一 256 像素的全部 16 帧测试，平均 log MSE 从 0.00815454 降到 0.00278552（下降 65.84%），显示 PSNR 从 14.9862 升至 17.6728 dB。但金属 8 帧 SSIM **全部下降**，均值 0.8349→0.6819，其中一帧 PSNR 也下降；代表图能看到背景边界伪影，不能仅凭误差下降称画质全面提高。Sponza 的平均 SSIM 为 0.2871→0.5209。具体退步机制尚无消融证据。

固定最佳权重在原 512 像素案例上的回归进一步显示代价：Cornell box 的 PSNR 从 33.65 降到 23.81 dB，金属基线从 33.97 降到 23.98 dB；Sponza 内部视角改善、外部视角退步。因而微调权重不能默认全面替换预训练权重，回归结果也不再用于本轮调参。新旧分辨率的数字只分别作各自 A/B/C 对照，不跨分辨率推断改善。

[完整训练曲线、分组指标与图像](https://www.kiiye9697.cn/renderformer-study/#training) · [训练记录与复现说明](https://github.com/kiiye9697/renderformer-study/blob/main/research/training-results.md)。标签统一为 A=Cycles 参考、B=预训练、C=微调后。原九页课程报告保留历史推理版本，训练扩展另行记录。

网页中的[实时材质教学演示](https://www.kiiye9697.cn/renderformer-study/#material-lab)用于解释材质参数，不是浏览器里运行 RenderFormer，也不能作为模型测量结果。

## 版本与复现

本次使用固定的[代码 commit](https://github.com/microsoft/renderformer/tree/eec6a9b8d592303def45e458dd4ebd09d6572abc)和 [base 模型权重 revision](https://huggingface.co/microsoft/renderformer-v1-base/tree/8aa0009563789dbb6c7785a26aac5da2c9b6d117)。发布权重与原论文训练存在版本差异，因此这些结果称为固定发布版本的复现与适用性测试，不称原论文数值的完全重现。

[实验配置、命令与报告入口](https://www.kiiye9697.cn/renderformer-study/#reproduce)
