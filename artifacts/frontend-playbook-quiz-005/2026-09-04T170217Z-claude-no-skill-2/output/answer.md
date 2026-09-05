# Why the claimable balance freezes on a local fork

**Short version:** your contract is fine and your tests are fine. A forked local node
(`anvil --fork-url ...` / `hardhat node --fork ...`) mines a block *only when a transaction
arrives*. `block.timestamp` is a field of the newest block, not a reading of the wall clock,
so with no transactions there is no new block, and therefore no new timestamp. The chain's
clock is stopped, not slow.

---

## 1. The mining behavior: auto-mine means "mine on transaction", not "mine on a schedule"

Both local dev nodes default to **auto-mining**: one block per transaction, produced the
instant the transaction is accepted. There is no background block producer. That default is
great for scripted tests (every `cast send` confirms instantly, no waiting) and it is exactly
wrong for a demo that displays a time-dependent value.

Real Base produces a block every 2 seconds whether or not anyone transacts, so on the real
chain `block.timestamp` advances on its own. Your fork inherits Base's *state* at the fork
block; it does not inherit Base's *sequencer*. Nothing on your machine is producing blocks.

Now follow the read path for your vesting page. `useScaffoldReadContract` / wagmi
`useReadContract` issues an `eth_call`. An `eth_call` is executed against the chain head: the
state and the block header of `latest`. The `block.timestamp` your view function reads is the
timestamp of that head block — the last block that was actually mined. It is **not** sampled
from your system clock at call time.

So the loop is:

- No transactions → no new blocks → `latest` never changes.
- Every `eth_call` executes in the context of the same header, with the same timestamp.
- `elapsed = block.timestamp - vestingStart` returns a constant.
- The frontend can poll this every 500ms for ten minutes and get a bit-identical answer every
  time. It looks like a broken UI; it is a correct render of a stopped clock.

There is a second, quieter failure stacked on top of this in Scaffold-ETH: the read hooks
refetch **on new blocks** (they watch `useBlockNumber`). With no blocks, there is nothing to
trigger a refetch either. Two independent mechanisms both key off block production, and both
stall.

## 2. Why one unrelated transaction un-freezes it in a single jump

Because the timestamp belongs to the *block*, not to the transaction.

When anyone sends any transaction — a token approval, a faucet drip, a stray tx from another
tab — auto-mine wakes up and produces a block immediately. When the node builds that block it
has to pick a timestamp, and it picks one derived from the host's **wall clock** (roughly
`max(parent.timestamp + 1, now + configured_time_offset)`; Hardhat additionally refuses to
reuse the parent's timestamp by default). The node has been idle for, say, seven minutes, so
the new header carries a timestamp seven minutes ahead of the previous one.

That single block is a 420-second leap in chain time. Every contract on the fork experiences
it simultaneously. Your next `eth_call` now runs against the new head and the vesting math
does what it was always going to do: it releases the entire seven minutes of accrual at once.

The jump is not a bug being triggered; it is the accumulated correct answer arriving in one
piece. Chain time is a step function sampled at block boundaries, and on an idle fork you have
one very wide step. On real Base the same step function has 2-second treads, which is why it
looks continuous in production.

Worth noting for your own sanity-check: the *initial* value on page load usually looks
plausible, because the fork's first block inherits Base's real timestamp. Only the
*advancement* is broken, which is why this survives a quick smoke test and only shows up when
someone watches the number for a few minutes — i.e. during the demo.

**Confirm it in ten seconds:**

```bash
cast block latest --field timestamp; sleep 30; cast block latest --field timestamp
# identical => the chain clock is stopped
date +%s   # ...and reality has moved on by 30
```

## 3. Why the passing forge tests never caught it

Your tests and the bug live in disjoint universes, and `vm.warp` is precisely the seam.

`vm.warp(t)` sets `block.timestamp` by fiat. In a forge test **the test is the block
producer** — you decide what time it is, on demand, for free. Your tests therefore assert a
pure property of the contract:

> given `block.timestamp == T`, `claimable()` returns `X`.

That property is true. It is true on Base, on your fork, and in the test harness. The tests
are correct and they are testing the right thing about the vesting math.

The defect is one level down, in a layer forge deliberately does not model: **who advances
`block.timestamp`, and when.** Specifically, the tests cannot see any of it —

- **No node, no mempool, no mining policy.** There is no auto-mine setting to get wrong,
  because there is no block production at all. A test can't observe "the timestamp fails to
  advance on its own," because in a test it never advances on its own — the test always
  supplies it. The buggy behavior and the test harness's normal behavior are *the same
  behavior*.
- **No JSON-RPC.** Tests call the contract via internal EVM calls. They never exercise
  `eth_call`-against-`latest`, which is where the stale header actually enters the picture.
