# Why the vesting clock freezes on a local fork

Short version: your local fork does **not** produce blocks on a schedule. It produces
one block per transaction. `block.timestamp` is a value stamped into a block header at
mining time, so if no block is mined, `block.timestamp` cannot change — and every read
your frontend does is evaluated against that same frozen header. The wall clock keeps
running; the chain just never samples it. The first transaction anybody sends mines a
block, that block's timestamp is set from the current wall clock, and the whole elapsed
gap lands in one step.

Nothing is wrong with your vesting math. The bug is in the block-production policy of
the dev node.

---

## 1. The mining behavior that stops time

`yarn fork --network base` starts a local dev node (anvil `--fork-url …`, or
`hardhat node --fork …` depending on which flavour of the scaffold you're on) in its
default mining mode:

- **automine: on** — a block is mined immediately when a transaction is submitted.
- **interval mining: off** — no block is mined for any other reason.

So block production is entirely demand-driven. Idle node ⇒ zero blocks ⇒ the head of
the chain keeps the same header, including the same `timestamp`, forever.

Your frontend read is an `eth_call` (via wagmi/viem `useReadContract`). An `eth_call`
is executed against a block context derived from the current head — anvil uses the
latest block's timestamp; Hardhat builds a pending block on top of the head, so it may
use head + 1s. The exact convention doesn't matter: in both cases the value is a
function of the last *mined* block and is constant until another block is mined. A read
never mines anything, so polling harder does not help.

There's a second reason it looks *perfectly* still rather than merely laggy: wagmi
invalidates time-sensitive queries on new blocks. With `watch: true`, the underlying
`useBlockNumber` watcher never fires because the block number never increments, so in
many setups the query isn't even re-issued. And when it is re-issued, the node hands
back a byte-identical result. Both layers agree on a stale answer.

Note this is only visible on a fork/devnet. On real Base, blocks land every ~2 seconds,
so the same "sample the clock only at block boundaries" behavior is a ≤2s lag nobody
notices. Forking imports Base's *state and history*, not its block production — the
upstream sequencer keeps making blocks, your local chain does not follow them.

(If you pinned `--fork-block-number` to an old block, there's an extra wrinkle: your
local chain starts at that block's historical timestamp, which may be hours or days
behind wall clock. The node anchors its clock offset there, so the *first* block you
mine can jump by that entire offset at once, not just by the demo's idle time.)

## 2. Why one unrelated transaction un-freezes it in a single jump

When any transaction arrives — a token approval, a faucet drip, the burner wallet
sending 0 ETH, anything at all; it does not have to touch the vesting contract —
automine builds a block for it. The new block's timestamp is taken from the node's
current clock, roughly:

```
next.timestamp = max(parent.timestamp + 1, now + forkOffset)
```

So the header jumps forward by the *entire* real-time gap since the previous block, not
by one tick. Your vesting function is (piecewise) linear in `t`, so:

```
Δclaimable = rate × (now − lastBlockTimestamp)
```

which is precisely "the whole missing amount at once". The contract was never wrong;
it was answering a question about a moment in the past, and then the question moved
several minutes forward in one step. This is also why the effect is triggered by
*unrelated* transactions: the trigger is block production, not contract interaction.

## 3. Why the passing forge tests never caught it

`vm.warp` **sets** `block.timestamp` directly. Your tests are therefore of the form:

```solidity
vm.warp(start + 30 days);
assertEq(vesting.claimable(user), expected);
```

That tests `f(t)` — the vesting math as a pure function of a timestamp you supplied
yourself. It is a good test, and it passes because the math is right.

What it cannot test is **how `t` gets into the EVM at runtime**, which is exactly where
the defect lives. Specifically, forge's test EVM has no:

- block-production policy (no automine, no interval mining — `vm.warp` *is* the clock,
  and it never gets stale because you move it by hand),
- JSON-RPC layer, so no `eth_call` block-context semantics,
- frontend polling / cache-invalidation behavior.

By writing the timestamp yourself in every test, you assume away the only variable that
matters. The failure is an integration property — "does the head block's timestamp track
wall clock on this node?" — and the unit test layer has no way to observe it. Worth
noting the inverse too: `vm.warp` without `vm.roll` gives you a chain where time moves
and block numbers don't, which is a state the real world never produces; that's fine for
math tests but it's another reason these tests say nothing about node behavior.

The regression test that *would* catch it belongs at the RPC layer: connect a viem
client to the running fork, read `claimable`, wait ~10s, read again, assert the value
increased (and/or assert `getBlockNumber()` advanced with no transactions sent).

## 4. Fixes

### One-off — unfreeze the running node mid-demo

Any of these, against the fork's RPC (default `http://127.0.0.1:8545`):

```bash
# Mine a single block right now — jumps time to wall clock, exactly like a stray tx.
cast rpc evm_mine

# Better: switch the live node to interval mining without restarting it.
cast rpc anvil_setIntervalMining 2      # anvil: SECONDS
cast rpc evm_setIntervalMining 2000     # hardhat: MILLISECONDS
```

Mind the unit difference — passing `2` to Hardhat gives you a 2ms block time and will
melt the node; passing `2000` to anvil gives you a block every 33 minutes.

If you'd rather not touch the node's config, a shell heartbeat does the same job:

```bash
while true; do cast rpc evm_mine > /dev/null; sleep 2; done
```

And if you need to skip ahead deliberately (e.g. "show the cliff being reached"):

```bash
cast rpc evm_increaseTime 86400 && cast rpc evm_mine
```

### Permanent — make the fork produce blocks like the chain it's forking

Configure interval mining at ~Base's block time (2s) in the `fork` script/config so it's
on by default for everyone:

**anvil (Foundry flavour):**
```bash
anvil --fork-url "$BASE_RPC_URL" --block-time 2   # -b 2
```

**Hardhat:**
```ts
// hardhat.config.ts
networks: {
  hardhat: {
    forking: { url: process.env.BASE_RPC_URL! },
    mining: { auto: true, interval: [1900, 2100] }, // ms; jitter keeps it realistic
  },
}
```

Keep `auto: true` so transactions still confirm instantly; the interval only adds the
empty blocks that carry time forward. The one cost is that an idle node now accumulates
blocks indefinitely — memory and log growth over a long-running session — so restart it
between long sessions, or use the shell heartbeat instead if you want block production
only while you're demoing.

### Also worth doing — stop the UI from depending on block cadence

Even with a 2s block time you are rendering a value that is up to one block old, and on
other chains that's 12s+ of visible staleness. For a *display* number that should tick
smoothly:

- fetch the vesting parameters (`start`, `cliff`, `duration`, `total`, `released`) once,
  compute the displayed claimable client-side against `Date.now()`, and re-render on an
  animation/1s timer;
- keep the on-chain read as the source of truth for anything you actually submit (the
  claim tx), since the contract will recompute at execution time anyway;
- or, if you keep the raw read, label it "as of block N" so a frozen clock is
  immediately visible rather than mysterious.

That last point is the durable lesson: the frozen number was the UI faithfully reporting
a stalled chain. Making the block context visible turns a five-minute demo mystery into
an obvious "the node hasn't mined since 14:02".
