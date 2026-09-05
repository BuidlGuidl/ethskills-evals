# Why the vesting clock freezes on `yarn fork --network base`

## Short version

Nothing is wrong with your vesting contract or your frontend. Anvil is in
**on-demand (auto) mining** mode: it mines a block only when a transaction
arrives. No transactions means no new blocks, and `block.timestamp` is a
property of the newest block — so the chain's notion of "now" is literally
stuck at the moment of the last block. The fix is interval mining.

## 1. The mining behavior that makes time stand still

`yarn fork --network base` starts Anvil with automining and no block time. In
that mode:

- A block is produced **only** in response to a transaction being submitted.
- Between transactions there is no new block, so `eth_blockNumber` and the
  latest block's `timestamp` never change.
- Wall-clock time on your laptop advances; the chain's time does not. They are
  not coupled — Anvil derives the next block's timestamp from the host clock
  only *at the moment it mines*.

Your page reads a view function (`claimable()`, `releasable()`, or similar)
whose math is `f(block.timestamp)`. Wagmi/viem dutifully re-polls it every few
seconds, the node re-executes it against the latest block, and every single
call evaluates at the *same* frozen timestamp. The result is byte-identical, so
the UI shows a perfectly still number for minutes. It looks like a broken
polling loop or an over-aggressive cache; it is actually a correct read of a
chain where no time has passed.

## 2. Why one unrelated transaction un-freezes it in a single jump

When someone finally sends *any* transaction — a token approval, a faucet
transfer, an unrelated contract call — Anvil mines a block to include it. The
new block gets a timestamp taken from the current host clock, which by then is
several minutes ahead of the previous block.

So the chain jumps from `T` straight to `T + (however long the fork sat idle)`
in one step. There are no intermediate blocks and no intermediate timestamps.
Your next `claimable()` read is evaluated at the new timestamp and returns the
entire accrual for that whole gap at once. Hence the "sits still, then leaps by
the full missing amount" behavior. The transaction did not cause the vesting to
accrue; it caused the **clock to be restamped**, and the accrual that was
always mathematically owed became observable in a single discrete step.

Note this also means the freeze is not a rendering bug you can paper over: any
live deadline, auction expiry, TWAP, rate limit, or `block.timestamp`-gated
branch behaves the same way on an idle fork.

## 3. Why the passing forge tests never caught it

`vm.warp` sets `block.timestamp` directly inside the EVM used by the test
harness. Your tests therefore assert something like:

```solidity
vm.warp(start + 30 days);
assertEq(vesting.claimable(user), expected);
```

That is a test of the **vesting formula**, and the formula is correct — which
is why the suite is green. What the tests can never exercise is *how the
timestamp comes to advance in a running node*. `vm.warp` supplies the time
advance by fiat; on a live fork the time advance is a side effect of block
production, and block production is a node configuration concern that lives
entirely outside Solidity.

In other words: the tests cover the pure function; the bug is in the
environment that feeds the function its argument. Unit tests over
`f(timestamp)` cannot detect that nothing in your local environment is
advancing `timestamp`. A test that could catch this would have to be an
integration test against the actual RPC endpoint, observing that
`eth_getBlockByNumber("latest").timestamp` does not move while the process
idles.

## 4a. The one-off fix (unfreeze the demo you have running right now)

Turn on interval mining against the live node — no restart, no state loss:

```bash
cast rpc anvil_setIntervalMining 1
```

Anvil now mines a block every second whether or not transactions arrive.
`block.timestamp` advances continuously, your polled `claimable()` read
returns a smoothly increasing value, and the demo behaves like a real chain.

A caution on the tempting alternatives:

- `cast rpc evm_mine` mines exactly one block. It restamps `block.timestamp`
  once — the number lurches forward, then freezes again immediately. You would
  be hand-cranking the clock for the whole demo.
- `evm_increaseTime` (plus a mine) similarly gives you one controlled step.

Both are the right tools for deterministic single-step scenario tests, and the
wrong tool for a demo that needs to *keep running*. Use interval mining.

## 4b. The permanent fix (so the project always runs this way)

Add a block time to the fork script so every `yarn fork` starts with continuous
mining and no one has to remember the `cast rpc` incantation:

```bash
--block-time 1
```

In `packages/foundry/package.json`, the `fork` script becomes roughly:

```json
"fork": "anvil --fork-url ${FORK_URL} --chain-id 31337 --block-time 1"
```

Re-run `yarn fork --network base` and the clock runs from the first second.

## Two things to confirm while you're in there

- **The frontend must be pointed at the local Anvil chain** (`chains.foundry`,
  chain ID 31337) in `scaffold.config.ts` — not at Base mainnet. If it is
  targeting Base directly, you are reading a real chain that mines every couple
  of seconds, and you would never have seen this freeze; seeing it is good
  evidence you are correctly wired to the fork.
- **`--block-time 1` changes test timing assumptions**, since blocks now arrive
  on their own. Any script that assumed "one transaction, one block" should be
  re-checked. Your forge tests are unaffected — they never touch the node.

## Takeaway

A fork is a local copy of chain *state*, not a copy of chain *liveness*. State
comes for free; the heartbeat has to be asked for. `vm.warp` gives you a clock
in tests; `--block-time` gives you one in the demo.
