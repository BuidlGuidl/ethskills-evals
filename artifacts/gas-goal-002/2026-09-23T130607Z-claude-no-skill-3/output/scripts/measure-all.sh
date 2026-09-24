#!/usr/bin/env bash
# Regenerates every measurement in data/ from live Base mainnet + a fork.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data

echo "[1/4] sampling live ERC-20 transfers on Base..."
node scripts/sample-transfers.mjs > data/measurements-network.json

echo "[2/4] sampling priority fees and block fullness..."
node scripts/priority-floor.mjs > data/measurements-fees.json

echo "[3/4] benchmarking batch sizes on a Base fork (slow)..."
./scripts/with-fork.sh node scripts/sweep.mjs > data/measurements-sweep.json

echo "[4/4] assembling cost model..."
node scripts/assemble.mjs
node scripts/cost-model.mjs > /dev/null
echo "done -> data/cost-model.json"
