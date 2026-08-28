# Block-count interest accrual: July reconciliation, and what happens on Base

## TL;DR

The contract does not measure time. It counts `block.number` and multiplies by a
hardcoded 12. That happens to be right on mainnet, and it happens to be right on
Arbitrum **for a reason that has nothing to do with Arbitrum's 250ms blocks** —
Arbitrum's `block.number` is the *L1* block number, not the L2 one. Base is an
OP Stack chain where `block.number` **is** the L2 block number, produced every
2 seconds. The same bytecode on Base charges **6x** the intended rate:
**20,384 USDC instead of 3,397** on 1,000,000 USDC over 31 days.

Do not deploy this to Base. Switch to `block.timestamp`.

---

## 1. The July reconciliation

### 1a. Why Arbitrum matched mainnet

Your instinct — "250ms blocks, so this should overcharge by ~48x" — is exactly
right about the mechanism and wrong only about which counter Arbitrum exposes.

On Arbitrum Nitro, the two block counters are deliberately split:

| Expression | Arbitrum One returns |
|---|---|
| `block.number` | An estimate of the **L1 (Ethereum) block number** at which the sequencer received the transaction. Monotonic, updated in jumps, tracks L1 within roughly a minute. |
| `ArbSys(0x64).arbBlockNumber()` | The actual **L2** block number — the one that advances every ~250ms. |
| `block.timestamp` | L2 wall-clock seconds (sequencer clock, bounded against L1). Real time. |

So `blocksElapsed` on the Arbitrum deployment is an L1 block count. The
hardcoded `SECONDS_PER_BLOCK = 12` is the correct conversion for L1 blocks.
The contract is measuring Ethereum time from inside Arbitrum, and the 12 is
accidentally, exactly right.

Two consequences worth naming:

- The two deployments don't merely agree by coincidence — they are reading the
  *same clock*. Any error in one is reproduced in the other. Cross-chain
  agreement here is **not** evidence of correctness; it's evidence that both
  contracts are metering L1 slots.
- The residual couple of dollars between them comes from (i) Arbitrum's L1
  block number lagging and advancing in jumps, so the window boundaries land on
  slightly different L1 blocks, and (ii) `accrueInterest()` being called on a
  different cadence on each chain, which changes the compounding path (see 1b).

Side effect you may have already noticed in logs: on Arbitrum many
state-changing calls hit `blocksElapsed == 0` and return early, because dozens
of L2 blocks pass per L1 block. That's harmless — it catches up — but it means
accrual is chunky rather than smooth there.

### 1b. Why both are a shade under 3,397

Target, simple interest:

```
1,000,000 x 4.00% x (31 / 365) = 3,397.26 USDC
```

For the contract to produce that, it needs to count exactly
`2,678,400 s / 12 = 223,200` blocks in the 31-day window. It counted fewer,
because **mainnet does not produce one block per 12 seconds** — it produces at
most one per 12-second slot, and a small fraction of slots are missed (proposer
offline, late block, reorged out). Missed slots make the contract's clock run
*slow*, so it undercharges.

Working backwards from the 3,391 you were charged:

| Assumption about accrual cadence | Implied blocks in July | Implied mean block time | Implied missed-slot rate |
|---|---|---|---|
| `accrueInterest()` called ~once (no compounding) | 222,789 (411 short) | 12.022 s | 0.18% |
| Called very frequently (near-continuous compounding) | 222,412 (788 short) | 12.043 s | 0.35% |

Both land in the normal range for mainnet missed slots. That is the whole gap.

Note the second row: `index += index * ...` compounds on **every call**, so the
charge depends on how often somebody happens to call the public
`accrueInterest()`. Continuous compounding at 4% over 31 days is 3,403.04 vs
3,397.26 simple — about +5.78 USDC on this position. That pushes *up* while
missed slots push *down*, and they partly cancel, which is why the observed
shortfall is only ~6 USDC. It also means the true missed-slot deficit is
probably nearer 0.35% than 0.18%.

**So: two independent errors of similar size in opposite directions.** The
month reconciled to within 0.2% by luck, not by construction. Two smaller
contributors to keep in mind: the reconciliation window is defined by whichever
blocks happened to carry an accrual, not by midnight on the 1st and the 31st;
and `365 days` = 31,536,000 s ignores leap years (fine, but it's a convention
Finance should have written down).

---

## 2. What this code does on Base

Base is OP Stack. `block.number` is the **L2** block number. The sequencer
produces one L2 block every **2 seconds**, unconditionally — including empty
blocks. There is no missed-slot deficit; the count is deterministic.

Same 1,000,000 USDC, same 31 days:

```
elapsed real time     = 31 x 86,400            = 2,678,400 s
Base blocks produced  = 2,678,400 / 2          = 1,339,200 blocks
blocksElapsed         =                          1,339,200
secondsElapsed        = 1,339,200 x 12         = 16,070,400 s   <-- 186 days
                                                                    of "time"
interest fraction     = 4.00% x 16,070,400 / 31,536,000 = 2.038356%
charge (simple)       = 1,000,000 x 2.038356%  = 20,383.56 USDC
charge (compounded    = 1,000,000 x (e^0.0203836 - 1)
  every block)                                 = 20,592.73 USDC
```

