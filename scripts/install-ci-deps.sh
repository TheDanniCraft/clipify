#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -eq 0 ]; then echo 'An installation command is required.' >&2; exit 64; fi
config="$(mktemp)"
trap 'rm -f "$config"' EXIT
cat > "$config" <<'APT'
Acquire::Retries "2";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
DPkg::Lock::Timeout "60";
Dpkg::Use-Pty "0";
APT::Update::Error-Mode "any";
APT
# Keep GitHub's managed mirror list intact. It provides regional fallbacks, while
# forcing archive.ubuntu.com has caused DNS failures on hosted Ubuntu 26 runners.
# Bound the whole command too: per-request timeouts do not bound a stalled installer.
status=0
sudo env APT_CONFIG="$config" DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a timeout --signal=TERM --kill-after=15s 600s "$@" || status=$?
if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
  echo "Dependency installation exceeded its ten-minute deadline; check package mirrors or package-manager locks." >&2
fi
exit "$status"
