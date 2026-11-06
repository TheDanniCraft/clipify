#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -eq 0 ]; then echo 'An installation command is required.' >&2; exit 64; fi
config="$(mktemp)"
trap 'rm -f "$config"' EXIT
# Hosted runners are disposable; avoid the Azure mirror that stalled media downloads.
if [ "${GITHUB_ACTIONS:-false}" = true ]; then
  sudo sed -i 's|://azure.archive.ubuntu.com/ubuntu|://archive.ubuntu.com/ubuntu|g' /etc/apt/sources.list.d/ubuntu.sources
fi
cat > "$config" <<'APT'
Acquire::Retries "2";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
DPkg::Lock::Timeout "60";
Dpkg::Use-Pty "0";
APT::Update::Error-Mode "any";
APT
# Bound the whole command too: per-request timeouts do not bound a stalled installer.
status=0
sudo env APT_CONFIG="$config" DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a timeout --signal=TERM --kill-after=15s 180s "$@" || status=$?
if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
  echo "Dependency installation exceeded its three-minute deadline; check package mirrors or package-manager locks." >&2
fi
exit "$status"
