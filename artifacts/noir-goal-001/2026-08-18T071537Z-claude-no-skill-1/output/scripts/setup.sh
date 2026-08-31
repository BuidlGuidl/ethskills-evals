#!/usr/bin/env bash
# One-time setup: Node dependencies and forge-std. Idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for tool in nargo bb forge node; do
  command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }
done

if [ ! -d "$ROOT/node_modules" ]; then
  echo "==> npm install"
  (cd "$ROOT" && npm install)
fi

if [ ! -d "$ROOT/contracts/lib/forge-std" ]; then
  echo "==> vendoring forge-std"
  git clone --depth 1 --branch v1.11.0 https://github.com/foundry-rs/forge-std \
    "$ROOT/contracts/lib/forge-std"
  rm -rf "$ROOT/contracts/lib/forge-std/.git"
fi

echo "==> ready. Next:  ./scripts/build-circuit.sh  then  ./scripts/walkthrough.sh"
