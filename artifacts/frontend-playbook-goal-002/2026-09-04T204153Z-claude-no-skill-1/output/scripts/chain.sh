#!/usr/bin/env bash
# Starts a local anvil node forking Base, so the real USDC contract at
# 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 exists locally with its real code.
#
# The chain id is deliberately 31337 rather than Base's 8453 so a browser wallet
# never confuses this node with the real network.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd anvil "Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup"

log "Forking Base from $FORK_URL (chain id $CHAIN_ID) on $RPC_URL"
exec anvil \
  --fork-url "$FORK_URL" \
  --chain-id "$CHAIN_ID" \
  --host 127.0.0.1 \
  --port "${PORT:-8545}" \
  "$@"
