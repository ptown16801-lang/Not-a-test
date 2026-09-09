#!/usr/bin/env python3
"""Reproduce the thread's saved-state check and isolated operation benchmark.

Reads the packaged corpus. Writes only a caller-specified, previously absent
output file. Does not change engine code, solve equilibria, or validate gradients.
"""
import argparse
import datetime as dt
import hashlib
import json
import platform
import statistics
import time
from pathlib import Path

import numpy as np
import scipy
import scipy.linalg as la
from threadpoolctl import threadpool_info, threadpool_limits


def run(corpus_path):
    raw = corpus_path.read_bytes()
    corpus = json.loads(raw)
    cases = []
    benchmarks = []
    with threadpool_limits(limits=1, user_api="blas"):
        for c in corpus["cases"]:
            n, m = c["outputSize"], c["inputSize"]
            W = np.array(c["W"], dtype=np.float64).reshape(n, m)
            K = np.array(c["K"], dtype=np.float64).reshape(n, n)
            h = np.array(c["expected"]["field"], dtype=np.float64)
            z = np.exp(-np.abs(h))
            g = z / (1 + z)**2
            A = np.eye(n) - g[:, None] * K
            B = g[:, None] * W
            chi = la.solve(A, B, assume_a="gen")
            expected = np.array(c["expected"]["susceptibility"]).reshape(n, m)
            residual = la.norm(A @ chi - B, np.inf) / (
                la.norm(A, np.inf) * la.norm(chi, np.inf) + la.norm(B, np.inf))
            cases.append({
                "case": c["name"], "n": n, "m": m,
                "max_absolute_error_vs_saved": float(np.max(np.abs(chi - expected))),
                "within_corpus_tolerance": bool(np.allclose(
                    chi, expected, **corpus["tolerances"]["susceptibility"])),
                "normalized_linear_residual": float(residual),
                "condition_2": float(np.linalg.cond(A)),
            })

        rng = np.random.default_rng(20260908)
        for n, repeats in [(12, 300), (142, 25), (600, 3)]:
            K = rng.normal(size=(n, n))
            K *= 2.8 / np.max(np.sum(np.abs(K), axis=1))
            h = rng.uniform(-3, 3, n)
            z = np.exp(-np.abs(h))
            g = z / (1 + z)**2
            W = rng.normal(size=(n, 4))
            A = np.eye(n) - g[:, None] * K
            B = g[:, None] * W
            factor = la.lu_factor(A)
            funcs = {
                "inverse_then_multiply": lambda: la.inv(A) @ B,
                "general_solve_including_factor": lambda: la.solve(A, B, assume_a="gen"),
                "LU_factor_and_solve": lambda: la.lu_solve(la.lu_factor(A), B),
                "reuse_existing_LU_solve_only": lambda: la.lu_solve(factor, B),
            }
            samples = {key: [] for key in funcs}
            for f in funcs.values():
                f()
                f()
            for block in range(7):
                for name in rng.permutation(list(funcs)):
                    f = funcs[name]
                    start = time.perf_counter_ns()
                    for _ in range(repeats):
                        f()
                    samples[name].append((time.perf_counter_ns() - start) / repeats / 1e6)
            benchmarks.append({
                "n": n, "RHS": 4, "repetitions_per_block": repeats,
                "median_ms": {key: round(statistics.median(values), 6)
                              for key, values in samples.items()},
                "timing_block_samples_ms": samples,
                "maximum_difference": float(np.max(np.abs(
                    funcs["inverse_then_multiply"]() - funcs["general_solve_including_factor"]()))),
            })
        blas = [{key: item[key] for key in
                 ["internal_api", "version", "num_threads", "architecture"] if key in item}
                for item in threadpool_info()]
    return {
        "schema": "neural-linear-algebra-replay/v1",
        "executed_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "fresh_execution": True,
        "runtime": {"python": platform.python_version(), "numpy": np.__version__,
                    "scipy": scipy.__version__, "BLAS": blas, "platform": platform.platform()},
        "corpus_sha256": hashlib.sha256(raw).hexdigest(),
        "reproduction_script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "method": {"dtype": "float64", "blas_threads": 1, "rng_seed": 20260908,
                   "timing_blocks": 7, "right_hand_sides": 4,
                   "includes": "SciPy default finite checks; factorization except explicitly reused-LU case",
                   "excludes": ["imports", "matrix construction", "serialization", "whole-engine execution"]},
        "cases": cases,
        "all_saved_state_susceptibility_comparisons_passed": bool(cases) and all(
            c["within_corpus_tolerance"] for c in cases),
        "benchmarks": benchmarks,
        "limits": ["Saved-field linear solves, not new equilibrium solves or gradient validation.",
                   "Synthetic CPU operation timings, not whole-engine speedups.",
                   "Fresh replay timings do not supersede the original conversation measurements.",
                   "No Wolfram, SymPy, GPU, training, or SHA-256 performance claim is made."],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("The replay output must be a new file")
    result = run(Path(__file__).with_name("susceptibility-corpus.json"))
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2, allow_nan=False)
        stream.write("\n")
    print(json.dumps({"output": str(args.output),
                      "saved_state_cases_passed": result["all_saved_state_susceptibility_comparisons_passed"],
                      "benchmarks": [{"n": row["n"], "median_ms": row["median_ms"]}
                                     for row in result["benchmarks"]]}))
    if not result["all_saved_state_susceptibility_comparisons_passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
