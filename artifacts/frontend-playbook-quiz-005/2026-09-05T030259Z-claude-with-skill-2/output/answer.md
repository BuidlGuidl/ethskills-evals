# Frozen `block.timestamp` on an Anvil fork

Nothing is wrong with your vesting math. The clock the contract reads is not running.

## 1. The mining behavior: Anvil mines on demand, not on a schedule

`yarn fork --network base` starts Anvil in its default **auto-mining** mode: it mines a
block *when a transaction arrives*, and at no other time. There is no background block
producer the way there is on real Base (2s blocks).

Your page reads the claimable balance with an `eth_call` against the latest block. An
`eth_call` is not a transaction — it does not mine anything. So the latest block stays
the same block, with the same `block.timestamp`, for as long as nobody sends a
transaction. Every poll re-executes `vestedAmount(block.timestamp)` against a timestamp
that is byte-for-byte identical to the previous poll's, so the UI returns the identical
number. Minutes of wall-clock time pass; zero chain time passes.

This is why the freeze looks like a frontend bug and isn't. Your polling, your
`useScaffoldReadContract`, your RPC are all working perfectly — they are faithfully
re-reading a chain whose clock has stopped.

## 2. Why one unrelated transaction un-freezes it in a single jump

When any transaction finally arrives — a token transfer, someone hitting a different
button, a `yarn deploy` — Anvil mines a block to include it, and it stamps that new block
with the **current wall-clock time**. The chain does not replay the intervening seconds
as a series of blocks; it goes straight from the old timestamp to now.

So if the fork sat idle for 7 minutes, the next block's `block.timestamp` is 420 seconds
later than the previous one. Your next `eth_call` reads that timestamp and the linear
vesting curve returns 420 seconds' worth of tokens that it "owed" the whole time. The
number lurches by exactly the amount that accrued while the display was frozen — which is
the giveaway symptom: the jump size always equals the freeze duration times the vesting
rate.

The transaction being unrelated is the point. It isn't interacting with the vesting
contract at all; it is just the thing that causes a block to be mined, and mining the
block is what advances the clock.

## 3. Why the passing forge tests never caught it

`vm.warp` **is** the bug, reproduced deliberately, and then asserted to be correct.

Your tests do something like:

```solidity
vm.warp(start + 30 days);
assertEq(vesting.claimable(user), expected);
```

`vm.warp` sets `block.timestamp` by fiat. That is exactly the "time only moves when
something forces it to move" behavior you are seeing on the fork — the test just happens
to force it at the right moments, so the math always evaluates at the timestamps the
assertions expect.

The tests verify a pure function of time: *given* timestamp T, is the claimable amount
correct? They pass, and they should pass — the vesting math is right. What no unit test
of that shape can observe is **whether T advances on its own between reads**. That is a
property of the node's mining policy, not of the contract, and there is no assertion in a
Foundry test that would ever exercise it. A live UI polling a real node is the first place
the gap shows up, which is why the demo is where you found it.

The general lesson: `vm.warp` tests prove your time math. They say nothing about whether
your demo environment has a running clock. Anything with a live deadline, expiry,
countdown, auction end, streaming/vesting accrual, or TWAP display needs to be checked
against a fork that is actually mining.

## 4. The fixes

### One-off (fixes the running fork right now, no restart)

In a new terminal, against the already-running fork:

```bash
cast rpc anvil_setIntervalMining 1
```

Anvil now mines a block every second whether or not there are transactions. Your
claimable number starts ticking immediately, and it keeps ticking through the demo. This
takes effect on the live node — you do not have to restart the fork or redeploy, so it is
safe to run mid-demo if you spot the freeze on stage.

### Permanent (survives restarts, fixes it for the whole team)

Add `--block-time 1` to the fork script in `packages/foundry/package.json`:

```jsonc
{
  "scripts": {
    // before: "anvil --fork-url ... --chain-id 31337"
    "fork": "anvil --fork-url ${FORK_URL} --chain-id 31337 --block-time 1"
  }
}
```

Every `yarn fork --network base` from then on starts with interval mining on. This is the
fix you actually want committed — the `cast rpc` call is per-process and is lost the next
time anyone restarts the chain, which means the next person to run the demo hits the
identical bug.

### What *not* to reach for here

`evm_mine` and `evm_increaseTime` are the wrong tool for this, though they are the right
tool for other things:

- `evm_mine` mines exactly one block and restamps `block.timestamp` once. Your number
  updates a single time and then freezes again. Under a live demo you would be typing it
  over and over.
- `evm_increaseTime` jumps the clock forward by a fixed offset on demand. Useful for
  "show me the state 30 days from now", useless for a smoothly ticking display.

Both are correct and precise for controlled, single-step scenario tests where you *want*
the clock to hold still between steps. Neither substitutes for interval mining under
anything with a running clock in front of an audience.

## Verifying the fix

```bash
# Should print two different, increasing numbers ~3s apart, with no tx sent in between:
cast block latest --field timestamp --rpc-url http://127.0.0.1:8545
sleep 3
cast block latest --field timestamp --rpc-url http://127.0.0.1:8545
```

If the two values are identical, the clock is still frozen. If the second is ~3 higher,
the fork is mining and your vesting display will tick.

## One thing to double-check while you're in here

A ticking chain only shows up in the UI as fast as the frontend re-reads it. Confirm
`scaffold.config.ts` has `pollingInterval: 3000` — the SE2 default is tuned for real
mainnet block times and can make a correctly-mining fork still look sluggish. That is a
separate, much smaller issue from the freeze, but it is the next thing you'd notice.
