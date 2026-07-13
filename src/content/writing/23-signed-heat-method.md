---
title: "广义有符号距离计算方法 Signed Heat Method"
course: "SDF 研究笔记"
source: "https://github.com/kiiye9697/SDF-Generator"
order: 23
---

> 主要研究：Feng & Crane (2024) SIGGRAPH 论文进行深度解耦，直奔离散实现与工业界应用；涵盖传统 2D SDF 算法（暴力法/Saito/8SSEDT）、SHM 核心管线拆解、工程化复现与 GPU 加速实践。

## 1. Introduction

### 1.1 传统方案缺陷 

- **传统方法**：工业界计算有符号距离函数（Signed Distance Function, SDF）的标准管线通常遵循"修复-距离-标记"三步走策略。首先对输入几何进行显式修复（如 Poisson 重建、广义绕数 GWN 提取等值面），然后在修复后的闭合网格上计算精确无符号距离（如 MMP 算法或 Fast Marching），最后通过光线投射或绕数测试赋予符号。这套管线在 Autodesk Maya、Blender、Houdini 等主流 DCC 工具中已沿用超过二十年。
问题所在：该传统方法存在三个致命缺陷：
- 第一，**错误累积**——重建阶段的误差会直接传播到最终 SDF，且无法回溯修正（GWN 的等值面提取 notoriously 困难，论文图 28 显示 12% 的示例存在超过 50% 面积误分类）。
- 第二，**管线冗余**——修复+距离+标记三个独立步骤的总成本约为本文方法的 **10 倍**（论文 9.5.3 节）。
- 第三，**泛化能力缺失**——传统方法严格依赖 watertight 输入，对孔洞、自交、噪声的容错率极低，且几乎无法处理非流形网格或曲面上的曲线。
### 1.2 解决方法 (The Solution)

- **核心机制**：本文提出 **Signed Heat Method (SHM)**，将热方法从标量扩散（Unsigned Heat Method）扩展到**向量扩散**——在曲面上对输入几何的法向量进行短时时热扩散，通过平行传输保持方向一致性，归一化后得到 SDF 梯度场的最小二乘近似，最后求解 Poisson 方程重建 SDF。
- **带来的改变**：该机制从根本上将 SDF 计算从"先修复再计算"的显式管线，转变为"在扩散过程中隐式补全"的 PDE 驱动管线。由于扩散的平滑插值特性，孔洞和断裂处的法向量会被邻近区域的法向量自然填充，无需显式重建。同时，整个算法收敛于求解两个稀疏线性系统，在网格拓扑不变时可**离线预分解**，将运行时成本降至单次前代/回代求解。



## 2. KeyWords

| 关键词 (Academic)                        | 简单解释                                          | 在本算法中的具体职责                                                     |
| :------------------------------------ | :-------------------------------------------- | :------------------------------------------------------------- |
| **Connection Laplacian**              | 带平行传输的向量拉普拉斯，复数 Hermitian 稀疏矩阵                | Step I 的核心算子，确保向量在相邻切空间之间旋转传递时保持几何一致性                          |
| **Crouzeix-Raviart (CR) Basis**       | 以边中点为自由度（而非顶点）的分片线性基函数                        | 为向量场提供足够自由度以编码径向对称场，使曲线源项可在单个三角形内离散化                           |
| **Varadhan's Formula**                | 短时热核的对数渐近公式，$-\sqrt{t} \log k_t \sim d^2 / 4$ | 热方法的理论基础：扩散后的场梯度与真实距离梯度平行                                      |
| **Generalized Signed Distance (GSD)** | 对破损/不闭合几何仍保持良定义的广义有符号距离                       | 算法输出：兼具 inside/outside 分类（比 GWN 更鲁棒）和真实距离值（可用于 Sphere Tracing） |
| **Intrinsic Delaunay Triangulation**  | 仅翻转边改善网格质量，不修改顶点坐标                            | 提升 Connection Laplacian 数值稳定性，且不改变几何本身                         |

## 3. Technical Breakdown

### 3.1 From Geometry To Liner

SHM 的核心洞察可以归结为一句话：**把几何分析问题转换成线性代数问题**。传统方法（如 Fast Marching）需要用优先队列逐波前推进，每一步都依赖局部几何决策，这导致算法在破损输入上容易"走错路"——一个局部的方向错误会沿着波前传播放大。SHM 选择了一条完全不同的路线：先用热扩散这个"全局平滑操作"收集所有法向量信息，然后用最小二乘拟合找到最匹配的距离函数。热扩散和最小二乘拟合在离散化后，恰好都对应求解稀疏线性系统。

具体而言，算法涉及**两个**形如 $Ax=b$ 的线性系统：

### 向量热扩散 (Step I)
$$(M + t L_\nabla) \, X = X_0$$

形如$(M + t L_\nabla)$ 的部分组成矩阵：这个矩阵编码了"向量在网格上如何扩散"的规则。把它拆开看：

- **$M$ — 质量矩阵**：一个对角阵，维度 $|E| \times |E|$（$|E|$ 是边数）。每条边 $ij$ 对应的对角元等于 $1/3$ 倍相邻三角形面积之和。它的物理意义是给不同边分配"权重"——面积大的区域边上有更多"质量"，扩散时变化更慢。在代码里就是一个 `VectorXd` 存对角线，或用 `DiagonalMatrix`。
- **$L_\nabla$ — Connection Laplacian**：这是整个算法最特殊的矩阵，也是 SHM 区别于 Unsigned Heat Method 的关键。普通 cotan Laplacian 只处理标量（温度在顶点上扩散），而 Connection Laplacian 处理的是**向量**（法向量在切空间上扩散）。
  它的构建逻辑是：对每条边 $ij$，遍历所有包含这条边的三角形 $ijk$，计算 cotan 权重 $w = 2\cot\theta_k^{ij}$（与标准 cotan Laplacian 一样），但关键在于非对角元要乘一个**复数旋转因子** $r_{ij \to jk}$。这个复数表示：把向量从边 $ij$ 的局部坐标系旋转到边 $jk$ 的局部坐标系，需要转多少角度。具体来说：
  $$r_{ij \to jk} = s \cdot e^{-i(\pi - \theta_k^i)}$$
  其中 $\theta_k^i$ 是三角形 $ijk$ 在顶点 $i$ 处的角，$s \in \{+1, -1\}$ 表示两条边的相对定向是否一致。
  **为什么用复数**：每条边的切空间是二维的，可以用一个复数 $a + bi$ 同时编码切向和法向分量（$a$ 对应沿边方向，$b$ 对应垂直于边方向）。两个复数相乘正好实现了二维旋转——这正是平行传输的离散表达。使用复数编码后，原本每个非对角元需要存一个 $2 \times 2$ 实矩阵（4 个 float），现在只需要 1 个复数（2 个 float），**存储和带宽减半**。
