#!/usr/bin/env bash
# Starts a fresh Base mainnet fork on :8545, runs the given command, tears it down.
# A fresh node each time keeps nonces and balances reproducible between runs.
set -euo pipefail
RPC="${BASE_RPC:-https://mainnet.base.org}"
PORT="${FORK_PORT:-8545}"

cleanup() { [[ -n "${ANVIL_PID:-}" ]] && kill "$ANVIL_PID" 2>/dev/null || true; }
trap cleanup EXIT

# free the port if a previous run left something behind
fuser -k "$PORT"/tcp >/dev/null 2>&1 || true
sleep 1
anvil --fork-url "$RPC" --port "$PORT" --silent --gas-limit 400000000 >/tmp/anvil.log 2>&1 &
ANVIL_PID=$!

for i in $(seq 1 60); do
  if curl -s -X POST "http://127.0.0.1:$PORT" -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' 2>/dev/null | grep -q result; then
    break
  fi
  sleep 1
done

"$@"
