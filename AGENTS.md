# Neural Engine work-preservation and evidence policy

The authoritative project repository is `ptown16801-lang/Not-a-test`.

- Preserve earlier work. This maintenance revision is additive: do not overwrite the legacy `PROJECT_LOG.json`, `MASTER_PROJECT.json`, scientific reports, or previous history snapshots. For a later user-authorized source edit, preserve the previous revision in Git and record the exact change and evidence; never silently rewrite scientific history.
- Maintain BOTH scientific and non-scientific/plain-language JSON histories. Use `maintenance/v1/history.py` to create a uniquely named pair under `history/snapshots/`. Include change notes, source commit, timestamps, matching event identifiers, and integrity hashes. Do not reuse a snapshot directory.
- Distinguish freshly executed results, hash-matched historical reports, unverified claims, reconstruction choices, blocked dependencies, and planned work. A skipped or blocked test is not a pass. Do not substitute another numerical tool and call it Wolfram validation.
- Retry the genuine Wolfram kernel when required. Use a disposable source copy for runners that export to fixed paths. Never overwrite committed evidence merely by running tests.
- Preserve the author's reported mathematics. No silent pseudoinverse, derivative floor, clipping, normalization change, finite-rank compression, or altered learning rule in an exact-model claim.
- Unpublished authors' source code, seeds, integration settings, and training lengths remain unknown unless primary evidence resolves them. Increasing network size does not establish biological equivalence or semantic decoding.
- Keep credentials and personal account details out of source and histories. Do not post to external social services as part of history maintenance unless the user separately requests it.

See `maintenance/v1/README.md` for the executable maintenance workflow and its coverage limits.