- **$t = h^2$ — 扩散时间**：$h$ 是边中点的平均间距。经验值，$t$ 过大导致过度平滑，过小退化为图距离。
$X_0$ ：$X_0$ 是源几何的法向量在 CR 基上的投影。对于位于面 $ijk$ 内的一条有向曲线段 $\gamma$（从 barycentric 点 $p_A$ 到 $p_B$），它的法向量 $N_\gamma$ 需要"涂抹"到这个面的三条边上。以边 $ij$ 为例：
$$(X_0)_{ij} = \frac{|\gamma|}{|ijk|} \left( N_\gamma \cdot \hat{e}_{ij} + N_\gamma \cdot \hat{e}_{ij}^\perp \cdot i \right) \varphi_{ij}(m_\gamma)$$

这里 $|\gamma|$ 是曲线段长度，$|ijk|$ 是三角形面积，$\hat{e}_{ij}$ 和 $\hat{e}_{ij}^\perp$ 分别是边方向和垂直方向的单位向量（构成边 $ij$ 的局部坐标系），$\varphi_{ij}(m_\gamma)$ 是 CR 基函数在中点处的值。公式的直觉是：曲线越长、三角形越小、法向量越对齐边方向，对这条边的贡献就越大。
$X$ ：$X \in \mathbb{C}^{|E|}$ 是扩散后的向量场，存储在每条边上。它的方向近似于"从该点沿最短测地线回到源曲线时，源点法向量经过平行传输后的结果"。模长会随距离指数衰减，但方向保持清晰——这正是后续归一化步骤能恢复出有效梯度场的原因。

**关键工程性质**：矩阵 $(M + t L_\nabla)$ 在网格拓扑不变时是**常数矩阵**。只要网格不动（不增删顶点/边/面），这个矩阵就不用重建，可以一次性做 Cholesky 预分解，之后每次求解都是 $O(n)$ 的前代/回代。

### Poisson 积分 (Step III)

$$C \, \phi = \nabla \cdot Y$$

**系数矩阵 $C$ 是什么**：标准的 cotan Laplacian，维度 $|V| \times |V|$（$|V|$ 是顶点数）。每个非对角元 $C_{i,j} = -\frac{1}{2}\sum_{ijk \succ ij} \cot\theta_k^{ij}$，对角元是所在行其他元素的负和。这是几何处理中最常用的离散 Laplacian，半正定，零空间由常数函数张成。

**右端项 $\nabla \cdot Y$ 怎么来**：Step II 把扩散向量场 $X$ 从边 averaging 到面中心，归一化得到单位向量场 $Y$（$|F| \times 3$ 的实数矩阵）。然后对每个顶点 $i$ 计算周围面片上的散度：

$$(\nabla \cdot Y)_i = \frac{1}{2} \sum_{ijk \succ i} \left( \cot\theta_k^{ij} \, \vec{e}_{i \to j} + \cot\theta_j^{ki} \, \vec{e}_{k \to i} \right) \cdot Y_{ijk}$$

这里 $Y_{ijk}$ 是面 $ijk$ 上的归一化向量（三维实向量），$\vec{e}_{i \to j}$ 是从顶点 $i$ 指向 $j$ 的边向量。散度的物理意义是：向量场在某点是"发散"（源）还是"汇聚"（汇），Poisson 方程把散度场"积分"回势函数——这个势函数就是 SDF。

**解 $\phi$ 是什么**：$\phi \in \mathbb{R}^{|V|}$ 是每个顶点的广义有符号距离值。正号表示该点在源曲线的"外部"（法向量指向的一侧），负号表示"内部"。由于 cotan Laplacian 的零空间存在，解只确定到一个常数偏移，需要通过 `Shift` 操作将源曲线上的平均值归零。

>后边实现的角度来看呢，矩阵 $C$ 同样是**常数矩阵**，支持离线预分解。论文使用 Eigen 的 `SimplicialLDLT<SparseMatrix<double>>`，预分解后每次求解也是 $O(n)$。

## 4. Algorithm Pipeline & Pseudo-code

### 4.1 管线架构图

SHM 算法的**三步流水线**大概如此，主要是想体现每步内部的子操作和数据流转：
**Step I — 向量热扩散** $(M + t L_\nabla) X = X_0$：将源曲线上的法向量 $N$ 扩散到整个网格。内部拆成三个子操作：
- **Build Operators（OFFLINE）**：计算 cotan 权重，组装 Connection Laplacian $L_\nabla$（Eq.9）和质量矩阵 $M$（Eq.7），然后做 Cholesky 预分解。这一步只做一次，网格拓扑不变时永远不用重做。
- **Build Source（RUNTIME）**：对每条曲线段 $\gamma$，将其法向量 $N_\gamma$ 投影到所在面的三条 CR 边基上（Eq.11），得到右端项 $X_0 \in \mathbb{C}^{|E|}$。
- **Solve（RUNTIME）**：用预分解的 LDLT 做前代/回代，$O(|E|)$ 时间得到扩散后的向量场 $X \in \mathbb{C}^{|E|}$。
**Step II — 归一化**：对每个面，把三条边上的扩散向量平均到面中心，然后归一化为单位向量。输出 $Y \in \mathbb{R}^{|F| \times 3}$，这就是近似的 SDF 梯度方向。

**Step III — Poisson 积分** $C \phi = \nabla \cdot Y$：将梯度场"积分"回势函数。同样拆成三个子操作：
- **Build C（OFFLINE）**：组装 cotan Laplacian $C$（Eq.10），Cholesky 预分解。
- **Divergence（RUNTIME）**：对每个顶点计算归一化向量场的离散散度（Eq. 散度公式），得到右端项 $b \in \mathbb{R}^{|V|}$。
- **Solve + Shift（RUNTIME）**：LDLT 求解后用 `Shift` 操作把源曲线上的平均值归零，输出 GSD $\phi \in \mathbb{R}^{|V|}$。

**核心数据流**：$N_\Omega \to X_0 \to X \to Y \to \phi$，维度变化为：曲线法向量 $\to$ 边的复数向量 $\to$ 面的单位向量 $\to$ 顶点的标量距离。
### 4.2 核心执行伪代码

