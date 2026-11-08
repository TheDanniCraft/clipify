#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
font_dir="${1:-/usr/share/fonts/truetype/dejavu}"
if ! test -f "$font_dir/DejaVuSans.ttf"; then
  sudo install -d "$font_dir"
  sudo install -m 644 "$script_dir"/../public/fonts/brand/*.ttf "$font_dir/"
fi
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  bash "$script_dir/install-ci-deps.sh" apt-get update
  bash "$script_dir/install-ci-deps.sh" apt-get install -y --no-install-recommends ffmpeg
fi
ffmpeg -version
ffprobe -version
