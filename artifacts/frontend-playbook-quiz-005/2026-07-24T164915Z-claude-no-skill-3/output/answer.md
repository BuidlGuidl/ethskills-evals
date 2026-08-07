# Why the vesting balance freezes on the fork (and jumps on the next tx)

## TL;DR

Your local fork (Anvil, started by `yarn fork --network base`) is in
**on-demand / instant mining** mode: it only produces a block when a transaction
shows up. `block.timestamp` only changes when a new block is mined, so with no
traffic the chain head is frozen and your `claimable = f(block.timestamp)` math
returns the exact same number for minutes. The next transaction — any transaction —
forces a block, and Anvil stamps that block with the **current wall-clock time**.
Since real time has moved on, `block.timestamp` leaps forward by the whole elapsed
interval at once, and the claimable figure jumps by the corresponding amount. Your
`vm.warp` tests pass because they test the *math*, not the node's *time
progression*; they set time by hand, so they never depend on time advancing on its
own. The permanent fix is to make the node mine on a timer (`--block-time`).

---

## 1. The mining behavior that makes time stand still

Anvil (like Hardhat Network) does **not** mine blocks on a wall-clock schedule by
default. Its default is *auto-mining* — sometimes called instant or on-demand
mining:

- A new block is produced **only when there is a transaction to include**.
- With no transactions, the chain head never advances: same block number, same
  block hash, and — the part that bites you — the **same `block.timestamp`**.

`block.timestamp` is a property of a block. It is not a live clock the EVM reads
from the OS; it is a fixed value baked into whichever block is currently the head.
Your vesting contract computes the claimable amount as a pure function of
`block.timestamp` (e.g. `vested = total * (block.timestamp - start) / duration`).
Your frontend polls that view function repeatedly (every few seconds, on a React
Query / wagmi interval), but every one of those `eth_call`s runs against the
**same head block**, so it reads the **same timestamp**, so it returns the **same
number**. The value doesn't sit still because it's cached in the UI — it sits still
because the source of truth on the fork genuinely isn't changing. Time hasn't
"paused"; the chain simply hasn't minted a new block to carry a newer timestamp.

## 2. Why one unrelated transaction un-freezes it in a single jump

When *any* transaction lands — a token approval, someone poking a different
contract, even a self-send — Anvil has a reason to mine, so it produces a new
block. When it builds that block it has to choose a timestamp, and its default rule
is essentially:

> `newTimestamp = max(lastBlockTimestamp + 1, currentWallClockTime)`

i.e. it uses the **real system clock** (never going backwards relative to the last
block). If the previous block was mined 4 minutes ago, the new block's timestamp is
~4 minutes larger than the frozen value the UI has been showing. On the very next
poll your view function now reads that jumped-forward timestamp, and:

```
claimable(newTimestamp) - claimable(frozenTimestamp)
```

is exactly the vesting that "should" have accrued over those 4 real minutes — but
it all materializes in a **single step**, on the block created by a transaction
that had nothing to do with vesting. That's why an unrelated tx un-freezes it, and
why it arrives as one discrete jump rather than a smooth climb: between blocks there
is no intermediate timestamp to observe, so all the accrual collapses onto the one
block boundary where time actually moved.

(This is also why it looks fine in production: Base mines a block roughly every ~2
seconds regardless of your app's activity, so `block.timestamp` marches forward on
its own and the number ticks up smoothly.)

## 3. Why the passing `vm.warp` tests never caught this

Your forge tests assert that the **math** is right, and it is. `vm.warp(t)` sets
`block.timestamp` to a value *you* pick, then you assert `claimable()` equals what
you expect at that `t`. That validates `f(t)` at a set of points — a pure function
of an input you control.

But the bug isn't in `f(t)`. The bug lives in the **assumption that `t` advances on
its own** between reads. In a forge test:

- There is no wall clock driving block production and no idle "real time" passing.
- `vm.warp` *manually* moves time forward, so time only ever changes because the
  test told it to. The test can't observe "time failed to advance," because in a
  unit test time never advances unless warped.
- There's no frontend polling loop, no on-demand miner, and no gap between blocks —
  none of the moving parts that produce the freeze are present.

So the tests are green and correct, and they will stay green even though the live
fork misbehaves, because they exercise a different concern (contract arithmetic)
than the one that's broken (the node's timestamp progression + the UI's implicit
assumption that repeated reads see fresh time). This is a classic
"tests-pass-bug-persists" gap: correct unit under an environment assumption the unit
tests don't — and can't — model.

## 4. The fixes

### One-off (get through the demo right now)

Force the node to keep minting blocks so `block.timestamp` keeps advancing. Any of:

- **Mine on a timer from a second terminal** while you present:
  ```bash
  # every ~2s, ask Anvil to mine one empty block, which bumps block.timestamp
  while true; do cast rpc evm_mine; sleep 2; done
  ```
- **Single manual bumps** when you need the number to move:
  ```bash
  cast rpc evm_mine
  ```
- Or flip the node into interval mining live over RPC (no restart):
  ```bash
  cast rpc evm_setIntervalMining 2   # mine a block every 2 seconds
  ```

Any of these makes new blocks (hence newer timestamps) appear without you having to
send a "real" transaction, so the claimable number climbs on its own during the
demo.

### Permanent (fix the fork setup)

Run the fork with **interval mining** so blocks are produced on a wall-clock
cadence, exactly like a real chain. Add `--block-time` (alias `-b`) to the Anvil
invocation behind `yarn fork`:

```bash
anvil --fork-url <base-rpc> --block-time 2
```

`--block-time 2` roughly matches Base's ~2s block time, so `block.timestamp`
advances continuously and your vesting number ticks up smoothly with no phantom
jumps. Wire this into the `fork` script (e.g. in `package.json` /
`scaffold.config` / the wrapper that `yarn fork --network base` calls) so every
future run gets it automatically — pass `--block-time 2` (or `12` if you'd rather
mimic Ethereum L1 pacing; the exact value only affects how fine-grained the ticks
are).

**Secondary, defense-in-depth (frontend):** even with continuous mining, make the
UI re-read on each **new block** rather than on a blind fixed timer — e.g. wagmi's
`useBlockNumber({ watch: true })` as the query's invalidation trigger, or
`watch: true` on the contract read. That keeps the displayed value tied to actual
chain progress on any node, and makes the "why isn't it updating" failure mode
visible (block number stops) instead of silent.

### Why this is the right fix, not "cache-bust the UI"

It's tempting to blame the frontend for showing a stale number and to shorten the
poll interval or disable caching. That won't help: every poll, no matter how
frequent, reads the same frozen head block. The value is stale because the *chain*
is stale. Fix time progression at the node (interval mining); the UI change above is
a hardening measure, not the cure.
