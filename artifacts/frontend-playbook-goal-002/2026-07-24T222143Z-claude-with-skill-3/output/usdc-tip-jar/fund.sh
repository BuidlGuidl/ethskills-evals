#!/usr/bin/env bash
#
# Fund a local address with test USDC (and ETH for gas) on the running Base fork.
#
# The fork has *real* Base USDC, but your wallet starts with none. This writes a
# USDC balance directly into the fork's state (via anvil_setStorageAt) and tops
# up ETH so you can actually send a tip.
#
# Usage:
#   ./fund.sh <address> [usdc_amount]
# Example:
#   ./fund.sh 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 1000
#
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8545}
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

ADDR=${1:-}
AMOUNT=${2:-1000} # whole USDC

if [ -z "$ADDR" ]; then
  echo "usage: ./fund.sh <address> [usdc_amount]" >&2
  exit 1
fi

# USDC on Base is a FiatTokenV2_2 proxy; its balance mapping lives at storage
# slot 9. keccak256(abi.encode(addr, 9)) is the slot holding that address's balance.
SLOT=$(cast index address "$ADDR" 9)
RAW=$((AMOUNT * 1000000)) # USDC has 6 decimals

cast rpc anvil_setStorageAt "$USDC" "$SLOT" "$(cast to-uint256 "$RAW")" --rpc-url "$RPC" >/dev/null
cast rpc anvil_setBalance "$ADDR" "$(cast to-uint256 "$(cast to-wei 10 ether)")" --rpc-url "$RPC" >/dev/null

BAL=$(cast call "$USDC" "balanceOf(address)(uint256)" "$ADDR" --rpc-url "$RPC")
echo "Funded $ADDR"
echo "  USDC balance: $BAL (raw, 6 decimals) = ${AMOUNT} USDC"
echo "  ETH balance:  10 ETH (for gas)"
