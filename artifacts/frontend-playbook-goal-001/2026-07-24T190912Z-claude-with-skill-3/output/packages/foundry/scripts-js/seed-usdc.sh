#!/usr/bin/env bash
#
# Seed test identities with REAL Base USDC on the local fork.
#
# Why this is safe: everything runs against a local Anvil fork of Base (chain id
# 31337). The USDC contract's real bytecode and state are copied from Base, but any
# writes stay local — no transaction ever touches Base mainnet, so no real money is
# at risk. We use USDC's own masterMinter (impersonated on the fork) to mint fresh
# balances, so seeding never depends on any whale's balance.
#
# Usage (fork must already be running via `yarn fork --network base`):
#   bash packages/foundry/scripts-js/seed-usdc.sh [address ...]
#
#   # no args -> seeds Anvil's default accounts #0 and #1
#   bash packages/foundry/scripts-js/seed-usdc.sh
#
#   # seed a specific wallet (e.g. the burner address shown in the app)
#   bash packages/foundry/scripts-js/seed-usdc.sh 0xYourBurnerAddress
#
# Env:
#   RPC     RPC url of the fork          (default http://127.0.0.1:8545)
#   AMOUNT  USDC per account, base units (default 1000000000 = 1,000 USDC)
set -euo pipefail

RPC="${RPC:-http://127.0.0.1:8545}"
USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
AMOUNT="${AMOUNT:-1000000000}" # 1,000 USDC (6 decimals)
ONE_ETH="0xDE0B6B3A7640000" # 1 ETH in wei, for gas

# Anvil's first two deterministic accounts (private keys are public knowledge —
# perfect throwaway "test identities" for a demo).
DEFAULT_ACCOUNTS=(
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
)

if [ "$#" -gt 0 ]; then
  ACCOUNTS=("$@")
else
  ACCOUNTS=("${DEFAULT_ACCOUNTS[@]}")
fi

echo "Fork RPC: $RPC"
if ! cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "❌ Can't reach the fork at $RPC. Start it first: yarn fork --network base" >&2
  exit 1
fi

# The masterMinter can authorize new minters. We impersonate it, make Anvil account #0
# a minter, then mint USDC from #0 to every target account.
MINTER="${DEFAULT_ACCOUNTS[0]}"
MASTER="$(cast call "$USDC" "masterMinter()(address)" --rpc-url "$RPC")"
echo "USDC masterMinter: $MASTER"

# Fund the accounts that need to send txs with gas money.
for a in "$MASTER" "$MINTER" "${ACCOUNTS[@]}"; do
  cast rpc anvil_setBalance "$a" "$ONE_ETH" --rpc-url "$RPC" >/dev/null
done

cast rpc anvil_impersonateAccount "$MASTER" --rpc-url "$RPC" >/dev/null
cast send "$USDC" "configureMinter(address,uint256)" "$MINTER" \
  1000000000000000 --from "$MASTER" --unlocked --rpc-url "$RPC" >/dev/null
cast rpc anvil_stopImpersonatingAccount "$MASTER" --rpc-url "$RPC" >/dev/null

cast rpc anvil_impersonateAccount "$MINTER" --rpc-url "$RPC" >/dev/null
for a in "${ACCOUNTS[@]}"; do
  cast send "$USDC" "mint(address,uint256)" "$a" "$AMOUNT" \
    --from "$MINTER" --unlocked --rpc-url "$RPC" >/dev/null
done
cast rpc anvil_stopImpersonatingAccount "$MINTER" --rpc-url "$RPC" >/dev/null

echo "Seeded (USDC base units, 6 decimals):"
for a in "${ACCOUNTS[@]}"; do
  bal="$(cast call "$USDC" "balanceOf(address)(uint256)" "$a" --rpc-url "$RPC")"
  echo "  $a -> ${bal%% *}"
done
echo "Done. These identities can now send tips on the local fork."
