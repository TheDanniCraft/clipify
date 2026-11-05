#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
bash "$script_dir/install-frame-deps.sh"
dependencies="$(paste -sd, "$(dirname "$RUNNER_CHROME_PATH")/deb.deps")"
if ! command -v dpkg-checkbuilddeps >/dev/null || ! dpkg-checkbuilddeps -I -d "$dependencies" /dev/null; then
  bash "$script_dir/install-ci-deps.sh" apt-get update
  bash "$script_dir/install-ci-deps.sh" apt-get satisfy -y --no-install-recommends "$dependencies"
fi
