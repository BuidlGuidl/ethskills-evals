# Why the vesting clock freezes on a Base fork

## Short version

Your vesting math is fine. The problem is that **Anvil (the fork node behind `yarn fork`) isn't producing blocks**, and `block.timestamp` can only advance when a new block is mined. So the contract's idea of "now" is frozen at the timestamp of the last mined block. The instant *any* transaction arrives, Anvil mines a block, stamps it with the current wall-clock time, and every minute that quietly elapsed gets applied to your linear vesting formula in one step.

---

## 1. The mining behavior that makes time stand still

Anvil's default mode is **auto-mining**: it mines exactly one block *per transaction* and does nothing in between. It is not mining on a clock — there is no background block production. This is different from a real network like Base, where validators produce a block roughly every ~2 seconds no matter what, so `block.timestamp` marches forward on its own.

On the fork:

- `block.timestamp` is a property of a **block**, not a live wall clock. Solidity reads it from the current block header.
- Between transactions, no new block exists, so `block.timestamp` returns the timestamp of the **last mined block** — a fixed number.
- Your vesting contract computes `claimable` as a function of `block.timestamp`. A pure `view` call (what your frontend does on every poll) executes against that frozen `block.timestamp`.

So the frontend keeps re-reading the same input and, correctly, keeps computing the same output. For minutes. The number sits perfectly still because, from the contract's perspective, **zero time has passed** — no blocks, no new timestamp.

## 2. Why one unrelated transaction un-freezes it in a single jump

When someone finally sends *any* transaction (a transfer, an approval, a `mint` on some other contract — it doesn't matter what), Anvil has to mine a block to include it. When it mines that block it sets the new block's `timestamp` to the **current real wall-clock time**, not to "previous + a couple seconds."

That means the timestamp doesn't interpolate through the missing minutes — it **snaps straight to now**. If 7 minutes of real time elapsed while the node was idle, the new block's timestamp is ~420 seconds higher than the previous one.

Your vesting formula is continuous in `block.timestamp`, but `block.timestamp` itself is a **step function** that only updates at block boundaries. All 420 seconds of accrued vesting get applied at that single step. Hence the whole missing amount appears at once, in one jump, triggered by a transaction that had nothing to do with vesting. The transaction wasn't the cause of the vesting — it was just the thing that forced a new block, and the new block carried the real time with it.

## 3. Why the passing forge tests never caught it

Your tests use `vm.warp(...)`. `vm.warp` is a Foundry cheatcode that **directly sets `block.timestamp`** in the test VM. It bypasses mining entirely:

- The tests exercise the *pure math*: "given timestamp T, is `claimable` correct?" — and it is. That's why they're green.
- They **manufacture the passage of time** by hand (`vm.warp(start + 30 days)`), so time always moves in the test harness.
- They never depend on a node producing blocks, because there is no node — the cheatcode just assigns the value.

The bug is not in `claimable(t)`. It's in the assumption that **`t` advances on its own in the running environment**. On real Base it does; on an idle Anvil fork it doesn't. `vm.warp` guarantees the one condition (time moving) that the fork silently fails to provide, so the test suite structurally cannot see this class of problem. It's an environment/mining issue, not a Solidity issue — the wrong layer to catch with unit tests.

## 4. The one-off fix (unfreeze it right now, mid-demo)

Tell the running Anvil node to start mining on an interval — one block per second — via RPC. In a spare terminal:

```bash
cast rpc anvil_setIntervalMining 1
```

From that point on, Anvil mines a block every second, `block.timestamp` advances continuously, and the claimable balance ticks up smoothly without anyone sending a transaction. (If you just need a single nudge instead of continuous mining, `cast rpc evm_mine` mines one block and bumps the timestamp once — but for a live demo you want interval mining so it keeps moving.)

## 5. The permanent fix

Make interval mining the default so you never hit this again. Edit the fork script in `packages/foundry/package.json` and add `--block-time 1` to the Anvil invocation, e.g.:

```jsonc
// packages/foundry/package.json
"fork": "anvil --fork-url ... --block-time 1"
```

Now `yarn fork --network base` starts a node that produces a block every second by default. `block.timestamp` moves like it does on a real chain, and any time-dependent logic — vesting, deadlines, auction/expiry windows, streaming payments — behaves the way it will in production.

### Takeaway

- Frozen timestamp = **no blocks being mined**, not a math bug.
- One transaction → one block → timestamp snaps to real wall-clock time → whole backlog applied at once.
- `vm.warp` tests pass because they set the timestamp by hand and never rely on block production.
- Right now: `cast rpc anvil_setIntervalMining 1`.
- Forever: add `--block-time 1` to the `fork` script in `packages/foundry/package.json`.