| | Mainnet / Arbitrum | Base |
|---|---|---|
| Intended 31-day charge | 3,397.26 | 3,397.26 |
| Actual charge | ~3,391 | **20,384 – 20,593** |
| Error | -0.2% | **+500% (6.00x)** |
| Effective borrow rate | 4.00% | **24.00% nominal, 27.12% APY** |

The factor is exactly `12 / 2 = 6`. It is not a rounding artifact and it does
not wash out over time — every month a 1,000,000 USDC borrower is overcharged
about **17,000 USDC**.

Three further hazards specific to Base:

1. **Block time is not a constant you can hardcode against.** Base has publicly
   targeted sub-2s blocks (Flashblocks preconfirmations, and a roadmap toward
   1s). If the canonical block time becomes 1s, the multiplier silently goes
   from 6x to 12x with no contract change and no event. Verify Base's current
   `l2BlockTime` in the chain config before you trust any number above — and
   note that a fix that hardcodes `SECONDS_PER_BLOCK = 2` would break again the
   day that parameter changes.
2. **Mainnet isn't permanently safe either.** Ethereum has live proposals to
   shorten the slot (e.g. EIP-7782, 6s). The 12 is a bet on a consensus
   parameter you don't control, on every chain.
3. **Precision — check your index scale.** On a 2s chain the per-call term is
   `index * 400 * 2 / 315,360,000,000`. If `index` is WAD-scaled (1e18) this is
   fine. If `index` is anything like 1e6-scaled (USDC-native), integer division
   floors to **zero** on every call and accrual stops entirely. Confirm the
   scale before this reaches any fast chain; it is a different bug with the
   opposite sign, hiding behind the same line.

---

## 3. What I'd change

### The fix: measure time with the clock, not with a block counter

```solidity
-   uint256 constant SECONDS_PER_BLOCK = 12;
-   uint256 public lastAccrualBlock;
+   uint256 public lastAccrualTime;

    function accrueInterest() public {
-       uint256 blocksElapsed = block.number - lastAccrualBlock;
-       if (blocksElapsed == 0) return;
-       uint256 secondsElapsed = blocksElapsed * SECONDS_PER_BLOCK;
+       uint256 secondsElapsed = block.timestamp - lastAccrualTime;
+       if (secondsElapsed == 0) return;
        index += index * rateBps * secondsElapsed / (10_000 * 365 days);
-       lastAccrualBlock = block.number;
+       lastAccrualTime = block.timestamp;
    }
```

`block.timestamp` is real seconds on all three chains and carries no assumption
about block production:

- **Mainnet:** proposer can nudge it by a few seconds within consensus bounds.
  At 4%/yr a few seconds is worth ~1e-8 of the position. Irrelevant here.
- **Base / OP Stack:** deterministic 2s steps, derived from L1. Exact.
- **Arbitrum:** sequencer clock, bounded against L1. Real time to within
  seconds.

This also removes the mainnet undercharge — the missed-slot gap simply
disappears, because missed slots don't stop the clock. Expect the July-
equivalent figure to move from 3,391 up to 3,397.26 (plus compounding).

### Decide compounding explicitly

Today the charge depends on how many times anyone chose to call the public
`accrueInterest()`. That's path-dependent and cheaply manipulable at the
margin: a borrower who never triggers accrual pays simple interest, one whose
position is touched every block pays continuously compounded. At 4% the spread
is ~5.8 USDC per 1M per month — small, but it's a free option and it's the kind
of thing that shows up in an audit finding. Either:

- **Accept discrete compounding** and document it as the product's definition
  of the rate (simplest; what most lending markets do). Quote borrowers an APY
  of `e^0.04 - 1 = 4.081%`, not 4.00%, so the docs match the code; or
- **Accrue simple interest** against a stored principal-and-start-time, if
  Finance wants the quoted 4.00% to be literally what's charged.

I'd take the first. It's one line of documentation instead of a restructure.

### Before Base goes out

1. Apply the timestamp fix and redeploy — do not ship the current bytecode.
2. Confirm the `index` scale is 1e18-ish (hazard 3 above).
3. Add a test that runs the accrual over a simulated 31 days at 2s, 12s, and
   0.25s block intervals and asserts the same charge in all three. That single
   test would have caught this, and it will catch the next block-time change.
4. Grep the rest of the codebase for `block.number` used as a proxy for elapsed
   time — liquidation delays, timelocks, rate-change cooldowns, oracle
   staleness checks. This pattern is rarely alone, and a timelock that is 6x
   too short on Base is a worse finding than the interest bug.

### On the two live deployments

They're undercharging by ~0.2–0.35% (roughly 6–12 USDC per 1M per month). Not
urgent, but it is systematic, it favours borrowers, and it will drift with
mainnet's missed-slot rate. I'd migrate both to the timestamp version on the
next scheduled upgrade rather than as a hotfix, and let Finance decide whether
the accrued shortfall gets trued up or written off.

---

## Unresolved questions

1. What scale is `index`? (Determines whether hazard 3 is live.)
2. Are these contracts upgradeable, or does fixing mainnet/Arbitrum mean a
   migration?
3. Does Finance want 4.00% to mean nominal-with-compounding (4.081% APY) or
   literally 4.00% charged?
4. Confirmed current value of Base's `l2BlockTime` at your target deploy date —
   the 6x above assumes 2s.
