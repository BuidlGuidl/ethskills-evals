# Why the vesting clock freezes on a Base fork

## Short version

Nothing is wrong with your vesting math. The problem is Anvil's mining
policy: on a fork, Anvil mines a block **only when a transaction arrives**.
No transaction, no new block. No new block, no new `block.timestamp` — so
every `eth_call` your frontend makes reads the *same* timestamp over and
over, and the claimable balance is pinned to whatever it was when the last
block was mined.

## 1. The mining behavior

`yarn fork --network base` starts Anvil in its default auto-mine mode. In
that mode Anvil is purely reactive:

- It copies Base's state at the fork block and mines block N with a
  timestamp taken at startup.
- It then **idles**. It does not tick a clock, and it does not produce
  empty blocks the way a real chain does (Base produces a block every 2s
  whether or not anyone transacts).
- `block.timestamp` is a property of a *block*, not of the wall clock. Since
  no block is being produced, that value is literally constant.

Your vesting contract computes claimable from `block.timestamp`. Read-only
`eth_call`s execute against the latest block, so they all evaluate against
the same frozen timestamp. The frontend polls, re-reads, re-renders — and
faithfully displays the same number for as long as the demo lasts. Wall
clock minutes pass; chain time does not.

## 2. Why one unrelated transaction un-freezes it in a single jump

When *any* transaction shows up — a token approval, a faucet send, someone
poking a different contract — Anvil finally has a reason to mine. It builds
block N+1 and stamps it with the **current wall-clock time**, not with
"previous timestamp + 2 seconds".

So the new block's timestamp is ahead of the old one by the entire span the
fork sat idle. Your next `eth_call` reads that block, the vesting formula
sees the full elapsed interval at once, and the UI jumps by exactly the
amount that had been accruing invisibly. The transaction did not cause the
vesting; it merely caused a block, and the block carried all the missing
time with it. That is why the jump size always equals the freeze duration —
it is a catch-up, not a bug in accrual.

## 3. Why the forge tests never caught it

`vm.warp` sets `block.timestamp` directly inside the test EVM. The tests
assert something like "if the timestamp is T + 30 days, claimable is X" —
and that assertion is *true*. The math is correct.

What the tests cannot express is **who moves the timestamp forward, and
when**. In a forge test, the test itself is the time source: `vm.warp` is an
explicit, guaranteed advance. On a live fork, the time source is the mining
policy, and the mining policy is transaction-driven. The tests validate the
function of time; the freeze is a property of the environment that supplies
time. No unit test that hands itself the timestamp can detect that the real
runtime never hands you a new one.

This is the general shape of the bug: it silently breaks anything that reads
live chain time — vesting displays, auction/order deadlines, permit and swap
expiries, cooldowns, streaming payments — while the corresponding
`vm.warp` tests stay green.

## 4. The fixes

### One-off (unfreeze the running fork, no restart)

Turn on interval mining against the fork you already have open:

```bash
cast rpc anvil_setIntervalMining 1
```

Anvil now mines a block every second whether or not anyone transacts, so
`block.timestamp` advances continuously and the claimable balance ticks up
smoothly. Do this before the demo, not during it.

Do **not** reach for `evm_mine` here. Mining a single block restamps
`block.timestamp` once — the number lurches forward and then freezes again
immediately, reproducing the same problem one manual step at a time.
Likewise `evm_increaseTime` is a controlled single-step tool for tests, not
something that keeps a live UI moving. Both are the right tools for
deterministic step-through testing and the wrong tools for a running demo.

### Permanent (so the project always behaves this way)

Add `--block-time 1` to the fork script so every `yarn fork` starts with
interval mining already on. In `packages/foundry/package.json`, the `fork`
script's Anvil invocation becomes:

```
anvil --fork-url ${ALCHEMY_API_KEY:+...} --chain-id 31337 --block-time 1
```

Then `yarn fork --network base` produces a chain that advances on its own,
matching Base's real behavior closely enough that time-dependent UI is
honest during development.

Two things worth checking while you are in here:

- Make sure the frontend is pointed at `chains.foundry` (chain ID 31337),
  the local fork — not at Base itself. If it reads from upstream Base you
  get a moving clock but none of your local fork state.
- Consider adding a test that exercises the *display* path rather than the
  math path — the class of bug above lives between the contract and the UI,
  which is exactly where `vm.warp` cannot reach.
