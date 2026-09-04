#!/usr/bin/env bash
# End-to-end smoke test on a throwaway anvil: deploy, subscribe, sign in, get data, watch access
# expire on its own, cancel and get refunded.
#
# This is the one that catches the mistakes unit tests do not — an ABI that drifted from the
# contract, a cache that never invalidates, an auth message the wallet will not sign.
#
#   ./tools/e2e-local.sh
#
# Requires: foundry, node, curl, jq.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
RPC=http://127.0.0.1:8545
PORT=8899

# anvil default accounts #0 (operator) and #1 (customer).
OPERATOR_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CUSTOMER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
CUSTOMER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
MAX_UINT=115792089237316195423570985008687907853269984665640564039457584007913129639935

ANVIL_PID=""; SERVER_PID=""
cleanup() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
            [ -n "$ANVIL_PID" ] && kill "$ANVIL_PID" 2>/dev/null || true; }
trap cleanup EXIT

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

step "1. anvil"
anvil --port 8545 --silent > /tmp/e2e-anvil.log 2>&1 &
ANVIL_PID=$!
for _ in $(seq 1 40); do cast block-number --rpc-url $RPC >/dev/null 2>&1 && break; sleep 0.25; done
cast block-number --rpc-url $RPC >/dev/null || fail "anvil did not start"
pass "anvil listening on 8545"

step "2. deploy contracts"
OUT=$(forge script script/LocalDemo.s.sol --rpc-url $RPC --broadcast --private-key $OPERATOR_KEY 2>&1)
USDC=$(echo "$OUT" | grep -oP 'USDC\s+: \K0x[0-9a-fA-F]{40}' | head -1)
BILLING=$(echo "$OUT" | grep -oP 'BILLING_ADDRESS\s+: \K0x[0-9a-fA-F]{40}' | head -1)
[ -n "$BILLING" ] || { echo "$OUT" | tail -20; fail "deploy failed"; }
pass "billing=$BILLING usdc=$USDC"

step "3. customer subscribes to hobby with \$15 (three months)"
cast send "$USDC" "approve(address,uint256)" "$BILLING" $MAX_UINT --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
cast send "$BILLING" "subscribe(uint8,uint256)" 1 15000000 --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
[ "$(cast call "$BILLING" 'isSubscribed(address)(bool)' $CUSTOMER --rpc-url $RPC)" = "true" ] \
  || fail "contract says not subscribed"
pass "isSubscribed() == true onchain"

step "4. start the API"
cd "$ROOT/backend"
CHAIN_ID=31337 RPC_URL=$RPC BILLING_ADDRESS=$BILLING SESSION_SECRET=e2e-secret \
  PORT=$PORT CACHE_TTL_MS=500 WATCHER_STALE_MS=600000 QUOTA_HOBBY=5 \
  node src/server.js > /tmp/e2e-server.log 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep 0.25; done
curl -sf "http://127.0.0.1:$PORT/health" >/dev/null || { cat /tmp/e2e-server.log; fail "server did not start"; }
pass "API up on $PORT"

step "5. sign in with the wallet"
MSG=$(curl -s "http://127.0.0.1:$PORT/v1/auth/nonce?address=$CUSTOMER" | jq -r .message)
SIG=$(cast wallet sign --private-key $CUSTOMER_KEY "$MSG")
RESP=$(curl -s -X POST "http://127.0.0.1:$PORT/v1/auth/token" -H 'content-type: application/json' \
  -d "$(jq -nc --arg a "$CUSTOMER" --arg s "$SIG" '{address:$a,signature:$s}')")
TOKEN=$(echo "$RESP" | jq -r .token)
[ "$TOKEN" != "null" ] && [ -n "$TOKEN" ] || { echo "$RESP"; fail "could not get a token"; }
[ "$(echo "$RESP" | jq -r .subscription.subscribed)" = "true" ] || fail "token response says unsubscribed"
pass "signature verified, token issued, subscription confirmed"

step "6. a forged signature is refused"
OTHER=$(cast wallet sign --private-key $OPERATOR_KEY "$MSG" 2>/dev/null || echo 0x)
curl -s "http://127.0.0.1:$PORT/v1/auth/nonce?address=$CUSTOMER" >/dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/v1/auth/token" \
  -H 'content-type: application/json' -d "$(jq -nc --arg a "$CUSTOMER" --arg s "$OTHER" '{address:$a,signature:$s}')")
[ "$CODE" = "401" ] || fail "someone else's signature was accepted (got $CODE)"
pass "401 for a signature from the wrong key"

