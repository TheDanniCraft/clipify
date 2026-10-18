# Runner test-first evidence

The canonical state is in `../test-traceability.md`, `../defect-log.md`, `../test-summary.md` and `cycle-log.md`. `evidence.tar.gz` preserves the original text Red/Green/refactor outputs, rejected attempts, structured owning results and exact source/input manifests. `evidence-manifest.json` records every path, size and SHA256 plus the archive digest. A failed or flaky attempt is historical evidence, never a qualifying pass.

To inspect the complete evidence without overwriting newer workspace reports:

```sh
mkdir -p /tmp/clipify-runner-evidence-review
tar -xzf specs/004-runner-free-pro/tdd/evidence.tar.gz -C /tmp/clipify-runner-evidence-review
```

Archive paths are relative to this directory. Registry `tdd/evidence/...` references resolve under the extracted `evidence/` directory. To restore missing historical paths in a clean checkout, extract into `specs/004-runner-free-pro/tdd` after confirming no newer evidence will be overwritten. The small final gate/review records and public pricing screenshots are also tracked directly. Generated coverage, HTML reports, video, executable binaries and crash dumps stay outside Git; owning CI jobs retain their raw artifacts under the existing retention policy.
