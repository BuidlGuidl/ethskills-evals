# Why the vesting clock stands still on a fork (and jumps all at once)

## TL;DR

Your contract math is fine. The problem is **how Anvil mines blocks on a
fork**. By default a forked Anvil node does *not* mine on a wall-clock
interval — it only mines a block when it receives a transaction
("auto-mining on demand"). `block.timestamp` is a property of the *latest
block*, so if no block is mined, the timestamp never advances and every
`eth_call` reads the same frozen time. The next transaction anyone sends
mines a fresh block whose timestamp snaps forward to the real current
time, so the vesting curve catches up in a single discrete step.

---

## 1. The mining behavior that freezes time

Anvil (the node behind `yarn fork`) has two relevant mining modes:

- **Interval mining** — mine a new block every N seconds, whether or not
  there are transactions. Each new block gets a timestamp ≈ real
  wall-clock time. This is *off* by default.
- **Auto-mining (on demand)** — mine a block *only* when a transaction
  arrives. This is the default on a fork.

With the default on-demand mode and an idle demo:

1. Nobody sends a transaction, so **no new block is ever mined**.
2. `block.timestamp` is read from the **latest block's header**. That
   header hasn't changed, so the timestamp is a constant.
3. Your vesting view function does something like
   `vestedAmount(block.timestamp)`. Every read-only `eth_call` your
   frontend makes (each polling tick) executes against that same
   unchanged latest block, so it returns the **exact same number** every
   time.

To the user, the on-chain clock has stopped. The claimable balance sits
"perfectly still for minutes" because, as far as the EVM state is
concerned, no time has passed at all.

## 2. Why one unrelated transaction un-freezes it in a single jump

When someone finally submits *any* transaction (even something unrelated
to vesting), Anvil has to include it in a block, so it **mines a new
block**. Anvil stamps that new block with a timestamp equal to the
**current real wall-clock time**, not "previous timestamp + a few
seconds."

So if the fork sat idle for, say, 7 minutes:

- Old latest block timestamp: `T`
- New block timestamp: `T + ~420 seconds` (real elapsed time)

Your vesting function is continuous in time, but it's only ever
*evaluated* at block timestamps. It jumps straight from `vested(T)` to
`vested(T + 420s)` with nothing in between — the entire "missing" amount
that accrued during those 7 idle minutes appears at once, on the first
block after the pause. The triggering transaction has nothing to do with
vesting; it's just what forced a new block to exist.

## 3. Why the passing forge tests never caught it

Your `forge test` suite exercises the **vesting math**, not the **node's
mining loop** — they're two completely different layers:

- Forge tests run in an **in-process EVM** with no RPC, no mempool, and
  no miner. There is no "wait for a block" concept at all.
- `vm.warp(t)` **directly writes** `block.timestamp` to whatever value
  you choose. The tests literally *set the clock by hand* before each
  assertion, then check that `vestedAmount` returns the right number for
  that time.

So the tests prove the pure function `time → amount` is correct — and it
is. They can *never* reproduce the bug, because the bug isn't in that
function. The bug is that on a live fork **the clock doesn't advance on
its own**, which is a property of the Anvil node's mining configuration.
`vm.warp` masks exactly the thing that's broken: in tests time always
moves because you move it; on the idle fork nothing moves it.

This is the classic gap between "contract logic is correct" and "the
running system behaves correctly." Only a browser/live-fork walkthrough
(watching the number over real wall-clock time) surfaces it.

## 4. The fix

### One-off fix (for a fork that's already running)

Turn on interval mining in the running node so it produces a block every
second:

```bash
cast rpc anvil_setIntervalMining 1
```

From that point on, Anvil mines every second, `block.timestamp` advances
continuously, and the claimable balance ticks up smoothly. (If you just
want to prove the diagnosis right now without enabling intervals, force a
single block with `cast rpc evm_mine` and watch the balance step forward.)

### Permanent fix (so every fork starts correctly)

Bake interval mining into the fork script so you never have to remember
the manual command. Add `--block-time 1` to the fork command in
`packages/foundry/package.json`:

```jsonc
// packages/foundry/package.json
{
  "scripts": {
    // was: anvil --fork-url ... 
    "fork": "anvil --fork-url ${...} --block-time 1"
  }
}
```

Now `yarn fork --network base` always mines a block per second out of the
box, and any timestamp-dependent logic — vesting, deadlines, expiries,
auction timers — behaves like a real chain during local demos.

> Rule of thumb: **any contract logic that reads `block.timestamp`
> (vesting, deadlines, expiry, streaming) will silently appear frozen on
> a default fork.** Enabling block mining (`--block-time 1` /
> `anvil_setIntervalMining 1`) is required, not optional.
