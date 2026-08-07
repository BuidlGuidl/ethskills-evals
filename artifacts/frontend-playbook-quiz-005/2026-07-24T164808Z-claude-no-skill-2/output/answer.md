# Why the vesting clock freezes on a local fork

## TL;DR

Your contract math is fine. The bug is in how the **local fork node produces
blocks**. `yarn fork` starts Anvil in **auto-mining** mode: it mines a block
*only when it receives a transaction*. `block.timestamp` is a property of a
mined block, so with no transactions there are no new blocks, and the timestamp
your view function reads never moves. The moment any transaction arrives, Anvil
mines one block whose timestamp is jumped forward to the current wall-clock
time — so all the "missing" minutes are applied at once, and a linear vesting
curve leaps by the whole accrued amount in a single step. `vm.warp` in your
forge tests sets the timestamp by hand, so it exercises the arithmetic but never
the node's time-advancement behavior — which is why the tests pass and still
miss this.

---

## 1. The mining behavior that makes time stand still

A few facts that combine into the freeze:

- **`block.timestamp` is not a clock.** It is a fixed field stamped onto a block
  when that block is mined. It does not tick between blocks. There is no
  "current time" the EVM can read except "the timestamp of the block I'm
  executing in."
- **Your claimable balance is a `view` call.** The frontend reads it with
  `eth_call` (via wagmi/viem polling, `useReadContract`, a `useEffect` loop,
  etc.). `eth_call` **executes against the latest mined block and never mines a
  new one** — it's a read. So it always sees the timestamp of whatever the most
  recent block is.
- **Anvil defaults to auto-mining, not interval mining.** In auto-mining mode
  Anvil mines a new block **only when a transaction is submitted** (`eth_sendRawTransaction`,
  `eth_sendTransaction`). It does **not** mine blocks on a wall-clock timer.

Put those together: during the demo nobody is sending transactions, so no new
blocks are produced. The "latest block" stays the same block for minutes. Every
poll of your `view` function runs against that same frozen block, reads the same
`block.timestamp`, and returns the same claimable number. The clock isn't
slow — from the chain's point of view, **no time has passed at all**, because
time only exists at block boundaries and no block has been minted.

This is specific to the local fork. On real Base, validators produce a block
roughly every ~2 seconds regardless of your activity, so `block.timestamp`
advances continuously and you never see the freeze in production. The frozen
behavior is a pure artifact of a single-user local node with nothing mining.

## 2. Why one unrelated transaction un-freezes it in a single jump

When *any* transaction hits the node (a faucet drip, an approval, someone
clicking a button, a background nonce bump), Anvil must include it, so it
**mines exactly one new block**.

The key detail is how Anvil chooses that new block's timestamp. By default it
uses the **real system clock**: the new block's timestamp is set to (roughly)
`max(previousBlockTimestamp + 1, now)`. Because several minutes of real
wall-clock time have elapsed since the last block was mined, `now` is minutes
ahead of the frozen timestamp. So the new block doesn't advance by 2 seconds —
it jumps forward by the **entire real-time gap** in one step.

Your vesting function is (linearly) a function of `block.timestamp`. When
`block.timestamp` discontinuously leaps forward by N minutes, `claimable` leaps
by exactly the N minutes' worth of accrual — "the whole missing amount at once."
The transaction's actual purpose is irrelevant; it's just what triggered a block
to be mined, and the block is what carried time forward.

So the two symptoms are the same phenomenon seen from two sides:
- **No tx → no block → timestamp frozen → number still.**
- **A tx → one block minted at `now` → timestamp jumps by the whole gap →
  number jumps.**

## 3. Why the passing forge tests never caught it

The tests are testing the wrong layer, correctly.

- `vm.warp(t)` is a **cheatcode that directly overwrites `block.timestamp`** in
  the test EVM. Your test then reads `claimable()` and asserts it equals the
  expected value for time `t`. That verifies the contract's **arithmetic**:
  "given timestamp t, the math is right." The math *is* right. That's why it's
  green.
- What `vm.warp` does **not** model is *how time advances on a live node*. In a
  forge test, time never moves on its own — it moves exactly when and where you
  warp it, synchronously, on demand. The tests therefore assume "time is
  available whenever I read it," which is precisely the assumption the
  auto-mining fork violates. The tests can't observe block production because
  there is none: a unit test is one synchronous EVM with no mining loop, no
  polling frontend, and no wall clock.
- The bug lives in the **environment / block-production policy**, not in the
  Solidity. No amount of `vm.warp`-based unit testing can surface it, because
  `vm.warp` is itself the thing standing in for the missing mining. To catch it
  you'd need an integration test against a running node that reads the value,
  waits real time *without* sending a tx, and asserts the value changed — which
  is a node-behavior test, not a contract test.

## 4. The fixes

### One-off (get through the demo right now)

Force the node to mine a block so time advances, without needing a "real"
transaction:

```bash
# mine a single empty block (advances block.timestamp to now)
cast rpc evm_mine

# or mine several
cast rpc anvil_mine 5
```

This is exactly what the "unrelated transaction" was doing by accident. You can
run it once when the number looks stale, or keep a loop in another terminal:

```bash
while true; do cast rpc evm_mine >/dev/null; sleep 2; done
```

Either produces blocks, each stamped at the current time, so the vesting number
advances smoothly instead of in one leap. This is a stopgap — it doesn't change
how `yarn fork` starts next time.

### Permanent fix

Make the fork **mine on an interval** so blocks (and therefore time) advance
continuously the way real Base does, whether or not anyone sends a transaction.
Add a block time to the Anvil invocation behind `yarn fork`:

```bash
anvil --fork-url <base-rpc> --block-time 2
#                            ^^^^^^^^^^^^^^  mine a block every 2s (matches Base)
```

In Scaffold-ETH, `yarn fork` maps to an Anvil command in
`packages/foundry/package.json` (the `"fork"` script). Add `--block-time 2`
(alias `-b 2`) there so every fork run mines steadily:

```jsonc
// packages/foundry/package.json
"fork": "anvil --fork-url ${...} --chain-id 31337 --block-time 2"
```

With interval mining, a fresh block is produced every 2 seconds with a timestamp
2 seconds later, `eth_call` always reads a near-current timestamp, and the
claimable balance ticks up smoothly — no freeze, no jump, and it now behaves
like production.

**Tradeoffs / notes:**
- Interval mining produces empty blocks when idle. That's fine for a demo and is
  what a real chain does anyway; it does mean the fork's chain height/time drift
  forward continuously.
- If you specifically need deterministic timing in some scripted scenario, keep
  auto-mine there and drive time explicitly with `evm_mine` / `evm_setNextBlockTimestamp`
  instead — but for a live demo UI, `--block-time` is the correct default.
- Optionally add an integration smoke test that starts the fork, reads
  `claimable()`, sleeps real time *without* sending a transaction, and asserts
  the value increased. That is the test that would have caught this, because it
  exercises node block production rather than `vm.warp`.
