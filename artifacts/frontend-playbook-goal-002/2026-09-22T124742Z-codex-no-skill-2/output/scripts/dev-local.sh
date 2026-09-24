#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  if [[ -n "${CHAIN_PID:-}" ]]; then
    kill "$CHAIN_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if node scripts/wait-for-rpc.js http://127.0.0.1:8545 1000 >/dev/null 2>&1; then
  echo "Using existing local JSON-RPC at http://127.0.0.1:8545"
else
  npx hardhat node --hostname 127.0.0.1 &
  CHAIN_PID=$!
fi

node scripts/wait-for-rpc.js http://127.0.0.1:8545
npx hardhat run scripts/deploy-local.js --network localhost
npx vite --host 127.0.0.1
