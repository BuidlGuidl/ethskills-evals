#!/usr/bin/env bash
# Seed a local anvil deployment with members, tools and finished loans.
#
#   anvil                                        # terminal 1
#   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
#   TOOLSHED=0x... USDC=0x... ./script/seed-local.sh
set -euo pipefail

RPC="${RPC_URL:-http://127.0.0.1:8545}"
: "${TOOLSHED:?set TOOLSHED to the deployed Toolshed address}"
: "${USDC:?set USDC to the deployed MockUSDC address}"
export TOOLSHED USDC

forge script script/SeedLocal.s.sol --sig 'stage1()' --rpc-url "$RPC" --broadcast

# Jump the chain clock four days so one of the loans is genuinely overdue.
cast rpc --rpc-url "$RPC" evm_increaseTime 345600 >/dev/null
cast rpc --rpc-url "$RPC" evm_mine >/dev/null

forge script script/SeedLocal.s.sol --sig 'stage2()' --rpc-url "$RPC" --broadcast

echo "Seeded. Toolshed=$TOOLSHED USDC=$USDC"
