# Why the vesting clock freezes on a local fork

## TL;DR

On a forked node started with `yarn fork` (Anvil under the hood), **time
does not advance on its own**. `block.timestamp` is a property of a *block*,
and by default Anvil only mines a block **when it receives a transaction**
(auto-mining). Your vesting page reads the claimable amount with an
`eth_call` (a `view` call), which is evaluated against the timestamp of the
**latest mined block**. With no new blocks, that timestamp never changes, so
the number sits perfectly still. The moment *any* transaction arrives, Anvil
mines a new block, stamps it with the **current wall-clock time** (minutes
later), and the claimable amount recomputes against that new timestamp —
jumping forward by the entire elapsed interval in a single step.

Your forge tests pass because `vm.warp` sets the timestamp manually. They
verify the *math* at chosen timestamps; they never exercise the *node's
time-progression behavior* that the live page depends on.

---

## 1. The mining behavior that makes time stand still

A running chain (mainnet, Base, etc.) produces a new block on a fixed
cadence — Base every ~2 seconds — and each block carries a `timestamp` that
tracks real time. Any contract that computes a value from `block.timestamp`
therefore appears to change continuously, because there is a steady stream of
fresh blocks with ever-increasing timestamps.

A local fork is different. `yarn fork --network base` starts **Anvil** in
fork mode. Anvil's default mining mode is **auto-mine**: it mines exactly one
block per transaction, and it mines **nothing** when there are no
transactions. There is no background block producer and no clock ticking
blocks forward.

Two facts combine to freeze the display:

1. **`block.timestamp` only updates when a block is mined.** It is not a live
   clock the EVM samples — it is a fixed field baked into each block header.
   Between blocks it is a constant.

2. **`view` / `eth_call` reads execute against the *latest block*.** When your
   frontend calls `claimable()`, the node runs that function using the state
   **and the `block.timestamp`** of the most recently mined block. It does not
   use your computer's current time.

So during the demo: no one is transacting → Anvil mines no blocks → the
latest block's timestamp is frozen at whatever it was when the last block was
mined → every `claimable()` read returns the same number, for minutes. The
contract is behaving perfectly; the *chain's clock* simply isn't moving.

## 2. Why one unrelated transaction un-freezes it in a single jump

When someone finally sends **any** transaction — a token transfer, an
approval, anything, related to vesting or not — Anvil has work to do, so it
mines a new block to include it. When it builds that block it sets the new
block's `timestamp`.

By default Anvil sets a newly mined block's timestamp to the **current
wall-clock time** of your machine (real time has kept advancing even though
the chain hasn't). If the last block was mined 4 minutes ago, the new block's
timestamp is ~4 minutes greater than the previous one — the chain's clock
"catches up" to real time in one discontinuous leap rather than in small
2-second increments.

Now the next `claimable()` read runs against this new block, whose timestamp
is minutes ahead. The vesting math computes the amount that *should* have
accrued over those 4 minutes, and the UI shows the whole missing amount
appear at once. It looks like a bug in the vesting contract; it's actually the
chain's timestamp making up all the elapsed time in a single block.

(If Anvil were configured to advance timestamps by a fixed increment per block
instead of syncing to wall time, the jump would be one increment — but the
mechanism is the same: the frozen timestamp only moves at block boundaries.)

## 3. Why the passing forge tests never caught it

The forge tests exercise the vesting **arithmetic**, and they do it with
`vm.warp(...)`, which **directly writes `block.timestamp` to an arbitrary
value** inside the test EVM. A typical test does:

```solidity
vm.warp(start + 30 days);
assertEq(vesting.claimable(user), expectedAfter30Days);
```

This proves `claimable(t)` returns the correct value *for a given `t`*. That
math is correct — which is exactly why the tests are green.

But `vm.warp` **is** the thing that's missing in production. In the test, the
harness supplies the timestamp progression by fiat. On the fork, nothing
supplies it: no block producer, no `vm.warp`, no cheatcodes. The tests never
model the operational reality that **on a real node time only advances when
blocks are mined**, and they never assert anything about *how or when*
`block.timestamp` moves. They test a pure function of time while the actual
failure is that time isn't flowing. Unit tests over `f(timestamp)` can't
catch "the environment never changes `timestamp`."

## 4. The fixes

### One-off (unstick it right now, mid-demo)

Force the node to mine a block so the timestamp refreshes. Any of these works:

```bash
# Mine a single empty block (timestamp jumps to current wall time)
cast rpc evm_mine

# Or advance time explicitly, then mine
cast rpc evm_increaseTime 3600   # +1 hour
cast rpc evm_mine
```

Even sending a throwaway transaction does it — that's precisely what
"someone sends any unrelated transaction" was already doing for you. These are
manual, one-shot pokes: the display advances once and then freezes again until
the next block.

### Permanent (make the fork's clock tick on its own)

Put Anvil into **interval mining** so it produces a block every N seconds
whether or not anyone transacts. Then `block.timestamp` advances steadily and
the page behaves like it would against a live chain:

```bash
# Mine a block every 2s (matches Base) even with no transactions
anvil --fork-url <base-rpc> --block-time 2
```

In this repo that means adding the block-time flag to whatever the `fork`
script runs — e.g. in `package.json`:

```jsonc
"fork": "anvil --fork-url $BASE_RPC_URL --block-time 2"
```

(If you're on Hardhat instead, the equivalent is enabling interval mining:
`mining: { auto: true, interval: 2000 }` in the network config.)

With interval mining on, blocks — and therefore timestamps — advance
continuously, the claimable number counts up smoothly, and it no longer
depends on someone happening to send a transaction.

### A note for production robustness

Even after fixing the fork, remember that on a real chain the value only
updates when the user's wallet fetches a **new** block, and RPC providers can
serve slightly stale blocks. If you want the UI to *feel* live, compute the
displayed claimable amount client-side from `Date.now()` between reads (using
the same formula the contract uses), and reconcile against the on-chain value
on each new block. That decouples the smooth on-screen counter from block
cadence entirely — but it's a UX polish, not the cause of the freeze you saw.
