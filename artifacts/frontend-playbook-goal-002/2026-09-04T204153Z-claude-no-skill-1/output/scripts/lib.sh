#!/usr/bin/env bash
# Shared helpers and local-chain constants.

set -euo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="${CHAIN_ID:-31337}"
FORK_URL="${FORK_URL:-https://mainnet.base.org}"

# Canonical Circle USDC on Base. Present on the local chain because anvil forks Base.
USDC_ADDRESS="${USDC_ADDRESS:-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"

# anvil's first three deterministic dev accounts.
ACCOUNT_0="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
ACCOUNT_1="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
ACCOUNT_2="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
KEY_0="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
KEY_1="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
KEY_2="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log()  { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33m warn\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31merror\033[0m %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed. $2"
}

require_chain() {
  require_cmd cast "Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  local id
  id="$(cast chain-id --rpc-url "$RPC_URL" 2>/dev/null)" \
    || die "No chain at $RPC_URL. Start one first: npm run chain"
  [ "$id" = "$CHAIN_ID" ] \
    || warn "Chain at $RPC_URL reports id $id, expected $CHAIN_ID."
}

require_forked_usdc() {
  local code
  code="$(cast code "$USDC_ADDRESS" --rpc-url "$RPC_URL")"
  [ "$code" != "0x" ] \
    || die "No USDC at $USDC_ADDRESS on $RPC_URL. The local chain must fork Base: npm run chain"
}
