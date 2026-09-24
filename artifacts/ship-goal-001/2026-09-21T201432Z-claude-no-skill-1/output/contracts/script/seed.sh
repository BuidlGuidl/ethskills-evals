#!/usr/bin/env bash
# Seeds a local anvil chain with a small neighbourhood: members, tools, and enough loan history that the
# browse screen has something to sort. Run it after script/Deploy.s.sol, from the contracts/ directory.
#
#   anvil &
#   PRIVATE_KEY=0xac09...ff80 forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
#   ./script/seed.sh
set -euo pipefail

RPC=${RPC_URL:-http://127.0.0.1:8545}
DEPLOYMENT=${DEPLOYMENT:-deployments/31337.json}

if [ ! -f "$DEPLOYMENT" ]; then
  echo "No $DEPLOYMENT - run the deploy script against anvil first." >&2
  exit 1
fi

json() { python3 -c "import json,sys;print(json.load(open('$DEPLOYMENT'))['$1'])"; }
SHED=$(json toolshed)
REGISTRY=$(json memberRegistry)
USDC=$(json usdc)

# Anvil's default accounts. Account 0 deployed, so it is the steward.
KEY0=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
KEY1=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
KEY2=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
KEY3=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
KEY4=0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a
KEY5=0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
A1=$(cast wallet address $KEY1); A2=$(cast wallet address $KEY2); A3=$(cast wallet address $KEY3)
A4=$(cast wallet address $KEY4); A5=$(cast wallet address $KEY5)

send() { local key=$1; shift; cast send --rpc-url "$RPC" --private-key "$key" "$@" >/dev/null; }
call() { cast call --rpc-url "$RPC" "$@"; }
warp() { # warp N days forward
  cast rpc --rpc-url "$RPC" evm_increaseTime $(( $1 * 86400 )) >/dev/null
  cast rpc --rpc-url "$RPC" evm_mine >/dev/null
}
usd() { echo "$(( $1 * 1000000 ))"; }

echo "== roster =="
send $KEY0 "$REGISTRY" "addMembers(address[],string[])" \
  "[$A1,$A2,$A3,$A4,$A5]" '["Marisol (12 Oak)","Dev (14 Oak)","Priya (3 Cedar)","Tom (7 Cedar)","Ana (21 Elm)"]'

echo "== USDC + approvals =="
for k in $KEY1 $KEY2 $KEY3 $KEY4 $KEY5; do
  addr=$(cast wallet address $k)
  send $KEY0 "$USDC" "mint(address,uint256)" "$addr" "$(usd 2000)"
  send $k "$USDC" "approve(address,uint256)" "$SHED" "$(usd 1000000)"
done

echo "== tools =="
# listTool(name, photoUri, conditionNotes, deposit, dailyLateFee)
send $KEY1 "$SHED" "listTool(string,string,string,uint96,uint96)" \
  "Makita circular saw" "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800" \
  "Sharp blade, guard sticks a little. Comes with the case." "$(usd 120)" "$(usd 8)"
send $KEY1 "$SHED" "listTool(string,string,string,uint96,uint96)" \
  "Wheelbarrow" "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800" \
  "Tyre needs pumping every couple of weeks." "$(usd 40)" "$(usd 2)"
send $KEY2 "$SHED" "listTool(string,string,string,uint96,uint96)" \
  "8ft step ladder" "https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=800" \
  "Fibreglass, one rubber foot replaced." "$(usd 60)" "$(usd 4)"
send $KEY2 "$SHED" "listTool(string,string,string,uint96,uint96)" \
  "Carpet cleaner" "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800" \
  "Bring your own solution. Tank rinsed after every loan, please." "$(usd 90)" "$(usd 6)"
send $KEY3 "$SHED" "listTool(string,string,string,uint96,uint96)" \
  "Pressure washer" "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800" \
  "2000psi. Hose is 6m, no extension." "$(usd 150)" "$(usd 10)"
send $KEY3 "$SHED" "listTool(string,string,string,uint96,uint96)" \
  "Tile saw" "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800" \
  "Wet saw, needs a bucket. Blade replaced last spring." "$(usd 100)" "$(usd 5)"
send $KEY4 "$SHED" "listTool(string,string,string,uint96,uint96)" \
  "Extension ladder (24ft)" "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800" \
  "Heavy. Two people to carry it." "$(usd 80)" "$(usd 5)"

# --- loan history so members have a track record --------------------------------------------
# Helper: full loan, returned `late_days` after the due date (negative-ish = on time when 0).
loan() { # borrower_key owner_key tool_id days late_days
  local bkey=$1 okey=$2 tool=$3 dur=$4 late=$5
  local id
  id=$(call "$SHED" "loanCount()(uint64)")
  send $bkey "$SHED" "requestLoan(uint64,uint32)" "$tool" "$dur"
  id=$(( id + 1 ))
  send $okey "$SHED" "approveRequest(uint64)" "$id"
  warp $(( dur + late ))
  send $okey "$SHED" "confirmReturn(uint64)" "$id"
}

echo "== loan history =="
# Ana: dependable, four loans, never late.
loan $KEY5 $KEY1 1 3 0
loan $KEY5 $KEY2 3 2 0
loan $KEY5 $KEY3 5 4 0
loan $KEY5 $KEY4 7 2 0
# Tom: six loans, two came back late.
loan $KEY4 $KEY1 1 2 0
loan $KEY4 $KEY2 4 3 2
loan $KEY4 $KEY3 6 5 0
loan $KEY4 $KEY1 2 2 0
loan $KEY4 $KEY2 3 1 1
loan $KEY4 $KEY3 5 3 0
# Priya: two loans, one very late (fee capped at the deposit).
loan $KEY3 $KEY1 1 2 0
loan $KEY3 $KEY2 4 3 30
# Dev: one late loan out of one.
loan $KEY2 $KEY1 2 1 4

echo "== open state =="
# An active loan that is already overdue: Dev has Priya's pressure washer and is past due.
DEV_LOAN=$(( $(call "$SHED" "loanCount()(uint64)") + 1 ))
send $KEY2 "$SHED" "requestLoan(uint64,uint32)" 5 2
send $KEY3 "$SHED" "approveRequest(uint64)" "$DEV_LOAN"
warp 5   # 3 days late and counting

# Two pending requests on Marisol's saw, so the owner has a queue to choose from.
send $KEY4 "$SHED" "requestLoan(uint64,uint32)" 1 3
send $KEY5 "$SHED" "requestLoan(uint64,uint32)" 1 2

echo
echo "Seeded. Tools: $(call "$SHED" 'toolCount()(uint64)')  Loans: $(call "$SHED" 'loanCount()(uint64)')"
echo "Import anvil account #1..#5 into your wallet to play as members; account #0 is the steward."
