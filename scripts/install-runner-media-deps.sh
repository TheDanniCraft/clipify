#!/usr/bin/env bash
set -euo pipefail

dependencies="$(paste -sd, "$(dirname "$RUNNER_CHROME_PATH")/deb.deps")"
if ! command -v dpkg-checkbuilddeps >/dev/null || ! dpkg-checkbuilddeps -I -d "ffmpeg,$dependencies" /dev/null; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends ffmpeg
  sudo apt-get satisfy -y --no-install-recommends "$dependencies"
fi
ffmpeg -version
