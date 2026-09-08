"""Tests the history machinery, not the Neural Engine or Wolfram mathematics."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("history_v1", Path(__file__).with_name("history.py"))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "repo"
        self.root.mkdir()
        self.out = Path(self.temp.name) / "snapshots"
        for args in [("init", "-q"), ("config", "user.email", "fixture@example.invalid"),
                     ("config", "user.name", "History test fixture")]:
            subprocess.run(["git", "-C", str(self.root), *args], check=True)
        self.add("package.json", '{"version":"0.8.0"}\n')
        self.add("PROJECT_LOG.json", '{"history":[{"commit":"legacy-evidence"}]}\n')
        self.add("MASTER_PROJECT.json", '{"legacy":true}\n')
        self.add("CHANGELOG.md", "# Fixture change notes\n")
        self.commit("test: initial fixture")
        self.add("notes.md", "Second fixture change\n")
        self.commit("docs: record second fixture")

    def tearDown(self):
        self.temp.cleanup()

    def add(self, relative, text):
        p = self.root / relative
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)

    def commit(self, message):
        subprocess.run(["git", "-C", str(self.root), "add", "."], check=True)
        subprocess.run(["git", "-C", str(self.root), "commit", "-qm", message], check=True)

    def build(self):
        with patch.object(h.shutil, "which", return_value=None):
            return h.build(self.root, self.out)

    def test_pair_covers_every_commit(self):
        folder = self.build()
        s = json.loads((folder / "SCIENTIFIC_HISTORY.json").read_text())
        p = json.loads((folder / "NONSCIENTIFIC_HISTORY.json").read_text())
        h.validate_pair(s, p)
        self.assertEqual(s["coverage"]["commit_count"], 2)
        self.assertEqual(len(p["timeline"]), 2)
        self.assertEqual(s["fresh_wolfram"]["status"], "blocked_no_local_wolframscript")
        self.assertFalse(s["fresh_wolfram"]["all_passed"])

    def test_existing_source_and_snapshot_bytes_are_preserved(self):
        baseline = {p: p.read_bytes() for p in self.root.rglob("*") if p.is_file() and ".git" not in p.parts}
        first = self.build()
        archived = {p: p.read_bytes() for p in first.iterdir()}
        second = self.build()
        self.assertNotEqual(first, second)
        for p, raw in {**baseline, **archived}.items():
            self.assertEqual(p.read_bytes(), raw)

    def test_exclusive_write_refuses_overwrite(self):
        p = Path(self.temp.name) / "existing.json"
        h.write_new(p, {"old": True})
        old = p.read_bytes()
        with self.assertRaises(FileExistsError):
            h.write_new(p, {"new": True})
        self.assertEqual(p.read_bytes(), old)

    def test_integrity_hashes_match_files(self):
        folder = self.build()
        manifest = json.loads((folder / "INTEGRITY.json").read_text())
        for name, row in manifest["files"].items():
            raw = (folder / name).read_bytes()
            self.assertEqual(row["bytes"], len(raw))
            self.assertEqual(row["sha256"], h.digest(raw))

    def test_dirty_tracked_source_is_rejected(self):
        self.add("notes.md", "Uncommitted changes\n")
        with self.assertRaisesRegex(ValueError, "Tracked worktree"):
            self.build()

    def test_stale_report_is_not_promoted(self):
        self.add("mathematica/SynesthesiaModel.wl", "fixture-only\n")
        report = {"modelSource": "mathematica/SynesthesiaModel.wl", "modelSourceSha256": "0" * 64,
                  "testFile": "missing.wlt", "testFileSha256": "0" * 64,
                  "runnerSha256": "0" * 64, "allPassed": True, "testCount": 31}
        self.add(h.REPORTS["munit"][1], json.dumps(report))
        self.commit("test: fixture stale hash")
        folder = self.build()
        s = json.loads((folder / "SCIENTIFIC_HISTORY.json").read_text())
        audit = s["archived_wolfram_audit"]["munit"]
        self.assertEqual(audit["status"], "historical_report_source_mismatch")
        self.assertFalse(audit["fresh_execution"])

    def test_nonzero_node_process_is_not_a_pass(self):
        tap = Path(self.temp.name) / "test.tap"
        tap.write_text("# tests 1\n# pass 1\n# fail 0\n# skipped 0\n")
        Path(str(tap) + ".exit").write_text("1")
        self.assertFalse(h.node_result(tap)["all_passed"])

    def test_missing_node_exit_code_is_not_a_pass(self):
        tap = Path(self.temp.name) / "test.tap"
        tap.write_text("# tests 1\n# pass 1\n# fail 0\n")
        self.assertFalse(h.node_result(tap)["all_passed"])

    def test_potential_secret_not_embedded(self):
        self.add("private-fixture.json", json.dumps({"fixture": "moltbook_" + "sk_" + "X" * 20}))
        self.commit("test: secret guard fixture, not a real credential")
        folder = self.build()
        s = json.loads((folder / "SCIENTIFIC_HISTORY.json").read_text())
        self.assertNotIn("private-fixture.json", s["project_json_evidence"])
        entry = next(r for r in s["artifact_manifest"] if r["path"] == "private-fixture.json")
        self.assertEqual(entry["embedding_status"], "potential_secret_not_embedded")

    def test_invalid_json_is_rejected(self):
        self.add("invalid.json", "{bad}")
        self.commit("test: invalid JSON fixture")
        with self.assertRaises(ValueError):
            self.build()


if __name__ == "__main__":
    unittest.main(verbosity=2)
