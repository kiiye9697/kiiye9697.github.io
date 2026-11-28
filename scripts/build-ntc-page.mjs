import fs from 'node:fs/promises';
import path from 'node:path';

const mediaRoot=path.resolve(process.argv[2]||'');
const templatePath=process.argv[3];
if(!process.argv[2]||!templatePath)throw new Error('Supply exported media directory and NTC review HTML template.');
const preview=process.env.NTC_PREVIEW_MEDIA;
const manifest=preview?{}:JSON.parse(await fs.readFile('src/lib/ntc-media.json','utf8'));
const url=name=>preview?new URL(name,preview).href:manifest[name]?.url||(()=>{throw new Error(`Missing uploaded media: ${name}`)})();
const report=JSON.parse(await fs.readFile(path.join(mediaRoot,'review-data.json'),'utf8'));
const inventory=JSON.parse(await fs.readFile(path.join(mediaRoot,'material-inventory.json'),'utf8'));
const comparisons=JSON.parse(await fs.readFile(path.join(mediaRoot,'sampling-correspondence.json'),'utf8')).map(c=>({
  ...c,curve:url(c.curve),original:url(c.original),ntc:url(c.ntc),originalPreview:url(c.originalPreview),ntcPreview:url(c.ntcPreview)
}));
for(const m of report.materials){for(const c of m.channels)for(const k of ['input','output','diff','inputPreview','outputPreview','diffPreview'])if(c[k])c[k]=url(c[k]);m.latentImages=m.latentImages.map(url);if(m.latentPreviews)m.latentPreviews=m.latentPreviews.map(url);m.weights=url(m.weights);}
let html=await fs.readFile(templatePath,'utf8');
html=html.replace('__REVIEW_DATA__',JSON.stringify(report).replaceAll('<','\\u003c'));
html=html.replace('<title>NTC · A/B</title>','<title>NTC 材质纹理压缩 · 孙浩然</title><meta name="description" content="Unity URP 神经纹理压缩：同机位 A/B、输入输出原理图、通道画质、训练曲线、插值误差和训练参数。">');
if(!preview)html=html.replace('<style>',`<link rel="preconnect" href="${new URL(url('cover.webp')).origin}" crossorigin><style>`);
html=html.replace('<main>','<main><nav class="project-nav"><a href="/portfolio/">作品集</a><span>/ NTC 纹理压缩</span><span class="spacer"></span><a href="#training">训练</a><a href="#interpolation">插值</a><a href="#data">数据</a><a href="https://github.com/kiiye9697/NTCinUnity">源码</a></nav>');
html=html.replace('preload="auto"','preload="metadata"').replace('preload="auto"','preload="metadata"');
for(const name of ['Original','NTC-Direct'])html=html.replace(`media/${name}.mp4?range=1`,url(`media/${name}.mp4`));
for(const name of ['original','ntc-direct'])html=html.replaceAll(`media/${name}.png`,url(`media/${name}.webp`));
for(const name of ['compressed-size','latent-layout','channel-quality'])html=html.replace(`figures/${name}.svg`,url(`figures/${name}.svg`));
html=html.replaceAll('<img ','<img loading="lazy" decoding="async" ');
html=html.replace('点击图片查看全尺寸。','页面使用轻量缩略预览，点击通道图查看无损全尺寸结果。');
const link=(file,label)=>`<a href="${url(file)}" target="_blank" rel="noreferrer">${label}</a>`;
const figure=(file,caption)=>`<figure class="research-figure"><a href="${url(file)}"><img loading="lazy" decoding="async" src="${url(file)}" alt="${caption}"></a><figcaption>${caption}</figcaption></figure>`;
const sections=`
<section class="research-section" id="training"><h2>历史训练：SponzaBricks / MetalPlates013</h2><p>两条训练曲线分别对应这两个名称的历史训练记录，各 100,000 步，不与上方 Curtain_Red、Floor、Column_A 的画面配对。左图为相对各自 Original 源图的 PSNR，右图由 10<sup>−PSNR/10</sup> 换算 MSE。Original（无 NTC）是参考，误差为 0、PSNR 为 ∞，本身没有训练步数。</p>
${figure('training-curves.svg','历史训练 PSNR 与归一化 MSE · 200 个原始记录点')}
<details><summary>烘焙工具默认配置与 SDK 训练参数</summary><div class="table-scroll"><table><thead><tr><th>参数</th><th>默认值</th><th>来源</th></tr></thead><tbody>
<tr><td>预算 / 步数</td><td>16 bpp / 100,000</td><td>Bake Window</td></tr><tr><td>Metalness / Smoothness loss scale</td><td>24 / 16</td><td>Bake Window</td></tr><tr><td>mip / GDeflate</td><td>生成 mip / off</td><td>烘焙命令</td></tr><tr><td>网络 / 特征网格学习率</td><td>0.005 / 0.1</td><td>SDK CompressionSettings</td></tr><tr><td>每批像素 / seed / stable training</td><td>64K / 0 / false</td><td>SDK CompressionSettings</td></tr><tr><td>历史两轮的学习率、seed、loss 权重</td><td>日志未记录</td><td>训练记录</td></tr></tbody></table></div><p>表中默认配置与具体训练轮次分开记录。当前容器中的网络结构、mip、特征布局和通道信息见材质清单。</p></details>
<p class="data-links">${link('training-curves.csv','训练曲线 CSV')} · ${link('training-parameters.json','训练参数 JSON')}</p></section>
<section class="research-section" id="interpolation"><h2>同一材质：原图、重建与曲线</h2><p><label>材质 <select id="curveMaterial">${comparisons.map(c=>`<option value="${c.material}">${c.material}</option>`).join('')}</select></label> · Color · mip 0 <span class="muted" id="curveStatus" role="status"></span></p>
<div class="curve-pair"><figure><a id="curveOriginalLink"><img id="curveOriginal" width="640" height="640" loading="lazy" decoding="async" alt="所选材质的 Original 源贴图，无 NTC"></a><figcaption>Original 源贴图（无 NTC）</figcaption></figure><figure><a id="curveNtcLink"><img id="curveNtc" width="640" height="640" loading="lazy" decoding="async" alt="同一材质的 NTC Color 重建"></a><figcaption>同一材质的 NTC 重建</figcaption></figure></div>
<figure class="research-figure"><a id="curveLink"><img id="curvePlot" loading="lazy" decoding="async" alt="所选材质的 Original 与 NTC 采样对照曲线"></a><figcaption id="curveCaption"></figcaption><button id="curveRetry" hidden>重新加载</button></figure>
<p>每组使用相同的 2,048 个位置、65 个亚像素相位。左图以 Original Bilinear 为统一参考，同时画出无 NTC 的 Point、Bilinear 和 NTC 的 Point、Bilinear；右图保持过滤方式相同，分别比较 NTC Point 与 Original Point、NTC Bilinear 与 Original Bilinear。</p>
<p class="muted">这里的 Original 指源贴图；尺寸不同时先按记录缩放到 NTC 分辨率，指标在 8-bit 存储 RGB 域计算。场景 A/B 中的 Original 是 Unity 导入后的原材质，两组对照分别记录。</p>
${figure('figures/channel-mse.svg','三组材质各通道的重建 MSE；Original 源图自比较为 0')}
<p class="data-links">${link('sampling-correspondence.json','图像、模型与曲线对应清单')} · ${link('interpolation-loss.csv','四条采样曲线 CSV')} · ${link('channel-mse.csv','Original / NTC 通道误差 CSV')} · ${link('training-parameters.json','探针参数')}</p>
<script>
(()=>{const records=${JSON.stringify(comparisons).replaceAll('<','\\u003c')};
const byId=id=>document.getElementById(id);
let loadVersion=0;
async function show(name){const c=records.find(r=>r.material===name);if(!c)return;const version=++loadVersion;
const images=['curveOriginal','curveNtc','curvePlot'].map(byId);for(const img of images)img.style.visibility='hidden';byId('curveRetry').hidden=true;
byId('curveCaption').textContent=c.material+' / Color / 正在加载对应图片与曲线…';
byId('curveStatus').textContent='正在加载 '+c.material+' 的对应图片与曲线…';
byId('curveMaterial').value=name;byId('curveOriginal').src=c.originalPreview;byId('curveOriginalLink').href=c.original;
byId('curveNtc').src=c.ntcPreview;byId('curveNtcLink').href=c.ntc;byId('curvePlot').src=c.curve;byId('curveLink').href=c.curve;
try{await Promise.all(images.map(img=>img.decode()));if(version!==loadVersion)return;for(const img of images)img.style.visibility='visible';
byId('curveStatus').textContent='';byId('curveCaption').textContent=c.material+' / '+c.channel+' / mip '+c.mip+' / '+c.comparisonSize.join(' × ')+' · 图片和曲线来自同一组配对数据';}
catch{if(version===loadVersion){byId('curveStatus').textContent='加载失败，请点击下方重试';byId('curveCaption').textContent=c.material+' / 对应图片或曲线加载失败';byId('curveRetry').hidden=false;}}}
window.addEventListener('ntc-material-change',event=>show(event.detail.name));
byId('curveMaterial').onchange=event=>{const main=byId('material');main.value=String(records.findIndex(c=>c.material===event.target.value));main.dispatchEvent(new Event('change'));};
byId('curveRetry').onclick=()=>show(byId('curveMaterial').value);
show(records[0].material);})();
</script></section>
<section class="research-section" id="data"><h2>纹理数据与图表</h2><p>每组贴图保留输入、NTC 重建、差值、特征网格和权重预览。材质清单记录当前 24 组绑定的文件大小、SHA-256、分辨率、mip、通道、网络结构、采样设置和 Direct 支持情况。</p>
<div class="table-scroll"><table><thead><tr><th>材质</th><th>分辨率</th><th>.ntc</th><th>mip</th><th>路径</th></tr></thead><tbody>${inventory.map(m=>`<tr><td>${m.material}</td><td>${m.width} × ${m.height}</td><td>${(m.fileBytes/1048576).toFixed(2)} MiB</td><td>${m.mips}</td><td>${m.directUnsupportedReason?'Original':'Direct'}</td></tr>`).join('')}</tbody></table></div>
<p class="data-links">${link('experiment-data.zip','下载图表与实验数据包')} · ${link('review-data.json','通道质量数据')} · ${link('material-inventory.json','24 组材质清单')} · ${link('historical-metalplates-quality.csv','MetalPlates 逐通道质量')}</p>
<div class="figure-links">${link('figures/compressed-size.svg','压缩大小图')} · ${link('figures/channel-quality.svg','通道质量图')} · ${link('figures/latent-layout.svg','特征格式图')}<br>${report.materials.map(m=>link(`figures/${m.name}-pipeline.svg`,m.name+' 原理图')).join(' · ')}</div></section>
<section class="research-section"><h2>实现与参考</h2><p>Unity 侧以 GUID 绑定纹理组，经统一纹理访问入口解码 PBR 通道，接入 URP Lit。相同采样约定复用整组解码结果，滤波循环共用一个解码调用点；原图回收、恢复和共享消费者由资源生命周期管理。</p><p><a href="https://github.com/kiiye9697/NTCinUnity">Unity 实现与烘焙工具</a> · <a href="https://github.com/kiiye9697/NTCinUnity/blob/main/docs/%E5%B7%A5%E5%85%B7%E8%AF%B4%E6%98%8E.md">工具链说明</a></p><p>算法参考 Vaidyanathan、Salvi、Wronski、Akenine-Möller、Ebelin、Lefohn 的 <a href="https://research.nvidia.com/labs/rtr/neural_texture_compression/">Random-Access Neural Compression of Material Textures</a>（SIGGRAPH 2023）；离线压缩使用 <a href="https://github.com/NVIDIA-RTX/RTXNTC">NVIDIA RTXNTC</a>。</p><p class="muted">Sponza 场景与纹理：Frank Meinl / Crytek；原始模型 Marko Dabrovic；Morgan McGuire 整理；Kristijonas Jalnionis 的 PBR 转换与模型修正。本项目负责 NTC 烘焙、Unity 接入、调优、采样与展示工具。</p></section>`;
html=html.replace('<footer>',sections+'<footer>');
html=html.replace('</style>',`.curve-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:24px 0}.curve-pair figure{margin:0}.curve-pair img{width:100%;height:auto}.curve-pair figcaption{color:#aeb7be;font-size:13px;margin-top:8px}.project-nav{display:flex;gap:16px;align-items:center;padding-bottom:20px;font-size:14px}.project-nav a,.research-section a{color:#bacbd7;text-decoration:underline;text-underline-offset:4px}.research-section{margin-top:48px;padding-top:24px;border-top:1px solid #41464b;scroll-margin-top:20px}.research-section h2{font-size:20px}.research-section p{font-size:16px;line-height:1.85;max-width:1040px}.research-figure{margin:24px 0}.research-figure img{width:100%;height:auto;background:white}.research-figure figcaption{color:#aeb7be;font-size:13px;margin-top:8px}.research-section summary{cursor:pointer;padding:14px 0;font-size:16px}.table-scroll{overflow-x:auto;max-height:460px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #343b40}th{background:#22272b;position:sticky;top:0}.data-links,.figure-links{line-height:2.2}.project-nav .spacer{min-width:0}@media(max-width:600px){.project-nav{gap:10px;flex-wrap:wrap}.project-nav .spacer{display:none}} </style>`);
// The final page may only contain public media URLs, never local credentials or paths.
if(!preview&&/127\.0\.0\.1|file:\/\/|AppData|accessKeySecret/.test(html))throw new Error('Local configuration leaked into page.');
await fs.mkdir('src/generated',{recursive:true});await fs.writeFile('src/generated/ntc.html',html);
console.log(`Built /ntc/ with ${preview?'preview':'OSS'} media URLs.`);