```cpp
// ============================================================================
// Signed Heat Method (SHM) — 广义有符号距离计算
// 输入: 三角形网格 M = (V, E, F)，源几何 Omega（有向曲线/点集）
// 输出: 顶点上的广义 SDF phi
// ============================================================================

// ---------------------------------------------------------------------------
// STEP I-a: 构建稀疏算子（OFFLINE，网格拓扑不变时只做一次）
// ---------------------------------------------------------------------------

// Algorithm 5 (Paper Section 5.4): 构建 Connection Laplacian
// 输入: halfedge mesh M（含内蕴量：边长、角）
// 输出: L_grad ∈ C^{|E| x |E|}，复数 Hermitian 稀疏矩阵
SparseMatrix<complex<double>> buildConnectionLaplacian(const Mesh& M) {
    SparseMatrix<complex<double>> L_grad(M.E, M.E);
    
    for (Face f : M.faces) {           // 遍历每个三角形面 pqr
        for (EdgeCirculator ec(f); ec; ++ec) {  // 面的三条边 ijk 的循环移位
            Edge ij = ec.current();
            Edge jk = ec.next();
            
            // cotan 权重：与普通 cotan Laplacian 计算方式相同
            double w = 2.0 * cot(angle_opposite(ij, f));  // Equation 6
            
            // edge rotation：边 ij 到边 jk 的最小旋转，复数编码
            complex<double> r = edgeRotation(ij, jk, f);   // Equation 8
            
            // 组装矩阵（Hermitian：L(i,j) = conj(L(j,i))）
            L_grad(ij, ij) += w;        // 对角元 += cotan 权重
            L_grad(jk, jk) += w;
            L_grad(ij, jk) -= w * r;    // 非对角元：权重 * 旋转
            L_grad(jk, ij) -= w * conj(r);  // Hermitian 对称
        }
    }
    return L_grad;
}

// Algorithm 6 (Paper Section 5.3): 构建 CR 质量矩阵
// 输出: M ∈ C^{|E| x |E|}，对角阵
SparseMatrix<complex<double>> buildCRMassMatrix(const Mesh& F) {
    SparseMatrix<complex<double>> Mmat(M.E, M.E);
    for (Face f : M.faces) {
        for (Edge e : f.edges) {
            Mmat(e, e) += area(f) / 3.0;  // Equation 7: 每个面贡献 1/3 面积给邻边
        }
    }
    return Mmat;
}

// Algorithm 7 (Paper Section 5.5): 构建 Cotan Laplacian
// 输出: C ∈ R^{|V| x |V|}，实数对称半正定
SparseMatrix<double> buildCotanLaplacian(const Mesh& M) {
    SparseMatrix<double> C(M.V, M.V);
    for (Face f : M.faces) {
        for (Halfedge h : f.halfedges) {
            Vertex i = h.tail(), j = h.tip();
            double w = 0.5 * cot(angle_opposite(h, f));  // Equation 10
            C(i, j) -= w;  // 非对角元
            C(i, i) += w;  // 对角元累加
        }
    }
    return C;
}

// 离线预分解（两个矩阵各分解一次）
SimplicialLDLT<SparseMatrix<complex<double>>> solver1(Mmass + t * L_grad);
SimplicialLDLT<SparseMatrix<double>> solver2(C_lap);

// ---------------------------------------------------------------------------
// STEP I-b: 求解向量热扩散（RUNTIME，每次源曲线变化时执行）
// ---------------------------------------------------------------------------

// Algorithm 11 (Paper Section 5.6): 构建源项 X_0
// 将有向曲线的法向量投影到 CR 边基上
Vector<complex<double>> buildSourceTerm(const Mesh& M, const Curves& Omega) {
    Vector<complex<double>> X0(M.E);
    X0.setZero();
    
    for (CurveSeg gamma : Omega.curves) {  // 遍历每条曲线段
        double len = barycentricLength(gamma, M);   // 曲线段长度
        complex<double> n = curveNormal(gamma, M);  // 法向量（复数编码）
        
        Halfedge h = sharedHalfedge(gamma.start, gamma.end, M);
        if (h.isValid()) {
            // 曲线沿边：仅贡献给该边
            X0[h.edge] += len * n;
        } else {
            // 曲线穿面：贡献给所在面的三条边（Algorithm 11, Eq. 11）
            Face f = sharedFace(gamma.start, gamma.end, M);
            BaryPoint mid = midpoint(gamma);
            for (Edge e : f.edges) {
                double phi_val = crBasisValue(e, mid, f);  // CR 基函数在中点值
                X0[e] += (len / area(f)) * n * phi_val;
            }
        }
    }
    return X0;
}

// Algorithm 2 (Paper Equation 12): 向量热扩散主求解
Vector<complex<double>> solveVectorHeatFlow(
    const Vector<complex<double>>& X0,
    SimplicialLDLT<...>& precomputed_solver   // 复用预分解器
) {
    // 单次前代/回代：O(n) 时间
    return precomputed_solver.solve(X0);  // 解: X_t ∈ C^{|E|}
}

// ---------------------------------------------------------------------------
// STEP II: 归一化（逐元素操作，完全可并行）
// ---------------------------------------------------------------------------

// Algorithm 3 (Paper Section 3.1): 面内平均 + 归一化
MatrixXd normalizeToFaces(const Mesh& M, const Vector<complex<double>>& X_t) {
    MatrixXd Y(M.F, 3);  // |F| x 3 实数矩阵
    
    for (Face f : M.faces) {
        Vector3d avg = Vector3d::Zero();
        for (Edge e : f.edges) {
            // 将复数 X_t[e] 解码为面 f 上的 3D 向量
            Vector3d tangent = edgeDirection(e, f);       // 沿边方向
            Vector3d normal = perpToFace(tangent, f);      // 垂直于边（在切平面内）
            Vector3d X_3d = X_t[e].real() * tangent + X_t[e].imag() * normal;
            avg += X_3d;
        }
        avg /= 3.0;
        Y.row(f.index) = avg.normalized();  // ||Y|| = 1，即近似距离梯度
    }
    return Y;
}

// ---------------------------------------------------------------------------
// STEP III: Poisson 求解（RUNTIME，复用预分解器）
// ---------------------------------------------------------------------------

// Algorithm 8 (Paper Section 5.5): 离散散度
Vector<double> computeDivergence(const Mesh& M, const MatrixXd& Y) {
    Vector<double> b(M.V);
    b.setZero();
    
    for (Vertex v : M.vertices) {
        for (Face f : v.faces) {
            Halfedge h_ij = halfedgeFrom(v, f);
            Halfedge h_ki = h_ij.prev();
            
            // 公式: 0.5 * (cot(θ_k) * e_ij + cot(θ_j) * e_ki) · Y_f
            double cot_k = cot(angle_opposite(h_ij, f));
            double cot_j = cot(angle_opposite(h_ki, f));
            Vector3d e_ij = edgeVector(h_ij);
            Vector3d e_ki = edgeVector(h_ki);
            
            b[v] += 0.5 * (cot_k * e_ij + cot_j * e_ki).dot(Y.row(f.index));
        }
    }
    return b;
}

// Algorithm 4 (Paper Equation 13): Poisson 主求解
Vector<double> solvePoisson(
    const Vector<double>& b,
    SimplicialLDLT<SparseMatrix<double>>& precomputed_solver
) {
    // 单次前代/回代：O(n) 时间
    Vector<double> phi = precomputed_solver.solve(b);
    
    // 处理零空间：将源曲线上的平均值归零（Algorithm 13）
    phi = shiftZeroLevelset(phi, Omega, M);
    return phi;  // 解: φ ∈ R^{|V|}
}

// ---------------------------------------------------------------------------
// 主入口（Algorithm 1）
// ---------------------------------------------------------------------------
Vector<double> computeSignedDistance(
    const Mesh& M, const Curves& Omega, double t,
    const SimplicialLDLT<...>& heat_solver,    // 预分解的 (M + t*L_∇)
    const SimplicialLDLT<...>& poisson_solver   // 预分解的 C
) {
    // Step I
    Vector<complex<double>> X0 = buildSourceTerm(M, Omega);
    Vector<complex<double>> X_t = heat_solver.solve(X0);
    
    // Step II
    MatrixXd Y_t = normalizeToFaces(M, X_t);
    
    // Step III
    Vector<double> b = computeDivergence(M, Y_t);
    Vector<double> phi = poisson_solver.solve(b);
    phi = shiftZeroLevelset(phi, Omega, M);
    
    return phi;  // 广义 SDF，存储在每个顶点上
}
```
## 5. 2D SDF：Methods
工业界生成二维 SDF是一个老生畅谈的话题；主要用于处理的是**规则像素网格上的二值/灰度图**，后者处理的是**三角网格上的几何曲线**。理解前者的方法演进，有助于更清晰地定位 SHM 填补了哪块空白。
问题如下：
给定一张 $W \times H$ 的二值图像（白色=前景=外部，黑色=背景=内部），求每个像素到最近边界的**有符号**欧氏距离。正号表示在前景区域外部，负号表示在背景区域内部。
### 5.1 暴力法：四重循环的 $O(n^4)$ 实现
暴力法的思路极其直接：对每个像素 $(x, y)$，遍历图像中**所有**其他像素 $(x_1, y_1)$，计算欧氏距离 $\sqrt{(x-x_1)^2 + (y-y_1)^2}$，维护最小值。由于需要分别计算"到最近前景点的距离"和"到最近背景点的距离"两套场，最终 SDF = 背景距离场 - 前景距离场。
#### 5.1.1 复杂度推导

