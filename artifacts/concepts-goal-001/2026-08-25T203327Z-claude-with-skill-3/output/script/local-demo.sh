#!/usr/bin/env bash
# End-to-end walkthrough on a local anvil: deploy, subscribe, get served, run out of money,
# get refused, cancel, get refunded, and collect revenue as the operator.
#
#   ./script/local-demo.sh
#
# Nothing here needs a testnet or a faucet. It is also the fastest way to see the point of the
# design: between "subscribed" and "lapsed" nobody sends a transaction. Time passes, that is all.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC=http://127.0.0.1:8545
OPERATOR_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
OPERATOR=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
CUSTOMER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
CUSTOMER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
PORT=8787

say() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
usd() { printf '$%s.%02d\n' "$(( $1 / 1000000 ))" "$(( ($1 % 1000000) / 10000 ))"; }

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${ANVIL_PID:-}" ]] && kill "$ANVIL_PID" 2>/dev/null || true
}
trap cleanup EXIT

say "starting anvil"
anvil --silent --port 8545 &
ANVIL_PID=$!
until cast block-number --rpc-url $RPC >/dev/null 2>&1; do sleep 0.2; done

say "deploying a mock USDC (on a real chain you would point at Circle's)"
USDC=$(forge create test/mocks/MockUSDC.sol:MockUSDC --rpc-url $RPC --private-key $OPERATOR_KEY --broadcast --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["deployedTo"])')
echo "USDC: $USDC"

say "deploying SubscriptionBilling"
export USDC_ADDRESS=$USDC BILLING_OWNER=$OPERATOR
forge script script/Deploy.s.sol --rpc-url $RPC --private-key $OPERATOR_KEY --broadcast --silent
BILLING=$(python3 -c 'import json; print(json.load(open("deployments/31337.json"))["billing"])')
echo "billing: $BILLING"

say "customer tops up \$7 and subscribes to the \$5/month hobby plan"
cast send "$USDC" "mint(address,uint256)" $CUSTOMER 7000000 --rpc-url $RPC --private-key $OPERATOR_KEY >/dev/null
cast send "$USDC" "approve(address,uint256)" "$BILLING" 7000000 --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
cast send "$BILLING" "subscribe(uint32,uint256)" 1 7000000 --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
echo "subscribed: $(cast call "$BILLING" "isSubscribed(address)(bool)" $CUSTOMER --rpc-url $RPC)"
echo "paid through block-time: $(cast call "$BILLING" "expiresAt(address)(uint256)" $CUSTOMER --rpc-url $RPC)"

say "starting the weather API in front of it"
BILLING_ADDRESS=$BILLING RPC_URL=$RPC CHAIN_ID=31337 PORT=$PORT GATE_TTL_SECONDS=0 \
  SESSION_SECRET=demo-secret-that-is-long-enough-32ch \
  node --experimental-strip-types backend/src/server.ts &
API_PID=$!
until curl -sf "http://127.0.0.1:$PORT/nonce?address=$CUSTOMER" >/dev/null 2>&1; do sleep 0.3; done

sign_in() {
  local msg token
  msg=$(curl -s "http://127.0.0.1:$PORT/nonce?address=$CUSTOMER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["message"])')
  local sig
  sig=$(cast wallet sign --private-key $CUSTOMER_KEY "$msg")
  token=$(curl -s -X POST "http://127.0.0.1:$PORT/session" -H 'content-type: application/json' \
    -d "{\"address\":\"$CUSTOMER\",\"signature\":\"$sig\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))')
  [[ -n "$token" ]] || { echo "sign-in failed"; exit 1; }
  echo "$token"
}

say "customer signs in and calls the API"
TOKEN=$(sign_in)
curl -s -o /dev/null -w 'GET /v1/forecast -> %{http_code}\n' \
  -H "authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/v1/forecast?city=Berlin"
curl -s -H "authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/v1/forecast?city=Berlin"; echo

say "20 days pass — nobody sends a transaction, the charge accrues anyway"
cast rpc evm_increaseTime 1728000 --rpc-url $RPC >/dev/null
cast rpc evm_mine --rpc-url $RPC >/dev/null
echo "consumed so far : $(usd "$(cast call "$BILLING" "pendingCharge(address)(uint256)" $CUSTOMER --rpc-url $RPC | cut -d' ' -f1)")"
echo "refundable now  : $(usd "$(cast call "$BILLING" "refundable(address)(uint256)" $CUSTOMER --rpc-url $RPC | cut -d' ' -f1)")"
echo "still subscribed: $(cast call "$BILLING" "isSubscribed(address)(bool)" $CUSTOMER --rpc-url $RPC)"

say "another 30 days — the \$7 runs out mid-flight and access stops on its own"
cast rpc evm_increaseTime 2592000 --rpc-url $RPC >/dev/null
cast rpc evm_mine --rpc-url $RPC >/dev/null
echo "still subscribed: $(cast call "$BILLING" "isSubscribed(address)(bool)" $CUSTOMER --rpc-url $RPC)"
TOKEN=$(sign_in)
curl -s -o /dev/null -w 'GET /v1/forecast -> %{http_code} (402 = top up)\n' \
  -H "authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/v1/forecast?city=Berlin"

say "customer tops up \$10, is served again immediately"
cast send "$USDC" "mint(address,uint256)" $CUSTOMER 10000000 --rpc-url $RPC --private-key $OPERATOR_KEY >/dev/null
cast send "$USDC" "approve(address,uint256)" "$BILLING" 10000000 --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
cast send "$BILLING" "deposit(address,uint256)" $CUSTOMER 10000000 --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
TOKEN=$(sign_in)
curl -s -o /dev/null -w 'GET /v1/forecast -> %{http_code}\n' \
  -H "authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/v1/forecast?city=Berlin"

say "5 more days, then the customer cancels and takes back what they did not use"
cast rpc evm_increaseTime 432000 --rpc-url $RPC >/dev/null
cast rpc evm_mine --rpc-url $RPC >/dev/null
BEFORE=$(cast call "$USDC" "balanceOf(address)(uint256)" $CUSTOMER --rpc-url $RPC | cut -d' ' -f1)
cast send "$BILLING" "cancelAndWithdraw(address)" $CUSTOMER --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
AFTER=$(cast call "$USDC" "balanceOf(address)(uint256)" $CUSTOMER --rpc-url $RPC | cut -d' ' -f1)
echo "refunded: $(usd $((AFTER - BEFORE)))"
TOKEN=$(sign_in)
curl -s -o /dev/null -w 'GET /v1/forecast -> %{http_code} (cancelled)\n' \
  -H "authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/v1/forecast?city=Berlin"

say "operator collects revenue for the time that was actually used"
BILLING_ADDRESS=$BILLING forge script script/Ops.s.sol:Collect --rpc-url $RPC --private-key $OPERATOR_KEY --broadcast --silent
echo "operator USDC: $(usd "$(cast call "$USDC" "balanceOf(address)(uint256)" $OPERATOR --rpc-url $RPC | cut -d' ' -f1)")"
echo "contract still holds: $(usd "$(cast call "$USDC" "balanceOf(address)(uint256)" "$BILLING" --rpc-url $RPC | cut -d' ' -f1)")"

say "done"
