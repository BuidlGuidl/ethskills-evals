#!/usr/bin/env bash
# End to end on a fresh anvil: deploy + wire, 4 members register from their own
# wallets, one proposal, 4 anonymous votes sent by a relayer, a rejected double
# vote, then the public tally after the deadline.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT_ANVIL=${ANVIL_PORT:-8599}
export RPC_URL=http://127.0.0.1:$PORT_ANVIL
MNEMONIC="test test test test test test test test test test test junk" # anvil's dev mnemonic
key() { cast wallet private-key --mnemonic "$MNEMONIC" --mnemonic-index "$1"; }
addr() { cast wallet address --private-key "$(key "$1")"; }

ADMIN_KEY=$(key 0)
RELAYER_KEY=$(key 9) # unrelated to any member wallet
MEMBERS=(1 2 3 4)
VOTES=(yes yes no yes)

anvil --silent --port "$PORT_ANVIL" &
ANVIL=$!
trap 'kill $ANVIL ${RELAYER:-} 2>/dev/null || true' EXIT
until cast chain-id --rpc-url $RPC_URL >/dev/null 2>&1; do sleep 0.2; done

echo "== deploy (admin wallet)"
DEMO_MEMBERS=$(IFS=,; for i in "${MEMBERS[@]}"; do printf '%s,' "$(addr "$i")"; done | sed 's/,$//')
DEMO_MEMBERS=$DEMO_MEMBERS MIN_ANONYMITY_SET=3 \
  forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key "$ADMIN_KEY" --broadcast >/dev/null
VOTING=$(node -p "require('./deployments/31337.json').voting")
echo "AnonymousVoting at $VOTING"

echo "== register (each member's own NFT-holding wallet)"
rm -rf notes/demo
for i in "${MEMBERS[@]}"; do
  MEMBER_KEY=$(key "$i") TOKEN_ID=$i NOTE=notes/demo/member$i.json node scripts/register.mjs
done

echo "== create proposal (member 1's wallet; snapshots the member tree)"
cast send "$VOTING" "createProposal(string,uint64)" "Fund the grants round?" 3600 \
  --rpc-url $RPC_URL --private-key "$(key 1)" >/dev/null

echo "== start relayer"
RELAYER_KEY=$RELAYER_KEY PORT=8797 node scripts/relayer.mjs &
RELAYER=$!
sleep 1

echo "== vote (proof in-process, submitted by relayer)"
for n in "${!MEMBERS[@]}"; do
  i=${MEMBERS[$n]}
  NOTE=notes/demo/member$i.json RELAYER_URL=http://127.0.0.1:8797 PROPOSAL_ID=0 VOTE=${VOTES[$n]} node scripts/vote.mjs
done

echo "== double vote by member 2 must fail"
if NOTE=notes/demo/member2.json RELAYER_URL=http://127.0.0.1:8797 PROPOSAL_ID=0 VOTE=no node scripts/vote.mjs 2>/dev/null; then
  echo "ERROR: double vote accepted"; exit 1
else
  echo "rejected as expected"
fi

echo "== senders of every VoteCast tx (all the relayer)"
cast logs --rpc-url $RPC_URL --address "$VOTING" "VoteCast(uint256 indexed,uint256,uint256)" --json |
  node -e 'const logs=JSON.parse(require("fs").readFileSync(0));Promise.all(logs.map(l=>fetch(process.env.RPC_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_getTransactionByHash",params:[l.transactionHash]})}).then(r=>r.json()).then(j=>console.log(l.transactionHash.slice(0,12),"from",j.result.from))))'

echo "== after deadline: tally (anyone)"
cast rpc evm_increaseTime 3601 --rpc-url $RPC_URL >/dev/null
cast rpc evm_mine --rpc-url $RPC_URL >/dev/null
cast call "$VOTING" "tally(uint256)(uint256,uint256,uint256)" 0 --rpc-url $RPC_URL |
  paste -sd' ' - | awk '{print "yes=" $1 " no=" $2 " eligible=" $3}'