设图像分辨率为 $n \times n$（$n = \max(W, H)$）：

- **外层循环**：遍历所有 $n^2$ 个像素
- **内层循环**：对每个像素，遍历所有 $n^2$ 个像素求最近距离
- **距离计算**：每次计算一次 `sqrt`
时间复杂度：
$$T(n) = n^2 \times n^2 \times O(1) = O(n^4)$$
空间复杂度：需要存储两套距离场 + 最终 SDF，即 $O(n^2)$。
以 $n = 100$ 为例，总操作数约 $10^8$ 次——在 Python 中需要数十秒，即使 C++ 优化后也难以处理 $n > 200$ 的图像。这意味着**一张 512x512 的纹理烘焙需要数小时**，完全无法满足大批量的需求
#### 5.1.2 优化：降采样暴力法
一种工程妥协是：假设源纹理为 $2000 \times 2000$，将其压缩到 $500 \times 500$ 的目标纹理。然后扫描一遍原始纹理，找到对应的目标像素，将点分为 inside/outside 两类，对每个点求最近的异类点的距离。这种方案将复杂度从 $O(N^4)$ 降低到 $O(N_{source}^2 \times N_{target})$，但仍远高于线性时间方法。

### 5.2 Saito 算法：行列分解的 EDT（$O(n^3)$）

