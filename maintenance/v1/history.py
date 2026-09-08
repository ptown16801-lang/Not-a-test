#!/usr/bin/env python3
"""Append-only, evidence-qualified Neural Engine history snapshots (stdlib only).
Never regenerates or overwrites the legacy PROJECT_LOG or MASTER_PROJECT files.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import uuid

SCHEMA = "neural-engine-paired-history/v1"
SNAPSHOT_PREFIX = "history/snapshots/"
REPORTS = {
    "munit": ("mathematica/tests/RunTests.wls", "mathematica/verification/results/wolfram-test-report.json", "testCount"),
    "publication": ("mathematica/verification/PublicationDerivation.wls", "mathematica/verification/results/wolfram-validation.json", "checkCount"),
    "repeated": ("mathematica/verification/RepeatedValidation.wls", "mathematica/verification/results/repeated-validation.json", None),
    "numerical_policy": ("mathematica/verification/NumericalPolicySensitivity.wls", "mathematica/verification/results/numerical-policy-sensitivity.json", None),
}
SECRET = re.compile(r"(?:moltbook_sk_|sk-proj-)[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")


def utcnow():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], stderr=subprocess.PIPE)


def write_new(path, value):
    """O_EXCL prevents even accidental reuse of an existing artifact path."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write("\n")


def source_tree(root, head):
    result = {}
    for entry in git(root, "ls-tree", "-rz", "--full-tree", head).split(b"\0"):
        if not entry:
            continue
        metadata, name = entry.split(b"\t", 1)
        mode, kind, sha = metadata.decode().split()
        path = name.decode("utf-8")
        result[path] = {"path": path, "mode": mode, "type": kind, "git_blob": sha}
    return result


def read_at(root, head, path):
    return git(root, "show", f"{head}:{path}")


def source_match(root, head, tree, path, expected):
    available = path in tree and tree[path]["type"] == "blob"
    actual = digest(read_at(root, head, path)) if available else None
    return {"path": path, "expected_sha256": expected, "actual_sha256": actual,
            "matches": isinstance(expected, str) and actual == expected}


def historical_audit(root, head, tree):
    result = {}
    for name, (runner, path, count_key) in REPORTS.items():
        if path not in tree:
            result[name] = {"status": "historical_report_missing", "fresh_execution": False}
            continue
        raw = read_at(root, head, path)
        report = json.loads(raw)
        checks = []
        if name == "munit":
            for p, field in [(report.get("modelSource"), "modelSourceSha256"),
                             (report.get("testFile"), "testFileSha256"),
                             (runner, "runnerSha256")]:
                checks.append(source_match(root, head, tree, p, report.get(field)))
        elif name == "publication":
            p = report.get("provenance", {})
            for field, hashfield in [("script", "scriptSha256"), ("sourceManifest", "sourceManifestSha256")]:
                checks.append(source_match(root, head, tree, p.get(field), p.get(hashfield)))
        matches = bool(checks) and all(row["matches"] for row in checks)
        result[name] = {
            "status": "historical_report_source_matched" if matches else
                      ("historical_report_source_mismatch" if checks else "historical_report_not_fully_source_checked"),
            "fresh_execution": False, "source": path, "report_sha256": digest(raw),
            "reported_at_utc": report.get("generatedAtUtc"), "reported_kernel": report.get("kernel"),
            "reported_all_passed": report.get("allPassed"),
            "reported_count": report.get(count_key) if count_key else None,
            "source_checks": checks,
            "qualification": "A stored report and matching hashes are provenance evidence, not a new execution or proof of biological validity."
        }
    return result


