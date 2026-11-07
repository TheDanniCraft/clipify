#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=30000 timeout --kill-after=15s 180s node node_modules/@playwright/test/cli.js install chromium
verify() {
  timeout --kill-after=5s 30s node -e 'require("@playwright/test").chromium.launch({headless:true,timeout:15000}).then(browser=>browser.close()).catch(error=>{console.error(error.message);process.exitCode=1})'
}
# A dry run only prints package commands; a launch actually verifies shared libraries.
if ! verify; then
  bash "$script_dir/install-ci-deps.sh" "$(command -v node)" node_modules/@playwright/test/cli.js install-deps chromium
  verify
fi
