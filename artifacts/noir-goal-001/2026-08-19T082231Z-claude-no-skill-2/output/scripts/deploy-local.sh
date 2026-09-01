#!/usr/bin/env bash
# Stand the contracts up on a local chain and write deployments/local.json.
#
# Starts anvil if nothing is already listening on the RPC port, then runs
# script/Deploy.s.sol, which deploys and wires:
#
#   MembershipNFT  --gate-->  MemberRegistry  --root-->  PrivateBallot  <--proofs--  HonkVerifier
#
# Usage: bash scripts/deploy-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
PORT="${PORT:-8545}"
MEMBER_COUNT="${MEMBER_COUNT:-8}"
ANVIL_LOG="${ANVIL_LOG:-/tmp/anvil-dao-ballot.log}"

cd "$ROOT"
mkdir -p deployments

if [ ! -f "src/verifiers/HonkVerifier.sol" ]; then
  echo "no verifier contract yet - running scripts/build-circuit.sh"
  bash scripts/build-circuit.sh
fi

ANVIL_PID=""
if curl -s -m 2 -X POST -H 'Content-Type: application/json' \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' "$RPC_URL" >/dev/null 2>&1; then
  echo "==> using the chain already listening on $RPC_URL"
else
  echo "==> starting anvil on port $PORT (log: $ANVIL_LOG)"
  # Detached, so the chain outlives this script and you can keep using it.
  if command -v setsid >/dev/null 2>&1; then
    setsid anvil --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 &
  else
    nohup anvil --port "$PORT" --silent >"$ANVIL_LOG" 2>&1 &
  fi
  ANVIL_PID=$!
  disown "$ANVIL_PID" 2>/dev/null || true
  for _ in $(seq 1 50); do
    if curl -s -m 1 -X POST -H 'Content-Type: application/json' \
         --data '{"jsonrpc":"2.0","method":"eth_chainId","id":1}' "$RPC_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
  echo "    anvil pid $ANVIL_PID"
fi

echo "==> forge script Deploy"
MEMBER_COUNT="$MEMBER_COUNT" forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" --broadcast --skip-simulation -vv

echo
echo "==> deployments/local.json"
cat deployments/local.json
echo

if [ -n "$ANVIL_PID" ]; then
  echo "anvil is still running as pid $ANVIL_PID (kill it with: kill $ANVIL_PID)"
fi
