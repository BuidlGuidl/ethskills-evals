#!/usr/bin/env bash
# Gives the local dev accounts spendable USDC on the forked chain.
#
# Rather than draining a whale (whose balance changes block to block), this asks
# USDC's own masterMinter -- impersonated, which only anvil allows -- to grant the
# first dev account minting rights, then mints. That works at any fork block.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

AMOUNT_USDC="${AMOUNT_USDC:-10000}"          # whole USDC per dev account
AMOUNT_UNITS=$((AMOUNT_USDC * 1000000))      # USDC has 6 decimals
MINT_ALLOWANCE=1000000000000000              # 1e9 USDC of minting headroom

require_chain
require_forked_usdc

MASTER_MINTER="$(cast call "$USDC_ADDRESS" "masterMinter()(address)" --rpc-url "$RPC_URL")"
log "USDC masterMinter: $MASTER_MINTER"

# Impersonate the masterMinter just long enough to authorise our dev minter.
cast rpc anvil_impersonateAccount "$MASTER_MINTER" --rpc-url "$RPC_URL" >/dev/null
cast rpc anvil_setBalance "$MASTER_MINTER" 0xde0b6b3a7640000 --rpc-url "$RPC_URL" >/dev/null

cast send "$USDC_ADDRESS" "configureMinter(address,uint256)" "$ACCOUNT_0" "$MINT_ALLOWANCE" \
  --from "$MASTER_MINTER" --unlocked --rpc-url "$RPC_URL" >/dev/null

cast rpc anvil_stopImpersonatingAccount "$MASTER_MINTER" --rpc-url "$RPC_URL" >/dev/null

for account in "$ACCOUNT_0" "$ACCOUNT_1" "$ACCOUNT_2"; do
  cast send "$USDC_ADDRESS" "mint(address,uint256)" "$account" "$AMOUNT_UNITS" \
    --private-key "$KEY_0" --rpc-url "$RPC_URL" >/dev/null
  balance="$(cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$account" --rpc-url "$RPC_URL" | cut -d' ' -f1)"
  log "$account now holds $(cast to-unit "$balance" mwei) USDC"
done
