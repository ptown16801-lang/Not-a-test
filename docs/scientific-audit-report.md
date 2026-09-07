# Publication-grade fidelity and scaling audit of the Shriki-Sadeh-Ward neural synaesthesia model

Independent Wolfram reconstruction, adversarial numerical validation, and a 2026 exact-model feasibility study

Audit date: 7 September 2026  
Project: `ptown16801-lang/Not-a-test`  
Scientific authority: the published target paper and supporting appendix, not the pre-existing project implementation

## Abstract

We independently reconstructed the recurrent information-maximization model used by Shriki, Sadeh, and Ward (2016), verified its matrix calculus in Wolfram Language, compared the independently derived result with the JavaScript and Wolfram implementations, and only then measured modern-compute execution. The reconstruction passed 28 of 28 publication-equation checks. Its recurrent objective gradient agreed with centered finite differences to a maximum absolute error of 3.18e-10; nine repeated Wolfram fixtures reached 7.85e-10 worst-case absolute error, six JavaScript fixtures reached 4.64e-10, and 31 of 31 Wolfram MUnit tests passed. The audit corrected a normalized population vector, an unconditional high-dimensional zero-diagonal constraint, an always-active derivative floor, changing validation ensembles, unstable normal-equation evaluation, and two matrix-free implementation defects.

The 142-output declared reconstruction completed 1,000 updates in 239.805 s (241.659 s including fixed validation) with a Linux peak resident set of 358.6 MB. A common 10-update factor-history window ran through 9,088 outputs; one- or two-update feasibility probes reached 72,704. These are different evidence classes. The larger models are a declared circular-grid project family because the publication specifies only 142 outputs. No controlled numeric speedup over the authors can be computed: their “couple of weeks” report lacks a matched update count, numerical policy, seed, checkpoint trajectory, and machine specification. No sustained large-model practical limit was measured.

A controlled near-critical construction exposed the principal scientific risk. At fixed-point Jacobian spectral radius 0.9999, the declared residual tolerance near 1e-9 required 129,683 Euler iterations but still produced a state error near 1e-5 and a recurrent-gradient relative Frobenius error of 0.62176. The exact-known-state analytical gradient remained accurate to 3.56e-16. Thus residual tolerance must become condition- and gradient-aware near criticality.

Deep review of primary numerical-analysis literature and official library documentation identifies factorization reuse, block right-hand sides, stable QR/SVD, FP64 GPU algebra, and distributed dense algebra as equation-preserving opportunities. Anderson acceleration, Krylov solves, warm starts, and mixed precision are only tolerance-equivalent and require explicit basin, conditioning, residual, and gradient-error gates. Sparsification, rank truncation, altered normalization, derivative floors, clipping, or changed learning rules change the scientific model and are excluded from the exact benchmark.

## 1. Research question and claim discipline

The research question is: how far can the original Shriki model be scaled with 2026 computing before mathematical scaling, rather than 2016 computational limitations, becomes dominant?

The word “original” requires a strict evidence hierarchy. The target article and its S1 Appendix are authoritative for the reported experiment [1,2]. The foundational recurrent-infomax paper supplies the full overcomplete derivation [3], while the companion 2016 hypercolumn paper supplies closely related conventions only when labeled as such [4]. Project code is a test subject, never an authority.

Every result is assigned to one of three scientific categories:

1. Publication reconstruction: directly supported equations or conditions.
2. Declared reconstruction choice: an executable choice where the authors did not report enough detail.
3. Project extension: a new size, visualization, solver policy, or scientific question not claimed by the publication.

This distinction prevents exact algebra from being confused with an exact regeneration of an unpublished stochastic trajectory. It also prevents a successful one-step execution from being called a sustained scaling limit.

## 2. Published model and independent derivation

For N inputs and M outputs, x is N by 1, s is M by 1, W is M by N, K is M by M, and the susceptibility chi is M by N. The published first-order dynamics and fixed point are

    tau ds/dt = -s + g(W x + K s),
    s = g(W x + K s).

