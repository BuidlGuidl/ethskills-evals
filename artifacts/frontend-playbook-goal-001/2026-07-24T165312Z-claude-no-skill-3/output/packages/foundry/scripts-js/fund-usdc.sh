#!/usr/bin/env bash
#
# Fund test identities with real Base USDC on a local Base fork.
#
# The jar accepts the canonical Base USDC contract. On a fork that contract and
# all of its balances/logic are the real thing, so we hand test accounts USDC by
# impersonating USDC's on-chain masterMinter, registering a local minter, and
# minting into the fork. No mainnet transaction is sent and no real money moves.
#
# Usage:
#   yarn fund                         # fund the default anvil accounts (100 USDC each)
#   yarn fund 0xYourBurnerAddress     # also fund a specific address (e.g. your browser burner)
#   AMOUNT=250 yarn fund 0xAbc...     # fund with a custom USDC amount
#
# Requires a running Base fork (see `yarn fork`) reachable at $RPC_URL.
set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
USDC="${USDC_ADDRESS:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"
AMOUNT_USDC="${AMOUNT:-100}"

# Anvil account #0 — funded with ETH on any anvil chain, used here as the local USDC minter.
MINTER="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
MINTER_PK="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Default recipients: anvil accounts #0, #1, #2 and the default deployer (#9).
DEFAULT_RECIPIENTS=(
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"
)
RECIPIENTS=("${DEFAULT_RECIPIENTS[@]}" "$@")

# USDC has 6 decimals.
AMOUNT_BASE=$(awk "BEGIN { printf \"%d\", $AMOUNT_USDC * 1000000 }")

echo "→ Fork RPC:        $RPC_URL"
echo "→ USDC:            $USDC"
echo "→ Amount each:     $AMOUNT_USDC USDC ($AMOUNT_BASE base units)"

# Confirm we are talking to a fork that actually has the USDC contract deployed.
if [ "$(cast code "$USDC" --rpc-url "$RPC_URL")" = "0x" ]; then
  echo "✗ No contract at $USDC on $RPC_URL — is your Base fork running? (yarn fork)" >&2
  exit 1
fi

MASTER_MINTER=$(cast call "$USDC" "masterMinter()(address)" --rpc-url "$RPC_URL")
echo "→ masterMinter:    $MASTER_MINTER"

# Impersonate the masterMinter and give it gas money on the fork.
cast rpc anvil_impersonateAccount "$MASTER_MINTER" --rpc-url "$RPC_URL" >/dev/null
cast rpc anvil_setBalance "$MASTER_MINTER" 0xDE0B6B3A7640000 --rpc-url "$RPC_URL" >/dev/null # 1 ETH

# Authorize our local minter with a generous allowance.
cast send "$USDC" "configureMinter(address,uint256)" "$MINTER" 1000000000000000 \
  --from "$MASTER_MINTER" --unlocked --rpc-url "$RPC_URL" >/dev/null

cast rpc anvil_stopImpersonatingAccount "$MASTER_MINTER" --rpc-url "$RPC_URL" >/dev/null

# Mint to each recipient from the (real, signed) minter account.
for addr in "${RECIPIENTS[@]}"; do
  cast send "$USDC" "mint(address,uint256)" "$addr" "$AMOUNT_BASE" \
    --private-key "$MINTER_PK" --rpc-url "$RPC_URL" >/dev/null
  bal=$(cast call "$USDC" "balanceOf(address)(uint256)" "$addr" --rpc-url "$RPC_URL" | cut -d' ' -f1)
  printf "  ✓ %s  →  %s USDC\n" "$addr" "$(awk "BEGIN { printf \"%.2f\", $bal / 1000000 }")"
done

echo "✓ Done. Connect one of these accounts in the app and send a tip."