def command_record(command, cwd, timeout=120):
    started = utcnow()
    try:
        cp = subprocess.run(command, cwd=cwd, text=True, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        return {"started_at_utc": started, "command": command, "returncode": cp.returncode,
                "stdout": cp.stdout, "stderr": cp.stderr, "timed_out": False}
    except subprocess.TimeoutExpired as exc:
        def text(value):
            return value.decode(errors="replace") if isinstance(value, bytes) else (value or "")
        return {"started_at_utc": started, "command": command, "returncode": None,
                "stdout": text(exc.stdout), "stderr": text(exc.stderr), "timed_out": True}


def fresh_wolfram(root, head, tree, timeout):
    executable = shutil.which("wolframscript")
    result = {"checked_at_utc": utcnow(), "backend": "genuine Wolfram Language kernel only",
              "status": "blocked_no_local_wolframscript", "execution_attempted": False,
              "all_passed": False, "tests_passed": None, "runs": {}}
    if not executable:
        return result
    result["execution_attempted"] = True
    probe = command_record([executable, "-code", 'ExportString[<|"version"->$Version,"arithmetic"->(2+2)|>,"RawJSON"]'], root, 30)
    result["kernel_probe"] = probe
    try:
        parsed = json.loads(probe["stdout"].strip())
        kernel_ok = probe["returncode"] == 0 and parsed.get("arithmetic") == 4 and bool(parsed.get("version"))
    except (ValueError, AttributeError):
        kernel_ok = False
    if not kernel_ok:
        result["status"] = "blocked_kernel_probe_failed"
        return result
    result["kernel"] = parsed["version"]
    # The original runners write fixed output paths. Execute only in a disposable
    # copy and remove copied historical outputs first, never in the source checkout.
    with tempfile.TemporaryDirectory(prefix="neural-wolfram-") as temp:
        scratch = Path(temp)
        for path, metadata in tree.items():
            if path.startswith(SNAPSHOT_PREFIX) or metadata["type"] != "blob" or metadata["mode"] == "120000":
                continue
            target = scratch / path
            if not target.resolve().is_relative_to(scratch.resolve()):
                raise ValueError("Unsafe repository path")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(read_at(root, head, path))
        for name, (runner, output, count_key) in REPORTS.items():
            report_path = scratch / output
            report_path.unlink(missing_ok=True)  # disposable COPY only
            if not (scratch / runner).is_file():
                result["runs"][name] = {"status": "blocked_missing_runner", "all_passed": False}
                continue
            run = command_record([executable, "-file", runner], scratch, timeout)
            if report_path.is_file():
                try:
                    run["report"] = json.loads(report_path.read_text())
                except ValueError:
                    run["invalid_report"] = True
            report = run.get("report", {})
            # Do not infer success from old files, process exit alone, or empty tests.
            count_ok = (isinstance(report.get(count_key), int) and report[count_key] > 0) if count_key else True
            run["all_passed"] = run["returncode"] == 0 and report.get("allPassed") is True and count_ok
            run["status"] = "executed_pass" if run["all_passed"] else "executed_failed_or_unqualified"
            result["runs"][name] = run
    result["all_passed"] = len(result["runs"]) == len(REPORTS) and all(r.get("all_passed") for r in result["runs"].values())
    result["status"] = "executed_pass" if result["all_passed"] else "executed_failed_or_unqualified"
    return result


def commit_history(root, head):
    # All commits reachable from the authoritative source commit, including merges.
    commits = git(root, "rev-list", "--reverse", "--topo-order", head).decode().splitlines()
    history = []
    for sha in commits:
        raw = git(root, "show", "-s", "--format=%H%x00%P%x00%aI%x00%cI%x00%an%x00%B", sha).decode()
        commit, parents, author_date, commit_date, author, message = raw.split("\0", 5)
        changes = git(root, "diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-m", sha).decode().splitlines()
        history.append({"event_id": "git:" + commit, "commit": commit, "parents": parents.split(),
                        "author_date": author_date, "committed_at": commit_date, "author": author,
                        "message": message.strip(), "file_change_records": changes,
                        "evidence_type": "git_record_not_independent_validation"})
    return history


def node_result(path):
    if path is None:
        return {"status": "not_run_this_snapshot", "fresh_execution": False, "all_passed": None}
    raw = Path(path).read_text()
    # A separately preserved process exit code is required; TAP alone is not enough.
    exit_path = Path(str(path) + ".exit")
    code = int(exit_path.read_text().strip()) if exit_path.is_file() else None
    def count(label):
        values = re.findall(r"^# " + re.escape(label) + r"\s+(\d+)\s*$", raw, re.MULTILINE)
        return int(values[-1]) if values else None
    result = {"status": "executed", "fresh_execution": True, "returncode": code,
              "tests": count("tests"), "passed": count("pass"), "failed": count("fail"),
              "skipped": count("skipped"), "tap_sha256": digest(raw.encode()), "tap": raw}
    result["all_passed"] = code == 0 and result["failed"] == 0 and (result["tests"] or 0) > 0
    result["qualification"] = "Node tests are not a substitute for a fresh Wolfram run; skipped tests remain visible."
    return result


def validate_pair(scientific, plain):
    if scientific["snapshot_id"] != plain["snapshot_id"]:
        raise ValueError("Snapshot identifiers differ")
    if scientific["source_commit"] != plain["source_commit"]:
        raise ValueError("Source commits differ")
    a = [row["event_id"] for row in scientific["git_history"]]
    b = [row["event_id"] for row in plain["timeline"]]
    if a != b or len(a) != len(set(a)):
        raise ValueError("History coverage or event identifiers differ")
    if scientific["fresh_wolfram"]["status"].startswith("blocked") and scientific["fresh_wolfram"]["all_passed"]:
        raise ValueError("Blocked execution cannot be a pass")
    # Strict JSON encoding also rejects NaN/Infinity rather than silently emitting invalid JSON.
    json.dumps(scientific, allow_nan=False)
    json.dumps(plain, allow_nan=False)


def build(root, output_root, evidence_path=None, node_tap=None, timeout=180):
    root = Path(root).resolve()
    if git(root, "rev-parse", "--is-shallow-repository").strip() == b"true":
        raise ValueError("Full history required; refusing a shallow checkout")
    if git(root, "diff", "HEAD", "--name-only").strip():
        raise ValueError("Tracked worktree changes must be committed before snapshotting")
    head = git(root, "rev-parse", "HEAD").decode().strip()
    tree = source_tree(root, head)
    history = commit_history(root, head)
    manifest, documents, json_evidence, earlier = [], {}, {}, []
    for path, metadata in sorted(tree.items()):
        if metadata["type"] != "blob":
            manifest.append({**metadata, "content_status": "non_blob_not_embedded"})
            continue
        raw = read_at(root, head, path)
        entry = {**metadata, "bytes": len(raw), "sha256": digest(raw)}
        if path.startswith(SNAPSHOT_PREFIX):
            earlier.append(entry)  # prevents exponential re-embedding of history containers
            continue
        manifest.append(entry)
        if path.endswith((".json", ".md")):
            text = raw.decode("utf-8")
            if SECRET.search(text):
                entry["embedding_status"] = "potential_secret_not_embedded"
                continue
            if path.endswith(".json"):
                json_evidence[path] = json.loads(text)
            else:
                documents[path] = text
    external = json.loads(Path(evidence_path).read_text()) if evidence_path else {}
    if SECRET.search(json.dumps(external)):
        raise ValueError("Potential secret in session evidence")
    project = json_evidence.get("package.json", {})
    now = utcnow()
    snapshot_id = now.replace(":", "").replace("-", "") + "-" + head[:12] + "-" + uuid.uuid4().hex[:8]
    fresh = fresh_wolfram(root, head, tree, timeout)
    archived = historical_audit(root, head, tree)
    node = node_result(node_tap)
    coverage = {
        "scope": "All Git commits reachable from the source commit; tracked project documents and JSON evidence at that commit; explicitly supplied conversation milestones.",
        "commit_count": len(history), "history_start": history[0]["commit"] if history else None,
        "history_through": head, "source_artifact_count": len(manifest),
        "excluded_from_recursive_embedding": "Earlier history snapshots are hash-indexed, not embedded recursively.",
        "limitations": ["Private or unavailable conversations and unreachable/deleted Git objects are not claimed recovered.",
                       "The later commit saving this snapshot cannot be contained in its own source history.",
                       "Historical reports are preserved as reports, not relabeled as fresh executions."]}
    changes = {"action": "append_only_history_and_wolfram_recheck", "model_equations_modified": False,
               "legacy_files_overwritten": [], "source_commit": head,
               "notes": ["Added paired scientific/plain-language histories with matching event IDs.",
                         "Rechecked Wolfram availability and matched archived validation source hashes.",
                         "Preserved uncertainty, missing publication parameters, failed runs, and earlier snapshots.",
                         "Preserved legacy PROJECT_LOG.json and MASTER_PROJECT.json byte-for-byte."]}
    scientific = {"schema": SCHEMA, "audience": "scientific", "snapshot_id": snapshot_id,
        "generated_at_utc": now, "source_commit": head, "project_version": project.get("version"),
        "coverage": coverage, "change_notes": changes, "git_history": history,
        "session_evidence": external, "archived_wolfram_audit": archived,
        "fresh_wolfram": fresh, "fresh_node_tests": node,
        "artifact_manifest": manifest, "project_json_evidence": json_evidence,
        "project_documents": documents, "previous_snapshot_artifacts": earlier,
        "scientific_boundaries": [
            "Keep the original published learning rule and singularities; no silent pseudoinverse, clipping, derivative floor, normalization change, or finite-rank truncation.",
            "An exact algebraic representation and a converged numerical trajectory are different claims.",
            "Recorded scaling timings and input recovery do not establish biological equivalence, thought reading, semantic understanding, or image-only inversion.",
            "Unpublished authors' code, seeds, integration settings and training duration remain unknown unless primary evidence resolves them."]}
    timeline = [{"event_id": row["event_id"], "when": row["committed_at"], "commit": row["commit"],
                 "what_was_recorded": re.sub(r"^(?:feat|fix|test|docs|chore|ci|refactor)(?:\([^)]*\))?:\s*", "", row["message"]),
                 "files_changed": row["file_change_records"],
                 "meaning_of_this_entry": "A saved change record, not by itself proof that every described result was verified."}
                for row in history]
    plain = {"schema": SCHEMA, "audience": "non_scientific", "snapshot_id": snapshot_id,
        "generated_at_utc": now, "source_commit": head, "project_version": project.get("version"),
        "coverage": coverage, "change_notes": changes,
        "project_story": external.get("plain_language_project_story", []),
        "timeline": timeline, "current_findings": {
            "wolfram_now": "New Wolfram execution succeeded." if fresh["all_passed"] else "New Wolfram validation is blocked or not fully qualified; it has NOT been counted as a pass.",
            "wolfram_details": fresh,
            "earlier_wolfram_results": archived,
            "software_tests": {key: val for key, val in node.items() if key != "tap"},
            "what_was_not_changed": "The network mathematics, old results, original project logs, and existing artwork code were not overwritten."},
        "original_change_log": documents.get("CHANGELOG.md"),
        "earlier_project_history": json_evidence.get("PROJECT_LOG.json", {}).get("history", []),
        "planned_art_directions_not_claimed_implemented": external.get("conversation_milestones", []),
        "plain_language_limits": [
            "The project makes art from simulated neural activity. This is not evidence that it reads an AI's thoughts.",
            "Recovering an input from all internal numbers is different from recovering it from a rendered picture.",
            "Some original research settings were never published. Missing information must stay labeled unknown.",
            "The companion scientific JSON contains the full technical evidence and source fingerprints."],
        "scientific_companion": "SCIENTIFIC_HISTORY.json", "previous_snapshot_artifacts": earlier}
    validate_pair(scientific, plain)
    output = Path(output_root).resolve() / snapshot_id
    output.mkdir(parents=True, exist_ok=False)
    write_new(output / "SCIENTIFIC_HISTORY.json", scientific)
    write_new(output / "NONSCIENTIFIC_HISTORY.json", plain)
    write_new(output / "CHANGE_NOTES.json", changes)
    hashes = {p.name: {"sha256": digest(p.read_bytes()), "bytes": p.stat().st_size} for p in sorted(output.glob("*.json"))}
    write_new(output / "INTEGRITY.json", {"schema": "neural-engine-history-integrity/v1", "snapshot_id": snapshot_id, "source_commit": head, "files": hashes})
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".")
    parser.add_argument("--output-root", default="history/snapshots")
    parser.add_argument("--session-evidence")
    parser.add_argument("--node-tap")
    parser.add_argument("--wolfram-timeout", type=int, default=180)
    args = parser.parse_args()
    output = build(args.root, args.output_root, args.session_evidence, args.node_tap, args.wolfram_timeout)
    print(output)


if __name__ == "__main__":
    main()
