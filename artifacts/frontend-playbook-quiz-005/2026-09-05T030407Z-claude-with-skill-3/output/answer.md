# Why the vesting number freezes on a fork (and jumps all at once)

Nothing is wrong with your vesting contract or your frontend. This is Anvil's
default mining behavior.

## 1. The mining behavior that freezes time

`yarn fork --network base` runs Anvil in **on-demand (auto) mining**: it mines a
block **only when a transaction arrives**. With no transactions, no new block is
produced, so the head block never changes — and `block.timestamp` is a property
of the head block, not of the wall clock.

Your page reads claimable via `eth_call`. An `eth_call` is evaluated against the
latest block, so the EVM it runs in reports the timestamp of that frozen block.
Your frontend is polling correctly, wagmi is refetching correctly, the contract
math is correct — and every single poll re-computes the *same* answer from the
*same* `block.timestamp`. The number sits perfectly still because, as far as the
chain is concerned, no time has passed.

Anything with a running clock hits this: vesting, streaming payments, auction
countdowns, deadlines, TWAPs, cooldowns, expiries.

## 2. Why one unrelated transaction un-freezes it in a single jump

The transaction is only the *trigger*. Any transaction — a transfer, a faucet
click, an approve, something from another tab — makes Anvil mine a block, and it
stamps that new block with the **current wall-clock time**.

So the head block's timestamp doesn't advance by one second; it advances by the
entire interval since the last block was mined. If nobody transacted for four
minutes, the next block is ~240 seconds newer. Your next poll reads that block,
the contract computes vested tokens over 240 extra seconds, and the UI catches up
in one discontinuous jump. The tokens were never "missing" — the clock the
contract can see simply hadn't moved yet.

That's why the jump equals exactly the amount that should have accrued during the
freeze, and why the trigger transaction has nothing to do with vesting.

## 3. Why the forge tests never caught it

`vm.warp` **sets `block.timestamp` explicitly**. Your tests assert: given
timestamp T, the contract returns the right claimable amount. That's a correct
and useful test of the vesting *math*, and the math is fine — which is why the
tests pass.

But `vm.warp` also *supplies* the very thing that is broken in the demo. The bug
is not "the contract computes the wrong value for a given timestamp", it's "the
timestamp doesn't advance on its own". A test that hands the contract a fresh
timestamp on every assertion can never observe a stalled clock. Unit tests here
cover contract logic; the freeze is a property of the **local node's block
production**, which lives entirely outside the test harness. No amount of fuzzing
or extra `vm.warp` cases will surface it.

The general rule: passing `vm.warp` tests tell you nothing about whether time is
actually moving in your dev environment. Verify running-clock UI in the browser
against the fork, not just in `forge test`.

## 4. The fixes

### One-off (fix the running demo now, no restart)

In a new terminal, turn on interval mining on the live node:

```bash
cast rpc anvil_setIntervalMining 1
```

Anvil now mines a block every second whether or not transactions arrive.
`block.timestamp` advances continuously, and your claimable balance ticks up
smoothly. This takes effect immediately on the already-running fork — you don't
have to restart, redeploy, or reload state.

### Permanent (so it's never broken again)

Add `--block-time 1` to the fork script in `packages/foundry/package.json`, so
every `yarn fork` starts with interval mining already on:

```jsonc
// packages/foundry/package.json
"fork": "anvil --fork-url ${0:-mainnet} --chain-id 31337 --block-time 1"
```

Restart the fork once and it's permanent for you and everyone else on the team.

### What *not* to reach for here

`evm_mine` and `evm_increaseTime` are the right tools for controlled,
single-step testing — `evm_mine` restamps `block.timestamp` once and then it
freezes again immediately; `evm_increaseTime` jumps the clock on demand when you
want to fast-forward to a vesting cliff. They're genuinely useful, just not for
this. Under a live demo you need the clock to keep running by itself, and only
interval mining does that.

## Quick sanity check

Watch the head block advance without sending anything:

```bash
cast block-number --rpc-url http://127.0.0.1:8545   # run twice, a few seconds apart
```

Same number twice = still frozen. Increasing = interval mining is on.

While you're in the fork, also confirm the frontend is pointed at the fork's own
chain ID, not Base's: `targetNetworks: [chains.foundry]` (31337) in
`scaffold.config.ts`. The fork mirrors Base's state but runs locally as 31337.
