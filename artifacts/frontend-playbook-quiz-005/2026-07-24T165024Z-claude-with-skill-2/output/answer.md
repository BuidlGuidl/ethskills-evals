# Why the vesting clock freezes on the fork

## Short version

`yarn fork --network base` runs an **Anvil** node in its default **on-demand
("auto") mining** mode. Anvil only produces a block when it has a transaction to
put in it. No transaction → no new block → `block.timestamp` never advances → your
contract's `claimable = f(block.timestamp)` returns the exact same number every
time the frontend reads it. When someone finally sends *any* transaction, Anvil
mines one block and stamps it with the **current wall-clock time**, so the chain's
clock leaps from "minutes ago" to "now" in a single step — and the claimable
amount jumps by the whole interval at once.

Nothing is wrong with your vesting math. The bug is in the local chain's mining
configuration.

---

## 1. Why time stands still

A real chain (Base) produces a block on a fixed cadence (~2s) whether or not
anyone is transacting. Every new block carries a fresh, larger `timestamp`, so any
timestamp-derived value drifts upward continuously.

A local Anvil fork does **not** do this by default. Its default behavior is:

- **Auto/instant mining, on demand only.** Anvil mines a block *when a transaction
  arrives*, and otherwise sits idle. There is no background block production.
- Your "claimable balance" is not a transaction — the frontend reads it with an
  `eth_call` against the **latest block**. `eth_call` is a pure read: it executes
  the contract against the state and `block.timestamp` of whatever the latest block
  already is. It does **not** create a block or advance the clock.

So the loop is: frontend polls every few seconds → each poll is an `eth_call`
against the same latest block → same `block.timestamp` → same result. The UI is
polling faithfully; the number it's reading genuinely has not changed, because the
chain's clock has not moved. Minutes of real wall-clock time pass while the fork's
`block.timestamp` is stuck at the value it had when the last block was mined.

## 2. Why one transaction un-freezes it in a single jump

When someone sends an unrelated transaction, Anvil finally has a reason to mine a
block. When it builds that block it sets the new block's `timestamp` to the
**current system (wall-clock) time**, not `previous + 1`. Since the previous block
was mined several minutes ago, the timestamp leaps forward by that entire gap in
one move.

Your vesting formula computes claimable from *elapsed time since start*. It doesn't
receive time in small increments — it just reads the new, much-larger
`block.timestamp` and computes the correct amount for *that* instant. Because the
clock jumped by the whole missing interval at once, the claimable amount jumps by
the whole missing amount at once. The transaction itself is irrelevant to vesting;
it merely triggered the block that carried the timestamp forward.

## 3. Why the passing forge tests never caught it

The forge tests exercise the *math*, using `vm.warp(t)` to set `block.timestamp`
directly:

```solidity
vm.warp(start + 30 days);
assertEq(vesting.claimable(user), expectedFor30Days); // passes
```

`vm.warp` is a cheatcode that **forces** the timestamp to an exact value inside an
isolated in-memory EVM. The tests therefore prove: *given a timestamp, the
contract computes the right claimable amount.* That is true, so they pass — and
they should.

But `vm.warp` completely bypasses the thing that's actually broken: **automatic
block production over real time.** The tests never depend on the clock advancing on
its own; they set it by hand. The freeze is a property of the *node's mining
mode* in fork mode, a layer the unit tests don't touch at all. You have correct
math running on a chain whose clock isn't ticking — and a test suite that only ever
validates the math. Right code, wrong layer.

## 4. The fixes

### One-off (rescue a live demo)

Force the fork's clock forward by mining a block. From another terminal:

```bash
# Turn on 1-second interval mining for the rest of the session
cast rpc anvil_setIntervalMining 1
```

or, to nudge it a single time:

```bash
cast rpc evm_mine          # mine one block, stamped at current wall-clock time
```

Either makes the latest block's `timestamp` current, and the claimable balance
updates on the next poll — without anyone sending a transaction.

### Permanent (so it never freezes again)

Make the fork mine on a fixed interval, mirroring the real chain. Edit the fork
script in `packages/foundry/package.json` and add `--block-time 1` to the Anvil
invocation:

```jsonc
// packages/foundry/package.json
"fork": "anvil --fork-url ... --chain-id 31337 --block-time 1"
```

Now `yarn fork --network base` produces a block every second regardless of
activity, `block.timestamp` advances continuously, and any timestamp-dependent
logic (vesting, deadlines, expiries, TWAPs) behaves the way it will on Base.

> This is a general rule for local fork development: **any contract logic that
> reads `block.timestamp` needs interval mining enabled**, or it will appear frozen
> and then jump — silently, and invisible to `vm.warp`-based tests.
