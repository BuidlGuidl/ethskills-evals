# Relayer gas: analysis and batched payout path

Answers two questions for the Base payments relayer: what we spend on gas, and what to
change. The findings and the ranked plan are in [PLAN.md](./PLAN.md).

## Layout

| Path | What it is |
| --- | --- |
| `src/BatchTransfer.sol` | Batch payout contract. Pays N recipients in one transaction. |
| `test/BatchTransfer.t.sol` | Correctness, revert, and security tests (incl. allowance-theft). |
| `relayer/encode.mjs` | Packed calldata encoding with amount validation. |
| `relayer/fees.mjs` | Priority-fee policy, derived from measured Base congestion. |
| `relayer/batcher.mjs` | Batch planning, pre-flight simulation, per-payout quarantine. |
| `relayer/run-payouts.mjs` | Payout cycle entry point; replaces the per-transfer loop. |
| `relayer/integration.test.mjs` | End-to-end test of the payout path against a Base fork. |
| `bench/measure.mjs` | Gas benchmark against a Base fork, using real receipts. |
| `bench/out/results.json` | Measured gas for every batch size / encoding / recipient case. |
| `analysis/*.mjs` | The measurements behind PLAN.md, re-runnable. |

## Reproducing the numbers

```bash
forge test                       # contract correctness
node analysis/onchain-baseline.mjs   # what a transfer costs today, from real receipts
node analysis/congestion.mjs         # base fee + block fullness + tips actually paid

# gas benchmark (needs a local fork)
anvil --fork-url https://base-rpc.publicnode.com --port 8545 --silent --gas-limit 200000000 &
node bench/measure.mjs             # writes bench/out/results.json
node relayer/integration.test.mjs  # end-to-end payout path, incl. quarantine
node analysis/cost-model.mjs       # prices those results at live base fee / ETH
```

`analysis/cost-model.mjs` takes `--volume`, `--new-recipient-share` and `--batch-size`,
so finance can re-run it against their own assumptions.

Use an RPC that tolerates a burst of state fetches. A rate-limited endpoint will stall
anvil mid-run rather than failing cleanly — that is what the retry/backoff and the local
balance seeding in `bench/measure.mjs` are there to absorb.

## A note on measurement

Gas here is measured from **transaction receipts on a mainnet fork**, not from
`forge test`. Foundry meters a top-level call as a pseudo-transaction and reports ~21.7k
for a no-op, which silently inflates anything timed with `gasleft()`. The receipt-based
baseline reproduces mainnet closely (44,843 measured vs 45,059 median on-chain), which is
what makes the batched comparison trustworthy.

## Deploying

`BatchTransfer` is ownerless, immutable, and never custodies funds — it only ever calls
`transferFrom(msg.sender, ...)`, so the relayer's allowance cannot be spent by anyone
else. Deploy it, then have the relayer approve it once:

```bash
forge create src/BatchTransfer.sol:BatchTransfer --rpc-url $BASE_RPC_URL --private-key $DEPLOYER_KEY
cast send $USDC "approve(address,uint256)" $BATCH_TRANSFER \
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
  --rpc-url $BASE_RPC_URL --private-key $RELAYER_KEY
```

The max approval is deliberate, but for an operational reason rather than a gas one: a
finite allowance needs periodic top-up transactions. Base USDC does *not* implement the
"infinite approval is never decremented" shortcut — it decrements the allowance on every
`transferFrom`, max or not (verified against the live contract). Inside a batch that write
lands on the same storage slot each time, so only the first one costs real gas.