Writing G = diag(g'), implicit differentiation gives

    phi = (G^-1 - K)^-1 = (I - G K)^-1 G,
    chi = phi W.

For a regular overcomplete map, the objective is

    epsilon = -1/2 E_x[log det(chi^T chi)].

Define

    Gamma = (chi^T chi)^-1 chi^T phi,
    a_k = (chi Gamma)_kk g''_k / (g'_k)^3.

Independent rectangular-matrix differentiation yields the recurrent descent direction

    -d epsilon/dK = (chi Gamma)^T + (phi^T a) s^T.

The dimensions are Gamma: N by M, (chi Gamma)^T: M by M, phi^T a: M by 1, and the full update: M by M. The sign and transpose ordering match the target and foundational publications. The simpler appendix term involving phi^T alone is the square full-rank special case, not the general M > N expression.

### 2.1 Scope of the information objective

The foundational derivation treats the output distribution as an N-dimensional manifold embedded in M-dimensional output space. The local volume factor is sqrt(det(chi^T chi)). Calling the objective “mutual information” therefore carries assumptions: a deterministic or zero-output-noise limit, a continuous single-valued locally invertible input-output map, and full column rank of chi [3]. The expression is not a general estimator of finite-noise mutual information. Attractor bifurcations can violate the single-branch regularity assumptions, exactly where the companion paper reports critical behavior [4].

### 2.2 Numerical evaluation without changing the equations

The validated implementation does not explicitly invert G or chi^T chi. It solves (I-GK)Y=GR, reuses linear solvers, and obtains the small objective and least-squares factors from a scaled QR factorization. This is algebraically equivalent at full column rank while avoiding the squared condition number and underflow inherent in normal equations. A stress test with scalar field h=400 has a machine-zero Gram entry yet retains objective 400 and recurrent update -1.

Rank loss is not silently repaired with a pseudoinverse: it is a singularity of the published regular objective. A derivative floor is likewise not part of the published equations. The reference default is zero; a positive floor remains available only as a labeled project surrogate.

## 3. Verification protocol and results

The fidelity gate preceded every benchmark. `PublicationDerivation.wls` imports no project model code. It reconstructs the equations from the papers, checks symbolic identities and dimensions, derives the recurrent differential independently, evaluates a numerical fixed point, and compares susceptibility and objective derivatives with finite differences.

The result was then challenged three more ways: repeated random Wolfram fixtures with an independent root solver, cross-language JavaScript fixtures tied to the frozen Wolfram reference, and a 31-test Wolfram MUnit suite covering factors, dense handoff, saturation, underflow, serialization, solver residuals, population-vector semantics, stability, and Figure 7 transcription.

| Verification gate | Result |
|---|---:|
| Independent publication checks | 28/28 pass |
| Independent fixed-point residual | 1.11e-16 |
| Susceptibility finite-difference max absolute error | 6.16e-11 |
| Objective-gradient max absolute error | 3.18e-10 |
| Objective-gradient relative error | 1.73e-9 |
| Repeated random Wolfram fixtures | 9/9 pass |
| Worst repeated Wolfram gradient absolute error | 7.85e-10 |
| JavaScript finite-difference fixtures | 6/6 pass |
| Worst JavaScript gradient absolute error | 4.64e-10 |
| Wolfram MUnit | 31/31 pass |

The independently derived recurrent direction agrees with both implementations. The fact that the final formula agrees does not erase implementation faults found around it; stable evaluation, convergence classification, and scientific defaults mattered.

## 4. Publication-fidelity adjudication

### 4.1 Corrected errors

| Earlier behavior | Publication-grade resolution |
|---|---|
| Population vector divided by neuron count | Default is the published unnormalized complex sum; a mean is explicit project behavior. |
| High-dimensional diagonal always deleted | The reference retains diagonal updates; deletion is optional. The paper does not uniquely report the 142-output diagonal policy. |
| Positive logistic derivative floor always active | Reference floor is zero; positive values are labeled surrogate semantics and excluded from exact runs. |
| Best checkpoints compared on changing random samples | A fixed validation ensemble is used. Its size and cadence remain declared choices. |
| Normal-equation and explicit-inverse paths | Scaled QR and reusable solve paths preserve the regular equations more reliably. |
| Step-size-only convergence | Both step change and fixed-point residual are required. |
| Matrix-free zero-rank multiplication and assignment faults | Corrected and covered by Wolfram tests. |

### 4.2 What is known about Figure 7

The paper explicitly gives four inputs, 142 outputs, 71 outputs per modality, circularly spaced unit feedforward vectors, independent uniform input angles, Gaussian radii whose standard deviation is proportional to the mean, a single recurrent learning rate, and the 15 values displayed across the five Figure 7 panels [1]. All displayed values are transcribed and tested.

The publication does not report random seeds, independent repetitions, uncertainty, total updates, stopping endpoint, batch size, checkpoint cadence or ensemble, the proportionality coefficient for radius standard deviation, Gaussian truncation, monotonicity classifier, effective-zero threshold, probe radius, state initialization, branch-selection policy, numerical integrator, time step, equilibrium tolerance, stability window, or a distinct high-dimensional diagonal rule. Figure 7 is five displayed simulations, not a replicated statistical study. An author-exact trajectory cannot be reconstructed from the record.

The target says cross-talk starts near zero, while its abstract says zero. It does not report the near-zero scale or distribution or the within-modality initial matrix. Exact full K=0 is consequently a declared benchmark condition. The coefficient SD=0.1 times mean and logistic activation are supported by the companion model [4] but remain labeled conventions rather than printed Figure 7 parameters.

### 4.3 S1 Appendix findings

Symbolic reconstruction identified apparent manuscript issues, recorded as findings rather than author-confirmed errata. The real branch displayed in Eq. 95 has a sign inconsistent with the direct eigenvalue algebra and Eqs. 93 and 97. The learning Jacobian is symmetric, so its discriminant is a sum of squares and the complex branch is unreachable for that Jacobian. The claim of strict positivity has an equality case at the two output variances equal to 0.3, and the statement that one eigenvalue is independent of learning rate is not literally general. The implementation follows the algebraically consistent final expression. No linked correction was found on the PLOS record as of the audit date.

## 5. Benchmark protocol

The current cohort uses Wolfram Engine 15.0, binary64 arithmetic, no GPU, full K=0 initialization, retained diagonal, no clipping, no sparsity, no finite-rank truncation, and no derivative floor. The Figure 7E means (0.2, 2.0) and learning rate 1.5e-4 are used with the companion-derived radius SD coefficient 0.1. Inputs and validation use fixed recorded seeds. Synchronous Euler has step 0.5 in units of tau; both step and fixed-point residual tolerances are 1e-9. Checkpoint restoration is disabled for timing.

Each v2 run records protocol, source fingerprints, convergence, objective, gradient, exactness switches, model bytes, Wolfram allocator peak, and Linux process peak resident set. An aggregation gate rejects a current run unless its file identity, schema, source hashes, horizon, convergence, tolerances, exactness flags, finite metrics, and protocol all match. Ten current files pass. Older v1 files are retained only as historical provenance.

“Exact factor history” means algebraically exact binary64 evaluation of this declared K=0 condition with every factor retained until an exact dense handoff. It does not mean bitwise equality under every summation order and does not cover a generic dense near-zero K.

## 6. Measured results

### 6.1 Publication-sized reference

| Metric | M=142 |
|---|---:|
| Recurrent updates | 1,000 |
| Training time | 239.805 s |
| Training time per update | 0.239805 s |
| Total including 16-sample validation | 241.659 s |
| Training-sample settle iterations | 31 |
| Probe fixed-point residual | 1.7474e-10 |
| Validation objective before | -0.795891 |
| Validation objective after | -0.814696 |
| Final representation | Dense after exact handoff |
| Wolfram allocator peak | 234.8 MB |
| Linux peak resident set | 358.6 MB |

The lower matched validation objective supports this deterministic trajectory; it is not a recovered Figure 7 endpoint or proof that full learning converged.

### 6.2 Controlled 10-update project-family ladder

| Outputs M | Settle median (s) | Objective incl. settle (s) | Gradient incl. settle/objective (s) | Training s/update | Total incl. validation (s) | Peak RSS (MB) |
|---:|---:|---:|---:|---:|---:|---:|
| 284 | 0.0335 | 0.0452 | 0.0497 | 0.2059 | 2.78 | 195.6 |
| 568 | 0.0670 | 0.0902 | 0.0797 | 0.4148 | 5.35 | 196.8 |
| 1,136 | 0.1036 | 0.1347 | 0.1465 | 0.7427 | 10.42 | 201.4 |
| 2,272 | 0.1604 | 0.3159 | 0.3825 | 1.4977 | 21.17 | 212.3 |
| 4,544 | 0.4158 | 0.6895 | 0.6783 | 3.1146 | 42.94 | 238.0 |
| 9,088 | 1.0555 | 1.1599 | 1.3720 | 6.5448 | 89.95 | 291.7 |

The fixed-window log-log slope of training seconds per update versus M is 0.991. It is descriptive only. Every 10-update endpoint stores 50 factor columns, whereas factor count grows with training. The slope is not an asymptotic training law.

The circular refinement has strong early-window numerical consistency on this seed: the range of epsilon+2 log(M) before validation is 1.78e-15; the validation-objective-change range is 2.66e-14; and the recurrent Frobenius-norm range is 6.51e-19. This supports the project discretization diagnostic, not a biological equivalence or author-published normalization law.

### 6.3 Farther bounded probes

| Outputs M | Updates | Training s/update | Total incl. validation (s) | Factor columns | Peak RSS (MB) |
|---:|---:|---:|---:|---:|---:|
| 18,176 | 2 | 6.5263 | 18.57 | 10 | 231.6 |
| 36,352 | 1 | 11.3195 | 21.45 | 5 | 251.7 |
| 72,704 | 1 | 26.8300 | 48.99 | 5 | 322.4 |

The differing horizons explain the nonmonotonic memory relative to the 10-update ladder. The 72,704 run is evidence that one exact update executed. It is not a fully trained model, a failure boundary, or a practical limit.

### 6.4 Exact representation eventually becomes dense

For four inputs, a single-sample published update factors into two terms and has algebraic rank at most N+1=5. With r retained columns, the representation stores approximately M(2r+1) values versus M^2 dense values. The exact storage crossover is

    r_cross = ceil((M-1)/2).

For batch-one updates appending no more than five columns,

    t_cross = ceil((M-1)/10).

The exact implementation hands off at update 15 for M=142, 909 for M=9,088, and 7,271 for M=72,704. Before handoff, the leading factor-solve structure is O(M r^2 + r^3), with r no greater than 5t, in addition to every fixed-point iteration. After handoff, an unrestricted recurrent matrix has O(M^2) storage and general dense factorization pressure is cubic. Exact early low rank postpones but does not abolish the model's mathematical scaling.

### 6.5 Critical slowing and gradient validity

The controlled test sets the fixed-point Jacobian spectral radius rho and has known equilibrium s=0.5 times the all-ones vector. It isolates conditioning without claiming to be a Figure 7 endpoint.

| rho | Euler iterations | Settle time (s) | State error | Exact-state gradient relative error | Policy-settled gradient relative error |
|---:|---:|---:|---:|---:|---:|
| 0.9 | 272 | 0.122 | 8.72e-9 | 2.67e-16 | 4.44e-7 |
| 0.99 | 2,298 | 1.511 | 9.88e-8 | 5.34e-16 | 5.54e-5 |
| 0.999 | 18,294 | 10.733 | 9.99e-7 | 5.60e-16 | 5.73e-3 |
| 0.9995 | 33,595 | 18.506 | 2.00e-6 | 3.50e-16 | 2.33e-2 |
| 0.9999 | 129,683 | 71.389 | 1.00e-5 | 3.56e-16 | 0.62176 |

Locally, state error is approximately (I-GK)^-1 times the fixed-point residual. A residual threshold therefore cannot control forward state or gradient error as the operator approaches singularity. Exact-state gradient checks show that the analytical formula is sound; the failure is an insufficient settling criterion near criticality.

## 7. Deep-research audit of expansion methods

### 7.1 Equation-preserving methods

Reusing one pivoted factorization for multiple right-hand sides and transpose solves is directly supported by LAPACK DGETRS and Wolfram LinearSolve [5,8]. The current code already removed a duplicate transpose factorization, but compatible right-hand sides can be combined further. QR can deliver the objective from its four-by-four triangular factor without a separate tall-matrix singular-value pass [6,10]. Diagnostic Gram matrices should be optional.

FP64 GPU LU, QR, and SVD are model-preserving kernels available in cuSOLVER [18]. They require measured transfer costs, residual comparison, and reproducibility configuration; no GPU was available in the current environment. cuBLAS explicitly limits bitwise guarantees across toolkit versions and some multistream or atomic modes [19]. Distributed block-dense execution through PBLAS/ScaLAPACK is also equation-preserving in definition [20], while communication-avoiding QR/LU can reduce data movement [21]. Neither removes quadratic state storage or conditioning.

Predetermined samples and seeds may run in parallel with ordered reduction. The current benchmark did not use GPU execution or actual sample parallelism; earlier suggestions that it did are withdrawn.

### 7.2 Tolerance-equivalent methods

Anderson acceleration can greatly accelerate a fixed-point solve and is related to GMRES on linear problems [15]. Safeguarded variants add regularization and restart logic [16]. It is nevertheless a root finder, not the published temporal ODE trajectory, and may enter a different basin in a multistable network. Acceptance therefore requires agreement with a tight reference, a stability/basin check, and a declared distinction between equilibrium solving and dynamical simulation.

GMRES and related Krylov methods minimize residuals for nonsymmetric systems [17], but near singularity a small residual need not imply small forward or gradient error. Preconditioner, restart, condition estimate, and gradient error must be recorded. Warm starts have the same branch-selection risk.

Mixed-precision iterative refinement can use a low-precision factorization while targeting double-precision backward error, with a double-precision fallback [11,22]. It is not automatically equivalent. The current critical result makes forward- and gradient-error gates essential.

Low-rank Sherman-Morrison-Woodbury algebra is exact symbolically, but recent stability analysis shows that factor conditioning and approximate solves matter [12-14]. Because G changes with each equilibrium, the old Woodbury core is not generally an exact bordered update across samples; prior factors may serve as a preconditioner, not as a mathematically reusable exact core.

### 7.3 Model-changing methods excluded from the exact benchmark

Finite-rank truncation, randomized compression, sketches, imposed sparsity, pruning, block-circulant recurrent constraints, altered cross-size weight normalization, derivative floors, clipping, changed activation, changed input statistics, surrogate fixed points, and altered learning rules can be valuable new experiments. They cannot answer the exact-model research question because they change the admissible K, the dynamics, the objective, or the update trajectory.

Periodic trapezoidal convergence explains why smooth circular refinements can converge rapidly [23], but supplies no Shriki-specific neuron-count normalization. The observed cross-size invariants are empirical diagnostics for one early window, not authorization to rescale the learning rule or population vector.

## 8. Discussion

The fidelity gate is passed at the equation and implementation level. The recurrent gradient was independently derived rather than copied, finite differences agree in both languages, numerical stress cases are covered, and previously conflated project behavior is separated from the scientific reference.

The stronger claim—exact reproduction of the authors' Figure 7 trajectories—cannot be made because essential numerical and stochastic protocol is absent. Repeated testing reduces implementation error; it cannot infer unreported seeds, tolerances, initialization distributions, or checkpoint policies.

On current hardware, the declared 142-output reference is a minutes-scale 1,000-update computation. That is a striking qualitative contrast with the authors' reported weeks-scale experience near criticality, but not a controlled speedup. Their runs may have used different horizons and much slower near-critical endpoints. The current controlled critical experiment itself grows from 272 to 129,683 iterations as rho approaches one and demonstrates that mathematical conditioning can dominate even when M is fixed.

The practical answer to the research question is therefore evidence-bounded:

- sustained declared execution was demonstrated at M=142 for 1,000 updates;
- common early-window execution was demonstrated through M=9,088 for 10 updates;
- one exact update was demonstrated at M=72,704;
- the early factor representation eventually crosses into dense storage and growing-rank algebra;
- no sustained large-M failure boundary was measured; and
- critical conditioning already dominates both runtime and gradient reliability at M=142.

The next scientifically decisive experiment is not another one-step maximum. It is a multi-seed, matched-horizon study with a predefined scientific stopping endpoint, adaptive condition-aware settling, direct gradient-validity checks, and explicit representation crossover measurements. Only then can a practical sustained limit be estimated.

## 9. Reproducibility and data availability

All scripts, raw JSON outputs, source fingerprints, protocol choices, validation reports, benchmark qualification records, and this report are stored in the project repository. `PROJECT_LOG.json` indexes the entire repository snapshot and every scientific JSON artifact by SHA-256. `docs/scientific-source-ledger.json` records search scope and source applicability; `docs/scientific-claim-audit.json` adjudicates each central claim. Historical benchmark files remain labeled and excluded from the current cohort.

Primary executable records are:

- `mathematica/verification/PublicationDerivation.wls`
- `mathematica/verification/RepeatedValidation.wls`
- `mathematica/verification/NumericalPolicySensitivity.wls`
- `mathematica/tests/SynesthesiaModel.wlt`
- `mathematica/benchmark-results/scaling-summary.json`
- `mathematica/benchmark-results/benchmark-qualification.json`
- `mathematica/benchmark-results/critical-slowing-142.json`
- `mathematica/benchmark-results/factorhistory-*-v2.json`

## References

1. Shriki O, Sadeh Y, Ward J. The Emergence of Synaesthesia in a Neuronal Network Model via Changes in Perceptual Sensitivity and Plasticity. PLOS Computational Biology 12(7):e1004959, 2016. https://doi.org/10.1371/journal.pcbi.1004959
2. Shriki O, Sadeh Y, Ward J. S1 Appendix: Analytical derivation of the conditions for the evolution of cross-talk in the simple model, 2016. https://doi.org/10.1371/journal.pcbi.1004959.s001
3. Shriki O, Sompolinsky H, Lee DD. An Information Maximization Approach to Overcomplete and Recurrent Representations. Advances in Neural Information Processing Systems 13, 2000. https://proceedings.neurips.cc/paper_files/paper/2000/file/09fb05dd477d4ae6479985ca56c5a12d-Paper.pdf
4. Shriki O, Yellin D. Optimal Information Representation and Criticality in an Adaptive Sensory Recurrent Neuronal Network. PLOS Computational Biology 12(2):e1004698, 2016. https://doi.org/10.1371/journal.pcbi.1004698
5. Wolfram Research. LinearSolve documentation. https://reference.wolfram.com/language/ref/LinearSolve.html
6. Wolfram Research. QRDecomposition documentation. https://reference.wolfram.com/language/ref/QRDecomposition.html
7. Wolfram Research. SingularValueDecomposition documentation. https://reference.wolfram.com/language/ref/SingularValueDecomposition.html
8. LAPACK 3.12.1. DGETRS. https://www.netlib.org/lapack/explore-html/df/d36/group__getrs_gaacd7a8465c8cc0e4e8b88ba4b453630c.html
9. LAPACK 3.12.1. DGESVXX. https://www.netlib.org/lapack/explore-html/df/d38/group__gesvxx_ga4b2a7e11fe7425c012ca9eba6c06877f.html
10. LAPACK 3.12.1. DGELSY. https://www.netlib.org/lapack/explore-html/d6/d4b/dgelsy_8f_source.html
11. LAPACK 3.12.1. DSGESV. https://www.netlib.org/lapack/explore-html/d8/dc6/group__gesv__mixed_ga2dd852850de165b9150bb7ee4f4ca3e9.html
12. Hager WW. Updating the Inverse of a Matrix. SIAM Review 31:221-239, 1989. https://doi.org/10.1137/1031049
13. Ma L, Boutsikas C, Ghadiri M, Drineas P. A Note on the Stability of the Sherman-Morrison-Woodbury Formula. SIAM Journal on Matrix Analysis and Applications 47(2):702-723, 2026. https://doi.org/10.1137/25M1747087
14. Goudas T et al. Instability of the Sherman-Morrison formula and stabilization by iterative refinement. arXiv:2510.01696v1, 2026. https://arxiv.org/html/2510.01696v1
15. Walker HF, Ni P. Anderson Acceleration for Fixed-Point Iterations. SIAM Journal on Numerical Analysis 49(4):1715-1735, 2011. https://doi.org/10.1137/10078356X
16. Zhang J, O'Donoghue B, Boyd S. Globally Convergent Type-I Anderson Acceleration for Non-Smooth Fixed-Point Iterations. SIAM Journal on Optimization 30(4):3170-3197, 2020. https://web.stanford.edu/~boyd/papers/nonexp_global_aa1.html
17. Saad Y, Schultz MH. GMRES: A Generalized Minimal Residual Algorithm for Solving Nonsymmetric Linear Systems. SIAM Journal on Scientific and Statistical Computing 7(3):856-869, 1986. https://doi.org/10.1137/0907058
18. NVIDIA. cuSOLVER 13.3 documentation. https://docs.nvidia.com/cuda/cusolver/index.html
19. NVIDIA. cuBLAS 13.3 documentation, Results Reproducibility. https://docs.nvidia.com/cuda/cublas/index.html#results-reproducibility
20. Blackford LS et al. ScaLAPACK Users' Guide. SIAM, 1997. https://www.netlib.org/scalapack/slug/node4.html
21. Demmel J, Grigori L, Hoemmen M, Langou J. Communication-optimal parallel and sequential QR and LU factorizations. arXiv:0808.2664, 2008. https://arxiv.org/abs/0808.2664
22. Higham NJ, Mary T. Mixed precision algorithms in numerical linear algebra. Acta Numerica 31:347-414, 2022. https://www.cambridge.org/core/journals/acta-numerica/article/mixed-precision-algorithms-in-numerical-linear-algebra/43CA701BA29251B5790C653E66F46197
23. Trefethen LN, Weideman JAC. The Exponentially Convergent Trapezoidal Rule. SIAM Review 56(3):385-458, 2014. https://doi.org/10.1137/130932132
