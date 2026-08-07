#!/usr/bin/env bash
#
# Seed local test identities with USDC on a local Base fork.
#
# The fork mirrors real Base state, so the real USDC contract is present — but
# the Anvil test accounts hold no USDC. This mints USDC to them by impersonating
# Circle's `masterMinter` role, which is only possible on the fork. Nothing here
# touches mainnet or real funds.
#
# Prereqs: a Base fork running (`yarn fork base`) on http://127.0.0.1:8545.
# Usage:   bash packages/foundry/scripts-js/seed-usdc.sh [amount_usdc]
#
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8545}
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
AMOUNT_USDC=${1:-100}
AMOUNT=$((AMOUNT_USDC * 1000000)) # USDC has 6 decimals

# Anvil default accounts #0 (Alice) and #1 (Bob).
ALICE=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
BOB=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
ALICE_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
BOB_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

MASTER=$(cast call "$USDC" "masterMinter()(address)" --rpc-url "$RPC")
echo "USDC masterMinter: $MASTER"

# Give the masterMinter gas, then impersonate it to authorize Alice & Bob as minters.
cast rpc anvil_setBalance "$MASTER" 0xDE0B6B3A7640000 --rpc-url "$RPC" >/dev/null
cast rpc anvil_impersonateAccount "$MASTER" --rpc-url "$RPC" >/dev/null
cast send "$USDC" "configureMinter(address,uint256)" "$ALICE" "$AMOUNT" --from "$MASTER" --unlocked --rpc-url "$RPC" >/dev/null
cast send "$USDC" "configureMinter(address,uint256)" "$BOB" "$AMOUNT" --from "$MASTER" --unlocked --rpc-url "$RPC" >/dev/null
cast rpc anvil_stopImpersonatingAccount "$MASTER" --rpc-url "$RPC" >/dev/null

# Each authorized minter mints to itself.
cast send "$USDC" "mint(address,uint256)" "$ALICE" "$AMOUNT" --private-key "$ALICE_PK" --rpc-url "$RPC" >/dev/null
cast send "$USDC" "mint(address,uint256)" "$BOB" "$AMOUNT" --private-key "$BOB_PK" --rpc-url "$RPC" >/dev/null

echo "Alice ($ALICE) USDC: $(cast call "$USDC" "balanceOf(address)(uint256)" "$ALICE" --rpc-url "$RPC")"
echo "Bob   ($BOB) USDC: $(cast call "$USDC" "balanceOf(address)(uint256)" "$BOB" --rpc-url "$RPC")"
echo "Done. Seeded ${AMOUNT_USDC} USDC to each test identity on the fork."