step "7. paid request succeeds"
BODY=$(curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/v1/forecast?lat=51.5&lon=-0.12")
echo "$BODY" | jq -e '.forecast | length == 3' >/dev/null || { echo "$BODY"; fail "no forecast returned"; }
pass "200 with a forecast"

step "8. no token, no data"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/v1/forecast?lat=51.5&lon=-0.12")
[ "$CODE" = "401" ] || fail "unauthenticated request got $CODE"
pass "401 without a token"

step "9. per-plan rate limit"
for _ in $(seq 1 5); do curl -s -o /dev/null -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:$PORT/v1/forecast?lat=1&lon=1"; done
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:$PORT/v1/forecast?lat=1&lon=1")
[ "$CODE" = "429" ] || fail "hobby quota of 5/min not enforced (got $CODE)"
pass "429 once the hobby quota is spent"
sleep 61 & QPID=$!   # let the quota window roll over while we do chain work

step "10. access ends by itself when the prepaid balance runs out"
# Nobody sends a transaction to expire this. Time simply passes.
cast rpc evm_increaseTime 7776001 --rpc-url $RPC >/dev/null   # 90 days + 1s
cast rpc evm_mine --rpc-url $RPC >/dev/null
[ "$(cast call "$BILLING" 'isSubscribed(address)(bool)' $CUSTOMER --rpc-url $RPC)" = "false" ] \
  || fail "still subscribed after 90 days on a 3-month deposit"
pass "isSubscribed() == false, with no expiry transaction ever sent"

wait $QPID
sleep 1
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:$PORT/v1/forecast?lat=51.5&lon=-0.12")
[ "$CODE" = "402" ] || fail "expired customer still served (got $CODE)"
pass "402 from the API once the balance is spent"

step "11. operator gets paid"
echo "$CUSTOMER" > "$ROOT/.e2e-accounts.txt"
cd "$ROOT"
BILLING_ADDRESS=$BILLING ACCOUNTS_FILE=.e2e-accounts.txt \
  forge script script/Sweep.s.sol --rpc-url $RPC --broadcast --private-key $OPERATOR_KEY >/tmp/e2e-sweep.log 2>&1 \
  || { tail -20 /tmp/e2e-sweep.log; fail "sweep failed"; }
TREASURY=$(cast call "$BILLING" 'revenueRecipient()(address)' --rpc-url $RPC)
BAL=$(cast call "$USDC" 'balanceOf(address)(uint256)' "$TREASURY" --rpc-url $RPC | awk '{print $1}')
[ "$BAL" = "15000000" ] || fail "expected \$15.00 of revenue, got $BAL base units"
pass "\$15.00 USDC swept to the revenue recipient"

step "12. a lapsed customer resumes by topping up, not by re-subscribing"
# They still hold plan 1; the contract refuses a second subscribe on purpose.
# `set -o pipefail` is on, so capture first rather than piping a failing command into grep.
REVERT=$(cast send "$BILLING" "subscribe(uint8,uint256)" 2 20000000 --rpc-url $RPC \
  --private-key $CUSTOMER_KEY 2>&1 || true)
echo "$REVERT" | grep -q "AlreadySubscribed\|0x8138e12d" || { echo "$REVERT"; fail "expected AlreadySubscribed for a lapsed account"; }
pass "subscribe() reverts AlreadySubscribed; the client must call topUp() or changePlan()"

cast send "$BILLING" "changePlan(uint8)" 2 --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
cast send "$BILLING" "topUp(uint256)" 20000000 --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
[ "$(cast call "$BILLING" 'isSubscribed(address)(bool)' $CUSTOMER --rpc-url $RPC)" = "true" ]   || fail "top up did not restore access"
pass "moved to pro and topped up \$20; access restored"

step "12b. a refund path the operator cannot block"
cast rpc evm_increaseTime 1296000 --rpc-url $RPC >/dev/null   # half a month
cast rpc evm_mine --rpc-url $RPC >/dev/null
BEFORE=$(cast call "$USDC" 'balanceOf(address)(uint256)' $CUSTOMER --rpc-url $RPC | awk '{print $1}')
cast send "$BILLING" "cancel(address)" $CUSTOMER --rpc-url $RPC --private-key $CUSTOMER_KEY >/dev/null
AFTER=$(cast call "$USDC" 'balanceOf(address)(uint256)' $CUSTOMER --rpc-url $RPC | awk '{print $1}')
REFUND=$((AFTER - BEFORE))
[ "$REFUND" -ge 9990000 ] && [ "$REFUND" -le 10000000 ] \
  || fail "expected ~\$10.00 back from a half-used \$20 pro month, got $REFUND"
pass "refunded $REFUND base units (~\$10.00), prorated to the second"

step "13. cancelling invalidates the API cache immediately"
sleep 6
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:$PORT/v1/forecast?lat=51.5&lon=-0.12")
[ "$CODE" = "402" ] || fail "cancelled customer still served (got $CODE)"
grep -q '"type":"invalidate"' /tmp/e2e-server.log || fail "no cache invalidation was logged"
pass "402, and the Cancelled event was seen by the watcher"

printf '\n\033[32mall good\033[0m — contracts, gate, auth and payout all behaved.\n'
