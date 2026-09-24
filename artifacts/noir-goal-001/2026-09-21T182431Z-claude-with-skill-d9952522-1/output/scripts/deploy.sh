#!/usr/bin/env bash
# Deploy NFT (local only) + HonkVerifier + MemberRegistry + AnonymousVoting and wire them.
# Writes deployments/<chainId>.json. See contracts/script/Deploy.s.sol for env vars.
set -euo pipefail
cd "$(dirname "$0")/../contracts"
mkdir -p ../deployments
forge script script/Deploy.s.sol --rpc-url "${RPC_URL:-http://127.0.0.1:8545}" --broadcast "$@"
