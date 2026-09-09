# Power Garden downloads

[Download the VM assembly script](https://github.com/ptown16801-lang/Not-a-test/raw/refs/heads/research/power-garden-standalone/downloads/power-garden/assemble-vm.py).

GitHub's Git-data API rejected the single large ZIP. Four verified parts retain
the original delivered archive exactly. The script uses adjacent local parts
when present and otherwise downloads them from this public repository:

```sh
python3 assemble-vm.py
```

In a checkout, use `python3 downloads/power-garden/assemble-vm.py`. The assembly
script was executed against these parts and reconstructed the original ZIP
with the same SHA-256; the ZIP integrity check passed.

Extract `Power-Garden-VM.zip`, install QEMU with x86 system emulation, and run:

```sh
python3 replay.py
```

The guest boots Linux, launches the native Tk application, uses its real decode
button, captures the complete framebuffer, checks the displayed image region,
and saves the screenshot and results before shutting down. The packaged replay
was executed successfully. It is an automated replay, not a live remote desktop.

See [the VM report](../../research/power-garden/vm/README.md) and
[the actual screenshot](../../research/power-garden/vm/run-04/Power-Garden-VM.png).
The exactness result is for the six-value sample and recorded display settings;
the broader renderer contract and its unsupported cases are unchanged.

Archive size: 105,171,853 bytes. SHA-256:
`717f51cda085d7e7dcb579d22f5f10773a512182792b4b204cf58a5f2c3cde04`.

The restored archive is byte-identical to the entire delivered VM package,
including its original Git bundle and SHA-256 manifest. No guest file was
changed. Each part is at most 32 MiB, below GitHub's [100 MiB regular-Git file
limit](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
`VM-PARTS.json` records the size and SHA-256 of every part and the assembled ZIP.

## Exact original source history

The GitHub source snapshot has the same Git tree as tested local commit
`a506ad6a8851cbfcc708b8ce15b3b699820d1d98`. Because the connected app publishes Git data objects
with new commit metadata, the GitHub publication commit has a different ID.
The unchanged original commit DAG is retained in
[Power-Garden-Source-History.bundle](Power-Garden-Source-History.bundle), including
the original source revisions named by the scientific reports.

The bundle requires public base commit `c843381f671565ec7b96865bd7ec7f8b0f29e1b4`. To recover the
original branch in a checkout of this repository:

```sh
git bundle verify downloads/power-garden/Power-Garden-Source-History.bundle
git fetch downloads/power-garden/Power-Garden-Source-History.bundle research/power-garden-standalone:refs/heads/preserved/power-garden-original
```

Bundle SHA-256: `46a908baf434d13f48d2cf3e209e544476aec809fd9eff7d70978bda573e54f6`.
Earlier baselines, scientific records, negative results, and paired histories
are preserved; the publication does not change engine equations or claim new
neural or semantic validation.
