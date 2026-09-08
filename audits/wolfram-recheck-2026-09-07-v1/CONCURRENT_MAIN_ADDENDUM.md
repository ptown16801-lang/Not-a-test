# Preservation addendum: concurrent main-branch changes

This is an additional record, not a replacement for the original audit.

At the start of this session, the connected GitHub branch read returned main at
`557ce0553224a8299abecd98cf71be142ad90b35`. During final verification, main was
observed at `b92afe4471c796a8227146ba7e066d2fdc43c526`, eight commits ahead of
that baseline. Its recorded commit time is `2026-09-08T01:52:53Z`.

**This audit session did not write to main.** Its writes were new files on the
separate `audit/wolfram-recheck-20260907-v1` branch. Therefore, the preservation
claim is that this session did not modify existing files or main, not that
main remained globally unchanged while other work was occurring.

The concurrent main changes include a 600-neuron backpropagation report and
runner, plus a separate Wolfram dependency recheck and strict verification
command. The latest recheck document was read through the GitHub connector at
the exact observed commit:

`docs/wolfram-dependency-recheck-2026-09-07.md`

It independently records the same blocked result: connector SSE-probe HTTP
404, no local executable, and no fresh mathematical revalidation. It documents
an already-integrated `npm run verify:wolfram` command. This audit does not
claim authorship of, rerun, replace, or merge over that concurrent work.

The comparison from the original baseline to the observed main commit contains
no modifications under `mathematica/` and no modification to the existing
`test/mathematica-rewrite.test.js`. Thus the two original live-gate entry points
examined by this audit were not superseded by that particular comparison.
This is a source-diff observation, not a successful execution claim.

The original audit's statement that the 600-neuron test was not run refers to
this session only. It is not a claim that the concurrent report does not exist.
The concurrent backpropagation results were not independently assessed here.

Before this addendum, the audit branch comparison showed exactly four added
files, zero modified files, and zero deletions. The locally tested runner,
tests, README, and audit JSON were verified byte-for-byte against their GitHub
Git blob hashes. This addendum is the fifth new file. The final delivery
receipt records the resulting audit-branch commit separately, preserving all
previous records without rewriting them.
