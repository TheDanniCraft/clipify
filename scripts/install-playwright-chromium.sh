#!/usr/bin/env bash
set -euo pipefail

# Cached browser binaries do not establish that this runner has their OS libraries.
if ! node node_modules/@playwright/test/cli.js install-deps --dry-run chromium; then
  node node_modules/@playwright/test/cli.js install-deps chromium
fi
node node_modules/@playwright/test/cli.js install chromium
