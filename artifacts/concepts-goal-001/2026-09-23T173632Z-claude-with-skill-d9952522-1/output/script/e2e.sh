#!/usr/bin/env bash
# End-to-end smoke test on a local anvil: deploy, subscribe, check the gate the
# API backend actually uses, cancel, refund. Run it before any real deployment
# and after any contract change.
#
#   ./script/e2e.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=${ANVIL_PORT:-8599}
RPC=http://127.0.0.1:$PORT
# anvil's first two default accounts.
DEPLOYER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CUSTOMER_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
CUSTOMER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

cleanup() { [[ -n "${ANVIL_PID:-}" ]] && kill "$ANVIL_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "== starting anvil"
anvil --silent --port "$PORT" &
ANVIL_PID=$!
until cast block-number --rpc-url $RPC >/dev/null 2>&1; do sleep 0.2; done

echo "== deploying mock USDC"
USDC=$(forge create test/mocks/MockUSDC.sol:MockUSDC \
  --rpc-url $RPC --private-key $DEPLOYER_PK --broadcast --json | jq -r .deployedTo)
echo "   USDC: $USDC"

echo "== deploying billing"
BILLING=$(USDC=$USDC forge script script/Deploy.s.sol:Deploy \
  --rpc-url $RPC --private-key $DEPLOYER_PK --broadcast --silent >/dev/null 2>&1; \
  jq -r '[.transactions[] | select(.contractName=="SubscriptionBilling")][0].contractAddress' \
  broadcast/Deploy.s.sol/31337/run-latest.json)
echo "   billing: $BILLING"

echo "== funding the customer with 50 USDC and subscribing to hobby (plan 1)"
cast send "$USDC" "mint(address,uint256)" "$CUSTOMER" 50000000 \
  --rpc-url $RPC --private-key $DEPLOYER_PK --json >/dev/null
cast send "$USDC" "approve(address,uint256)" "$BILLING" 50000000 \
  --rpc-url $RPC --private-key $CUSTOMER_PK --json >/dev/null
cast send "$BILLING" "deposit(uint256)" 50000000 \
  --rpc-url $RPC --private-key $CUSTOMER_PK --json >/dev/null
cast send "$BILLING" "subscribe(uint32)" 1 \
  --rpc-url $RPC --private-key $CUSTOMER_PK --json >/dev/null

check() { cast call "$BILLING" "isSubscribed(address)(bool)" "$CUSTOMER" --rpc-url $RPC; }
avail() { cast call "$BILLING" "availableBalance(address)(uint256)" "$CUSTOMER" --rpc-url $RPC; }

echo "   isSubscribed: $(check)   (expect true)"
[[ "$(check)" == "true" ]] || { echo "FAIL: should be subscribed"; exit 1; }

echo "== reading it through the backend gate module (same call the API makes)"
RPC_URL=$RPC BILLING_ADDRESS=$BILLING CUSTOMER=$CUSTOMER node backend/checkOnce.js

echo "== fast-forwarding 15 days"
cast rpc anvil_increaseTime 1296000 --rpc-url $RPC >/dev/null
cast rpc anvil_mine --rpc-url $RPC >/dev/null
# Tolerance of $0.001: anvil advances a few extra seconds while mining the
# transactions above, and those seconds are genuinely billable.
near() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a-b<1000 && b-a<1000)}'; }
AVAIL=$(avail | awk '{print $1}')
echo "   available balance: $AVAIL  (expect ~47500000 = 50 - 2.50)"
near "$AVAIL" 47500000 || { echo "FAIL: wrong accrual"; exit 1; }

echo "== cancelling and refunding"
cast send "$BILLING" "cancelAndWithdraw(address)" "$CUSTOMER" \
  --rpc-url $RPC --private-key $CUSTOMER_PK --json >/dev/null
REFUNDED=$(cast call "$USDC" "balanceOf(address)(uint256)" "$CUSTOMER" --rpc-url $RPC | awk '{print $1}')
echo "   customer USDC after refund: $REFUNDED  (expect ~47500000)"
near "$REFUNDED" 47500000 || { echo "FAIL: wrong refund"; exit 1; }
echo "   isSubscribed: $(check)   (expect false)"
[[ "$(check)" == "false" ]] || { echo "FAIL: should be cancelled"; exit 1; }

echo "== settling and paying out revenue"
cast send "$BILLING" "settle(address)" "$CUSTOMER" --rpc-url $RPC --private-key $DEPLOYER_PK --json >/dev/null
REVENUE=$(cast call "$BILLING" "collectedRevenue()(uint256)" --rpc-url $RPC | awk '{print $1}')
echo "   collectedRevenue: $REVENUE  (expect ~2500000)"
near "$REVENUE" 2500000 || { echo "FAIL: wrong revenue"; exit 1; }
echo "   customer refund + operator revenue == 50 USDC deposited"

echo
echo "e2e OK"
