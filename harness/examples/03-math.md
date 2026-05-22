# Mathematics & Equations

This example showcases inline and display math rendered via **KaTeX**. KaTeX
loads lazily — it is only fetched when `enable_math` is on **and** the
document actually contains `$...$` or `$$...$$` delimiters. So pages without
math stay fast.

## Inline math

The Pythagorean theorem states that $a^2 + b^2 = c^2$ for any right triangle.
Mass-energy equivalence is $E = mc^2$. The standard normal density is
$\phi(x) = \frac{1}{\sqrt{2\pi}} e^{-x^2/2}$, and Euler's identity ties together
five fundamental constants in $e^{i\pi} + 1 = 0$.

## Display math

The Riemann zeta function is defined by:

$$
\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^s} = \prod_{p \text{ prime}} \frac{1}{1 - p^{-s}}
$$

The Cauchy–Schwarz inequality, in its most general form:

$$
\left( \sum_{i=1}^n a_i b_i \right)^2 \leq \left( \sum_{i=1}^n a_i^2 \right) \left( \sum_{i=1}^n b_i^2 \right)
$$

## Aligned equations

$$
\begin{aligned}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} \\
\nabla \cdot \mathbf{B} &= 0 \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}
\end{aligned}
$$

These are **Maxwell's equations** in their differential form — the foundation
of classical electromagnetism.

## Matrices

A general $3 \times 3$ rotation matrix around the $z$ axis:

$$
R_z(\theta) =
\begin{pmatrix}
\cos\theta & -\sin\theta & 0 \\
\sin\theta & \cos\theta & 0 \\
0 & 0 & 1
\end{pmatrix}
$$

The $2 \times 2$ Pauli matrices that appear throughout quantum mechanics:

$$
\sigma_1 = \begin{pmatrix} 0 & 1 \\ 1 & 0 \end{pmatrix}, \quad
\sigma_2 = \begin{pmatrix} 0 & -i \\ i & 0 \end{pmatrix}, \quad
\sigma_3 = \begin{pmatrix} 1 & 0 \\ 0 & -1 \end{pmatrix}
$$

## Calculus

The fundamental theorem of calculus:

$$
\int_a^b f'(x) \, dx = f(b) - f(a)
$$

A common Gaussian integral:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

The gradient descent update rule, the heart of machine learning:

$$
\theta_{t+1} = \theta_t - \eta \nabla_\theta J(\theta_t)
$$

where $\eta$ is the learning rate and $J(\theta)$ is the loss function.

## Probability

Bayes' rule, written compactly:

$$
P(A \mid B) = \frac{P(B \mid A) \, P(A)}{P(B)}
$$

The expectation of a continuous random variable:

$$
\mathbb{E}[X] = \int_{-\infty}^{\infty} x \, f_X(x) \, dx
$$

Variance and its computational form:

$$
\operatorname{Var}(X) = \mathbb{E}[X^2] - \mathbb{E}[X]^2
$$

## Machine learning

The softmax function used in classification heads:

$$
\operatorname{softmax}(z_i) = \frac{e^{z_i}}{\sum_{j=1}^{K} e^{z_j}}
$$

Cross-entropy loss for a true distribution $p$ and predicted $q$:

$$
H(p, q) = -\sum_{i} p_i \log q_i
$$

The self-attention mechanism that powers transformers:

$$
\operatorname{Attention}(Q, K, V) = \operatorname{softmax}\!\left(\frac{Q K^\top}{\sqrt{d_k}}\right) V
$$

## Limits and series

Euler's number, defined as a limit:

$$
e = \lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n
$$

The Taylor series for $e^x$ around 0:

$$
e^x = \sum_{n=0}^{\infty} \frac{x^n}{n!} = 1 + x + \frac{x^2}{2!} + \frac{x^3}{3!} + \cdots
$$

## Notes on rendering

KaTeX produces semantic HTML+CSS rather than image rasters, so the math
scrolls and selects naturally, scales with `font_size`, and prints cleanly.
Display math has its own horizontal scrollbar when it overflows on narrow
viewports, so long equations don't break the layout.