- **No wall clock.** Nothing in a forge test relates chain time to real time, so "chain time
  has drifted 7 minutes behind reality" is not an expressible assertion.
- **No frontend.** The refetch-on-new-block coupling in the React hooks is invisible to Solidity
  tests by construction.

`vm.warp` in a test is doing, manually and correctly, the exact job that nothing is doing on
your fork. Passing tests told you "the math is right." They never claimed "time will pass."

The generalisable lesson: unit tests cover contract logic; **dev-environment time semantics
need an integration check against the running RPC.** A three-line preflight script (read the
head timestamp, wait, read it again, fail if unchanged) covers this whole bug class, and is
worth putting in your demo checklist or CI-against-anvil job. Do **not** change the contract —
this is a local-fork artifact and the deployed behaviour on Base is correct.

## 4. One-off fix (mid-demo, no restart, node keeps its state)

Mine a block yourself. Anything that produces a block pulls chain time up to wall time:

```bash
cast rpc evm_mine                       # one block, timestamp snaps to now
```

Your page updates on the next poll. If you want to *drive* the demo — show a year of vesting
without waiting a year — jump deliberately:

```bash
cast rpc evm_increaseTime 2592000       # +30 days (offset persists for later blocks)
cast rpc evm_mine                       # the increase only lands once a block is mined
```

or pin an exact time:

```bash
cast rpc evm_setNextBlockTimestamp 1788000000
cast rpc evm_mine
```

No `cast` on the demo machine? Same thing over HTTP:

```bash
curl -s -X POST http://127.0.0.1:8545 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"evm_mine","params":[]}'
```

Note that `evm_increaseTime` sets a *persistent offset*, not a one-shot bump — repeated calls
accumulate, and every later block keeps the accumulated skew. That's usually what you want for
a scripted demo, but it means your fork's clock is now permanently ahead of reality; don't be
surprised by it afterwards.

A ticking-heartbeat variant, still without restarting the node:

```bash
cast rpc evm_setIntervalMining 2        # start producing a block every 2s, live
```

That is the permanent fix applied at runtime, and it's the right emergency move if the demo
still has ten minutes left to run. (Hardhat's node accepts `evm_mine`,
`evm_setIntervalMining` and `hardhat_mine` as well.)

## 5. Permanent fix: run the fork with interval mining that matches the chain you forked

Stop relying on auto-mine for anything time-dependent. Give the fork a heartbeat equal to the
real chain's block time — Base is **2 seconds**.

**Foundry / anvil** — in `packages/foundry/package.json`, add `--block-time 2` to the `fork`
script:

```jsonc
"fork": "anvil --fork-url ${ALCHEMY_BASE_URL} --chain-id 31337 --block-time 2"
```

**Hardhat** — in `packages/hardhat/hardhat.config.ts`, under `networks.hardhat`:

```ts
mining: {
  auto: true,        // still mine immediately on a tx
  interval: 2000,    // ...and also every 2s regardless
},
```

Hardhat lets you keep both; anvil's `--block-time` switches it into interval mining, so
transactions wait for the next tick instead of confirming instantly. That costs you up to two
seconds of confirmation latency in local dev — which is not a regression, it is the production
behavior you were previously papering over. If some script genuinely needs instant inclusion,
keep a second no-`--block-time` profile for it rather than making the demo fork lie about time.

Two follow-ups worth doing while you're in there:

- **Don't let the UI's freshness depend on block production alone.** Add a `refetchInterval` to
  the claimable read so it re-polls on a timer as well as on new blocks. Belt and braces.
- **For a smooth demo, interpolate client-side.** Even with 2-second blocks the number advances
  in visible steps. Anchor to the last on-chain read and tick the display locally
  (`claimable + rate * (Date.now()/1000 - lastReadTimestamp)`), re-anchoring on every fetch.
  Display only — always send the transaction against the contract's own value, never the
  interpolated one.

---

### Summary

| | |
|---|---|
| **Root cause** | Fork defaults to auto-mine: blocks exist only when transactions do. `eth_call` reads `block.timestamp` off the head block's header, so with no blocks it is a frozen constant. |
| **Why one tx fixes it, loudly** | Any transaction mines a block; the node stamps that block from the host wall clock, so the whole idle interval lands in one header and the full accrual releases at once. |
| **Why tests passed** | `vm.warp` *is* the thing that's missing on the fork. Tests assert the math given a timestamp; block production, `eth_call` semantics and wall-clock drift are outside the forge harness entirely. The contract is correct. |
| **One-off** | `cast rpc evm_mine` (or `evm_increaseTime` + `evm_mine` to jump on purpose). |
| **Permanent** | `anvil --block-time 2` (or Hardhat `mining: { auto: true, interval: 2000 }`) to match Base's 2s blocks; plus a `refetchInterval` on the read. |