Saito 算法（1994）的核心洞察来自一个数学事实：**二维欧氏距离变换可以分解为两次一维距离变换**。具体来说，对于图像中的点 $(x, y)$ 到最近特征点的距离 $d(x, y)$，有：
$$d(x, y) = \min_{x'} \left[ (x - x')^2 + g(x', y)^2 \right]$$
其中 $g(x', y) = \min_{y'} |y - y'|$ 是在列 $x'$ 上到最近特征点的纵向距离。也就是说：

1. **第一步（纵向）**：对每一列 $x'$，做一次一维距离变换，得到 $g(x', y)$
2. **第二步（横向）**：对每一行 $y$，利用上一步的结果，求解 $\min_{x'} \left[ (x - x')^2 + g(x', y)^2 \right]$

第二步本质上是在每行上求一组抛物线 $f_{x'}(x) = (x - x')^2 + g(x', y)^2$ 的下包络。对于 $n$ 个抛物线，下包络可以在 $O(n)$ 时间内通过单调栈求得。
#### 5.2.1 复杂度推导

- 第一步：$n$ 列，每列 $O(n)$ → $O(n^2)$
- 第二步：$n$ 行，每行需要对 $n$ 个抛物线求下包络 →  naive 实现 $O(n^3)$，优化后 $O(n^2)$

Saito 原始实现的时间复杂度为 **$O(n^3)$**，因为第二步的抛物线下包络求解没有充分优化。后续改进（如 Meijster 1999）将整体优化到 $O(n^2)$，但这已经属于 8SSEDT 的范畴。
### 5.3 8SSEDT：两遍扫描动态规划（$O(n^2)$）

8SSEDT（8-Signed Sequential Euclidean Distance Transform）由 Felzenszwalb 和 Huttenlocher 在 2012 年提出，是当前 2D 图像 SDF 生成的**工业界金标准**。它的核心思想同样基于抛物线下包络，但通过精心设计的两遍扫描顺序，将问题转化为局部邻居比较，实现真正的线性时间。
#### 5.3.1 核心数据结构

8SSEDT 维护一个与图像同尺寸的网格，每个像素存储的不是距离值，而是到最近特征点的**偏移向量** $(dx, dy)$。初始时：

- **前景网格（grid1）**：前景像素（白色）设为 $(0, 0)$，背景像素设为一个极大值偏移（如 $(9999, 9999)$）
- **背景网格（grid2）**：与 grid1 相反

最终 SDF = $\sqrt{dx_1^2 + dy_1^2} - \sqrt{dx_2^2 + dy_2^2}$，其中 $(dx_1, dy_1)$ 来自前景网格，$(dx_2, dy_2)$ 来自背景网格。
#### 5.3.2 两遍扫描流程

**Pass 0（左上到右下扫描）**：

```
for y = 0 to H-1:
    for x = 0 to W-1:
        Compare 当前点 with (x-1, y), (x, y-1), (x-1, y-1), (x+1, y-1)
        如果邻居的偏移 + 邻居到当前的偏移 < 当前的偏移，则替换
    for x = W-1 downto 0:
        Compare 当前点 with (x+1, y)
        同样的替换逻辑
```

**Pass 1（右下到左上扫描）**：

```
for y = H-1 downto 0:
    for x = W-1 downto 0:
        Compare 当前点 with (x+1, y), (x, y+1), (x-1, y+1), (x+1, y+1)
    for x = 0 to W-1:
        Compare 当前点 with (x-1, y)
```

`Compare` 操作的本质是：查看邻居的偏移值，加上从邻居到当前点的方向偏移，如果得到的距离平方更小，就用这个新的偏移替换当前值。这种"信息传播"机制确保每个像素最终获得到全局最近特征点的正确偏移。
>这里参考了大佬的一些idea，参照：
>[记一次代码优化(C++) - 简书](https://www.jianshu.com/p/58271568781d)
>[(18 封私信) Tech-Artist 学习笔记：Signed Distance Field 8SSEDT 算法 - 知乎](https://zhuanlan.zhihu.com/p/518292475)
#### 5.3.3 复杂度推导

- **Pass 0**：每个像素最多与 5 个邻居比较（4个正向 + 1个反向），每步 $O(1)$ → $O(n^2)$
- **Pass 1**：同上 → $O(n^2)$
- **总时间**：$O(n^2)$ + $O(n^2)$ = **$O(n^2)$**
- **空间**：两套偏移网格 → **$O(n^2)$**

与暴力法的 $O(n^4)$ 相比，8SSEDT 在 $n = 1000$ 时快约 **$10^6$ 倍**。这是从 $O(n^4) \to O(n^3) \to O(n^2)$ 复杂度递降的最后一步，也是 2D 图像域的理论下界——因为输出本身就是 $O(n^2)$ 的数据量，任何算法都不可能低于线性于像素数的复杂度。
### 5.4 传统方法与 SHM 的对比

| 维度 | 暴力法 | Saito EDT | 8SSEDT | SHM |
| :--- | :--- | :--- | :--- | :--- |
| **数据域** | 2D 规则网格 | 2D 规则网格 | 2D 规则网格 | **任意离散化**（三角网格/tet/点云/规则网格） |
| **输入要求** | 二值图 | 二值图 | 二值图 | **破损/非流形/任意曲线**均可 |
| **时间复杂度** | $O(n^4)$ | $O(n^3)$ | **$O(n^2)$** | **$O(n)$** per query（预分解后） |
| **首次运行** | $O(n^4)$ | $O(n^3)$ | $O(n^2)$ | $O(n^{1.5})$（Cholesky 预分解） |
| **符号输出** | 有（两套场相减） | 有 | 有 | **有（本质输出，无需 trick）** |
| **曲面条域支持** | 无 | 无 | 无 | **有（测地距离）** |
| **预分解复用** | 无 | 无 | 无 | **有（源几何变化时矩阵不变）** |
| **工业应用** | 教学/调试 | 历史参考 | **字体 SDF 烘焙、2D 游戏** | **3D 打印、物理引擎、VFX** |

结论上讲：**8SSEDT对于2d效果大部分情况下更优**。8SSEDT 是 2D 规则网格上的最优解，简洁、快速、易于实现（核心代码不到 100 行），是字体 SDF 烘焙和 2D 游戏开发的标准选择。但它无法处理 3D 几何、曲面、破损输入。SHM 则填补了"任意离散化 + 破损几何 + 有符号输出"这块空白，代价是需要线性代数库（Eigen）和更复杂的离散化基础设施。
![各算法复杂度对比](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/20260702152926714.png)
上图展示了各算法复杂度随分辨率的增长曲线。在 $n < 100$ 时所有算法都可接受，但当 $n$ 进入 1024+ 的生产级分辨率时，$O(n^4)$ 和 $O(n^3)$ 的曲线呈指数级分离，$O(n^2)$ 的 8SSEDT 成为 2D 域唯一可行的选择。
### 5.5 根据情景的不同方案
![方案选择](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/20260702152913320.png)
## 6. Comparing with existing method

### 6.1 对比维度总览

工业界可用的 SDF 计算方法可以按**数据域**和**计算范式**分为几大类：

| 算法 | 数据域 | 计算范式 | 时间复杂度 | 输入要求 | 符号输出 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **暴力法** | 2D 规则网格 | 四重循环 | $O(n^4)$ | 二值图 | 有 |
| **8SSEDT** | 2D 规则网格 | 动态规划（两遍扫描） | $O(n^2)$  [(Department of Computer Science)](https://www.cs.cornell.edu/people/dph/papers/dt.pdf)  | 二值图（watertight） | 有（两次 pass） |
| **JFA** | 2D/3D 规则网格 | GPU 并行跳跃传播 | $O(N \log L)$  [(ar5iv)](https://ar5iv.labs.arxiv.org/html/2210.06160)  | 种子点/体素化网格 | 无（需 trick） |
| **Fast Marching** | 曲面/体积网格 | 波前优先队列推进 | $O(n \log n)$  [(Georg-August Universität Göttingen)](https://ddg.math.uni-goettingen.de/pub/GeodesicsInHeat.pdf)  | watertight 流形 | 有 |
| **SHM (本文)** | 曲面/体积/任意离散 | 稀疏线性系统求解 | $O(n)$ per query | **破损/非流形均可** | **有（本质输出）** |

### 6.2 概览
- **暴力法**在 2D 图像域是最朴素的方法。四重循环的结构极其简单，适合教学演示和算法正确性验证。但 $O(n^4)$ 的复杂度使其无法用于任何生产场景。一种工程妥协是降采样——将高分辨率源图压缩到低分辨率目标图上做暴力计算，但这本质上是牺牲精度换速度，与算法改进无关。
- **8SSEDT** 是 2D 库备份天涯的差别方法与成功处理。它基于一个优雅的洞察：二维欧氏距离变换可以通过两遍局部扫描和抛物线下包络来求解。算法全程使用整数运算（直到最后一步才开方），实现极为简洁（核心代码不到 100 行），在 $1024 \times 1024$ 图像上仅需 **~1ms**。但它的限制也同样明确：只能处理**二值图**，无法处理灰度或曲面上的源；严格限定在**2D 规则网格**上，无法推广到曲面或三维。在游戏引擎中，8SSEDT 常用于字体 SDF 烘焙（Valve 的原始方案），但面对从 3D 模型投影或手绘的不闭合曲线时束手无策。
- **JFA (Jump Flooding Algorithm)** 是 GPU 时代最成功的近似 SDF 算法。它的核心思想是让每个像素通过"跳跃"查询 progressively 发现最近的种子点——步长从图像边长的一半开始，每次减半，$\log L$ 轮迭代后收敛。由于每轮中所有像素独立更新，JFA 天然适合 GPU 并行，在 Compute Shader 中实现非常直接。RTSDF 论文报告 $256^3$ 体积在 **~30ms** 内完成  [(ar5iv)](https://ar5iv.labs.arxiv.org/html/2210.06160) 。但 JFA 是**近似算法**，在几何边界附近会产生 Voronoi 图风格的 artifacts；它只输出**无符号距离**，符号需要通过"将所有值减去一个小量 $\beta$"这种 trick 获得，这实际上是把表面增厚而非真正判断内外；最重要的是，JFA 同样要求输入是**闭合的 watertight 种子集**——破损几何上的跳跃传播会导致符号错误扩散。
- **Fast Marching** 是曲面测地距离的经典算法。它模拟波前从源点向外传播，用优先队列维护当前波前的"前沿"，每次取出距离最小的点进行局部更新。FMM 在 watertight 流形上非常精确，但与 SHM 相比有三个致命劣势：第一，**无法预分解**——每次源点集变化都要重新跑完整遍算法；第二，**$O(n \log n)$ 的优先队列开销**使得它在现代 CPU 上显著慢于预分解后的热方法——Crane 2013 表 1 显示在 100k 顶点模型上 FMM 耗时 4.5s，而预分解后的 Heat Method 仅 0.06s，加速比达 **75x**  [(Georg-August Universität Göttingen)](https://ddg.math.uni-goettingen.de/pub/GeodesicsInHeat.pdf) ；第三，**对破损输入完全失效**——波前遇到缺口时会"泄漏"，导致整个距离场错误。
### 6.3 What can SHM do

论文中的性能数据（图 24，Apple M1，~100k faces 高质量网格）提供了直接的定量对比：

| 方法 | 时间 | 平均 L2 误差 | 备注 |
| :--- | :--- | :--- | :--- |
| SHM (ours) | **0.37s** | **0.14%** | 破损输入仍可用 |
| UHM | 0.27s | 0.38% | 仅处理 watertight 点源 |
| BF (ADMM) | 1.89s | 0.13% | 仅处理 watertight，无符号输出 |

SHM 的误差（0.14%）优于 UHM（0.38%），接近 BF（0.13%），但速度比 BF **快 5 倍**。在低质量网格上，SHM（0.83s）仍优于 UHM（0.59s）和 ADMM-BF（0.70s）的折中表现。
更关键的对比来自 Crane 2013 的表 1（Heat Method 奠基论文）。预分解后的 Heat Method（SHM 继承同一框架）与 Fast Marching 的实测对比如下：

| 模型 | 顶点数 | Heat Method (预分解后) | Fast Marching | 加速比 |
| :--- | :--- | :--- | :--- | :--- |
| femur | 4.6k | **0.004s** | 0.04s | **10x** |
| kitten | 11k | **0.01s** | 0.29s | **29x** |
| bunny | 34k | **0.02s** | 1.20s | **60x** |
| tyra | 100k | **0.06s** | 4.50s | **75x** |

数据来源：Crane et al. 2013 "Geodesics in Heat" Table 1  [(Georg-August Universität Göttingen)](https://ddg.math.uni-goettingen.de/pub/GeodesicsInHeat.pdf) 。加速比随网格规模增大而增加，因为 FMM 的 $O(n \log n)$ 优先队列开销随规模恶化，而预分解后的线性求解保持 $O(n)$。
>在后续提供的showcasedemo中我们提供了这些模型供给测试。

![性能对比](https://kiiyeblog.oss-cn-beijing.aliyuncs.com/20260702153001653.png)
上图左半部分直接复现 SHM 论文图 24 的实测数据（Apple M1，~100k faces），右半部分复现 Crane 2013 表 1 的跨模型对比。这两组数据共同说明：**基于稀疏线性系统的热方法家族在预分解后，在速度和精度上都优于传统波前方法**。

SHM 在此基础上进一步扩展了热方法的适用范围——从 watertight 点源到破损曲线/曲面，从标量扩散到向量扩散——同时保持了同一量级的性能。
## 7. Open-Source Commitments

官方仓库提供了一些对应的paper实现，包括2/3d的demo，简要的tour一下得到以下的一些结果：

| 维度 | 仓库地址 | 说明 |
| :--- | :--- | :--- |
| 2D 曲面域 (C++) | [github.com/nzfeng/signed-heat-demo](https://github.com/nzfeng/signed-heat-demo) | 基于 geometry-central 的完整 Demo，含 GUI (Polyscope)  [(Github)](https://github.com/nzfeng/signed-heat-demo)  |
| 3D 体积域 (C++) | [github.com/nzfeng/signed-heat-demo-3d](https://github.com/nzfeng/signed-heat-demo-3d) | 支持 tet mesh 和 regular grid  [(Github)](https://github.com/nzfeng/signed-heat-demo-3d)  |
| 核心算法库 | [geometry-central.net](https://geometry-central.net/surface/algorithms/signed_heat_method/) | 生产级实现，`SignedHeatSolver` 类  [(geometry-central.net)](https://geometry-central.net/surface/algorithms/signed_heat_method/)  |
| Python 绑定 | `pip install potpourri3d` | geometry-central 的 Python 封装 |
| 3D C++ 库 | `pip install signedheat3d` | 独立 3D 实现  [(nzfeng.github.io)](https://nzfeng.github.io/signed-heat-docs/)  |

**核心类与函数映射指南：**

| 论文中的数学/算法部分 | 对应源码位置 |
| :--- | :--- |
| Section 5.4 Connection Laplacian 构建 | `geometrycentral::surface::SignedHeatSolver` (内部私有) |
| Algorithm 1 主流程 | `SignedHeatSolver::computeDistance()` / `computeSignedDistance()`  [(geometry-central.net)](https://geometry-central.net/surface/algorithms/signed_heat_method/)  |
| Algorithm 7 Cotan Laplacian | `geometrycentral::surface::CotanLaplacian()` |
| Algorithm 8 散度计算 | `SignedHeatSolver::computeDivergence()` |
| Algorithm 11 源项构建 | `SignedHeatSolver::buildSourceTerm()` |
| Section 7.1 零等值面约束 | `SignedHeatOptions::levelSetConstraint = LevelSetConstraint::ZeroSet` |
| Section 7.1 多 Level Set 约束 | `LevelSetConstraint::Multiple` |

**一些可能的问题 (Engineering Pitfalls)：**

| 陷阱                           | 具体表现                                                     | 可能的规避手段？                                                                                                                     |
| :--------------------------- | :------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **Null Space 未处理**           | Cotan Laplacian 半正定，零空间为常数函数，直接求解会得到歧义解                  | 预分解时识别零空间方向，求解后执行 `Shift(phi, Omega)` 将源曲线上的平均值归零（Algorithm 13）                                                              |
| **数值奇异：$\|X_t\| \approx 0$** | 远离源曲线的区域扩散后向量模长指数衰减，归一化时除以零                              | 对 $Y_t = X_t / \|X_t\|$ 添加 epsilon 保护，或提前检测远场区域用默认值填充                                                                        |
| **边索引不一致**                   | geometry-central 的边索引可能与外部工具（Blender、libigl）不同，导致源曲线映射错位 | 统一使用 halfedge mesh 数据结构的索引约定；输入源曲线时使用 barycentric coordinates 而非原始索引  [(Github)](https://github.com/nzfeng/signed-heat-demo) |
| **非流形网格的联络定义**               | Connection Laplacian 要求切平面定义，非流形顶点处切空间不唯一                | 采用 intrinsic Delaunay triangulation 预处理，将非流形特征局部隔离；或退化到逐面处理                                                                  |
| **扩散时间 $t$ 选择**              | $t$ 过小（$\ll h^2$）会退化为图距离，过大（$\gg h^2$）会过度平滑              | 经验值 $t = h^2$ 在绝大多数场景下最优；提供用户可调参数用于控制形态学操作的圆滑程度（类似 SVG 的 line-join 选项）                                                       |

## 8. Implementation: From Paper to Product

SHM 的独立工程化复现将论文算法从 Python 原型落地为可独立分发的 Windows 桌面应用 `SignedHeatSDFBaker`，支持 2D 图像与 3D 网格/点云输入，产出游戏引擎可直接载入的体积纹理（DDS/KTX）。以下记录复现过程中的关键工程决策与性能瓶颈突破。

### 8.1 项目架构总览

仓库整体结构分为两条线：Python 算法原型（`paper_industry/`）用于算法验证与对比图表生成；C++ 正式发布产品（`SignedHeatSDFBaker/`）包含完整的 GUI + CLI 管线。C++ 端按 CMake 依赖拓扑构建：`math → utils → io → core → gpu → app`。

| 模块           | 职责                                          | 关键依赖                     |
| :----------- | :------------------------------------------ | :----------------------- |
| `shb_math`   | Vec2/Vec3、SparseMatrix 封装、线性求解器             | Eigen                    |
| `shb_core`   | 2D SDF 引擎（4 种算法）+ 3D 网格工具 + Marching Cubes  | Eigen, tinyobjloader     |
| `shb_yukawa` | GPU 加速 Yukawa 卷积（Vulkan compute）+ CPU 多线程回退 | Vulkan                   |
| `shb_io`     | PNG/JPG/BMP/TGA 读写、SDF 导出（DDS/KTX/mip）      | stb_image, nlohmann-json |
| `app`        | Vulkan + ImGui + GLFW GUI + 三个 CLI 后端入口     | 全部上游 + signed-heat-3d    |

### 8.2 2D 算法复现与交叉验证

2D 域实现了四种算法，全部直接链接进 GUI 下拉菜单：

| 算法 | 复杂度 | 角色 | 与论文的映射关系 |
| :--- | :--- | :--- | :--- |
| Brute Force EDT | $O(n^4)$ | 教学基准 / 正确性校验 | 四重循环，验证其他算法输出 |
| Meijster EDT | $O(n^2)$ | 参考真值 | 两次 1D 抛物线下包络扫描 |
| **8SSEDT** | $O(n^2)$，常数极小 | **生产级默认 2D SDF** | 两遍扫描动态规划，整数偏移网格 |
| **SHM 2D** | 两次稀疏 Cholesky | **破损/开口曲线鲁棒场** | 严格映射论文 Algorithm 1 |

SHM 2D 的复现将曲面域的 Connection Laplacian 退化为平面上的逐分量标量扩散——Step I 对法向量的 x/y 分量各解一次 $(I + t\Delta)X = N$（扩散时间 $t = m \cdot h^2$），Step II 逐像素归一化，Step III 泊松积分 + ZeroSet 硬约束或事后平移修复。与 8SSEDT 的符号一致性在完好闭合形状上 **>95%**，在破损形状上 SHM 展现出独有的**间隙桥接能力**（8SSEDT 对开口曲线无定义）。

### 8.3 3D 核心管线

3D 端包装 `nzfeng/signed-heat-3d` 的 `SignedHeatGridSolver`，完整执行热方法三步管线。落地过程中遇到两个核心性能瓶颈，分别通过算法层面的重新设计解决。

#### 8.3.1 Step 1&2 — Yukawa 卷积：从 $O(N \times S)$ 到 GPU Compute

论文参考实现对每个体素节点遍历全部面片源，以 $64^3$ 分辨率、3000 面片为例，内循环约 $2.6 \times 10^5 \times 3000 \approx 7.9 \times 10^8$ 次迭代，单线程 CPU 性能不可接受。

最终方案采用 **GPU Vulkan headless compute + 空间哈希 binning**：

- 利用 $\exp(-\lambda R)$ 的指数衰减特性，算得安全截断半径 $R = -\ln(\varepsilon) / \lambda$（取 $\varepsilon = 10^{-9}$，远低于 float32 精度）
- 源面片被哈希到边长为 $R$ 的均匀空间网格，每个节点只需查询其邻域 $3 \times 3 \times 3$ 个格子中的源，遍历源数从 **~3000 降至个位数**
- 每个网格节点分配一个 compute shader 线程，shader 内 Kahan 补偿求和保证 fp32 累加精度与 double CPU 一致
- GPU 初始化失败（无兼容设备 / 显存不足 / 管线创建失败）**自动回退**到 CPU 多线程路径（同一份 binning 数据复用）

SPIR-V 字节码在构建时由 CMake 调用 `glslangValidator` 编译并嵌入为 C `unsigned char[]`，运行时零外部文件依赖。

#### 8.3.2 Step 3 — 梯度积分

Step 3 的任务是从归一化向量场 $Y(p)$ 积分出标量距离场 $\phi(p)$，满足 $\nabla\phi \approx Y$。论文将其转化为求解带 level-set 约束（源几何上 $\phi = 0$）的 KKT 鞍点系统，直接使用论文中的效果实现时，我们发现一些在计算时候的问题

| 分辨率 | 未知量 | v1.0.0 KKT + LU | 结果 |
| :--- | :--- | :--- | :--- |
| $32^3$ | ~3.3×10⁴ | ~6.2s | 可用 |
| $64^3$ | ~2.6×10⁵ | **>120s（卡死）** | **fill-in 爆炸** |
关键洞察来自求解器末尾的 shift 步骤：
```cpp
double shift = evaluateAverageAlongSourceGeometry(mesh, phi);
phi -= shift * Vector::Ones(totalNodes);
```
该 shift 操作将 $\phi$ 沿源几何的加权均值平移至零——即 level-set 约束 $\phi = 0$ 在事后被重新建立。因此 KKT 系统内的 $A \cdot \phi = 0$ 硬约束本质上是冗余的：去掉后不影响最终输出的零等值面位置。这使得问题从"解一个带约束的不定鞍点系统"降级为"解一个对称正定的无约束泊松系统"：
```cpp
SparseMatrix<double> SPD = -laplaceMat;  // L 负定，取负得 SPD
Eigen::ConjugateGradient<SparseMatrix<double>> cg;
cg.setTolerance(1e-6);
cg.setMaxIterations(10000);
cg.compute(SPD);
Vector<double> phi = cg.solve(divYt);     // 直接用 CG
```

矩阵 $-L$ 是 7 点差分网格拉普拉斯取负，为对称正定。每次 CG 迭代是一次 $O(N)$ 的稀疏矩阵向量乘，总体收敛接近 $O(N)$。$64^3$ 实测 **≈1.3s**，并且能保证差不多的精度。
### 8.5 优化方法论总结

| 瓶颈                 | 原始原因                        | 最终方案                                    | idea                                            |
| :----------------- | :-------------------------- | :-------------------------------------- | :---------------------------------------------- |
| Step 1&2 Yukawa 卷积 | $O(N \times S)$ 单线程稠密卷积     | GPU compute（空间哈希截断 + binning）+ CPU 自动回退 | **计算密度高 + SIMD** → GPU 计算的自然优势；截断半径借助物理衰减保证精度无损 |
| Step 3 梯度积分        | KKT 鞍点 LU 分解 fill-in 爆炸     | CG 解无约束泊松方程（去掉冗余约束）                     | **先质疑问题约束，再选工具**——模型层面的简化比堆砌更强求解器更便宜、更可靠        |
| 重复构建依赖             | 手动装 vcpkg + booster + AMGCL | FetchContent 自动拉取 + 零外部依赖的 CG           | **降低工程门槛**——让 CMake 在首次 configure 时自动完成全部依赖获取   |

## 9. Paper & Talk

| 资源类型 | 链接 |
| :--- | :--- |
| **Paper PDF** | [https://nzfeng.github.io/research/SignedHeatMethod/SignedDistance.pdf](https://nzfeng.github.io/research/SignedHeatMethod/SignedDistance.pdf)  [(nzfeng.github.io)](https://nzfeng.github.io/research/SignedHeatMethod/SignedDistance.pdf)  |
| **Project Page** | [https://nzfeng.github.io/research/SignedHeatMethod/](https://nzfeng.github.io/research/SignedHeatMethod/) |
| **SIGGRAPH 2024 Slides** | [https://nzfeng.github.io/research/SignedHeatMethod/SIGGRAPHSlidesReducedSize.pdf](https://nzfeng.github.io/research/SignedHeatMethod/SIGGRAPHSlidesReducedSize.pdf)  [(nzfeng.github.io)](https://nzfeng.github.io/research/SignedHeatMethod/SIGGRAPHSlidesReducedSize.pdf)  |
| **Introductory Talk (10 min)** | 见项目页面 embedded video |
| **2D Demo Repository** | [https://github.com/nzfeng/signed-heat-demo](https://github.com/nzfeng/signed-heat-demo)  [(Github)](https://github.com/nzfeng/signed-heat-demo)  |
| **3D Demo Repository** | [https://github.com/nzfeng/signed-heat-demo-3d](https://github.com/nzfeng/signed-heat-demo-3d)  [(Github)](https://github.com/nzfeng/signed-heat-demo-3d)  |
| **3D C++ Documentation** | [https://nzfeng.github.io/signed-heat-docs/](https://nzfeng.github.io/signed-heat-docs/)  [(nzfeng.github.io)](https://nzfeng.github.io/signed-heat-docs/)  |
| **geometry-central API** | [https://geometry-central.net/surface/algorithms/signed_heat_method/](https://geometry-central.net/surface/algorithms/signed_heat_method/)  [(geometry-central.net)](https://geometry-central.net/surface/algorithms/signed_heat_method/)  |

## 10. References

1. **Keenan Crane, Clarisse Weischedel, and Max Wardetzky.** "Geodesics in heat: A new approach to computing distance based on heat flow." *ACM Transactions on Graphics (TOG)*, 32(5), 2013. [https://doi.org/10.1145/2516971.2516977](https://doi.org/10.1145/2516971.2516977) — 热方法的奠基论文，SHM 直接继承其标量扩散+泊松积分的两步框架  [(Georg-August Universität Göttingen)](https://ddg.math.uni-goettingen.de/pub/GeodesicsInHeat.pdf) 。

2. **Nicholas Sharp, Yousuf Soliman, and Keenan Crane.** "The Vector Heat Method." *ACM Transactions on Graphics (TOG)*, 38(3), 2019. — 向量热方法，提出 Connection Laplacian 和平行传输的离散化，SHM 的 Step I 直接复用其离散算子。

3. **Nicole Feng, Mark Gillespie, and Keenan Crane.** "Winding Numbers on Discrete Surfaces." *ACM Transactions on Graphics (TOG)*, 42(4), 2023. — GWN 在离散曲面上的推广，SHM 论文中多次对比的 baseline。SHM 在 inside/outside 分类上比 GWN 更鲁棒，且额外提供距离信息  [(ResearchGate)](https://www.researchgate.net/publication/372676612_Winding_Numbers_on_Discrete_Surfaces) 。

4. **Alec Jacobson, Ladislav Kavan, and Olga Sorkine-Hornung.** "Robust Inside-Outside Segmentation using Generalized Winding Numbers." *ACM Transactions on Graphics (TOG)*, 32(4), 2013. — GWN 的原始论文，工业界广泛使用的 inside/outside 测试方法，但不提供距离值。

5. **Pedro F. Felzenszwalb and Daniel P. Huttenlocher.** "Distance Transforms of Sampled Functions." *Theory of Computing*, 8(19), 2012. — 8SSEDT 的原始论文，线性时间精确欧氏距离变换的奠基工作  [(Department of Computer Science)](https://www.cs.cornell.edu/people/dph/papers/dt.pdf) 。

6. **Guodong Rong and Tiow-Seng Tan.** "Jump Flooding in GPU with Applications to Voronoi Diagram and Distance Transform." *I3D*, 2006. — JFA 的原始论文，GPU 上快速近似距离场的经典方法。
## 11. 后记
可能会考虑做一个unity的插件唤起并自动烘焙，目前来看还是有挺明显的一些点没有考虑清楚，用ai总结了一部分，但是我觉得需要更严谨的思考 欢迎大佬们批评指正。

开源地址：[kiiye9697/SDF-Generator: 基于Signed Heat Method（Feng & Crane, SIGGRAPH 2024）——一种基于 PDE 扩散的有符号距离场（SDF）算法——从 Python 算法验证原型，落地为可独立分发的 Windows 桌面应用。支持 2D 图像与 3D 网格/点云输入，产出游戏引擎可直接载入的 体积纹理（DDS/KTX）](https://github.com/kiiye9697/SDF-Generator)
