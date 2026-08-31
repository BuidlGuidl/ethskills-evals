# Block-number interest accrual: mainnet vs Arbitrum vs Base

**Short version:** the contract is not correct on Arbitrum — it is *accidentally*
correct, for a reason that does not generalize. Arbitrum's `block.number` is not
Arbitrum's block number. Base's `block.number` *is* Base's block number, so the
same bytecode on Base overcharges by **6x**. Do not ship it.

---

## 1. The July reconciliation

### 1a. Why Arbitrum agreed with mainnet

Your intuition about 250ms blocks was right about the chain and wrong about the
opcode. On Arbitrum One, Solidity's `block.number` (the `NUMBER` opcode) does
**not** return the L2 block number. ArbOS overrides it to return an estimate of
the **L1 (Ethereum) block number**. The L2 block number is only reachable via
`ArbSys.arbBlockNumber()` (precompile `0x64`).

So on Arbitrum this contract is reading an Ethereum block counter that ticks at
Ethereum's ~12s cadence. `SECONDS_PER_BLOCK = 12` happens to be the right
constant for the value it is actually reading. The two deployments agree because
**both are metering the same clock** — the Ethereum slot counter.

The "couple of dollars" residual between the two is the L1-block-number estimate
lag. ArbOS refreshes its L1 view on a delay (order of a minute, sometimes a few);
over a 31-day window only the *difference* in lag between the two endpoints
matters, so a few minutes of skew is a few tens of blocks out of ~223,000 —
around 0.01%, or well under a dollar on this position. Matches what you saw.

For scale, here is the number you were bracing for. Had `block.number` returned
the L2 block number at 250ms:

```
31 days = 2,678,400 s  ->  10,713,600 L2 blocks
10,713,600 x 12 s      =  128,563,200 "seconds" = 1,488 days
1,000,000 x 4% x 1488/365 = 163,068 USDC
```

~48x the correct charge (48 = 12s / 0.25s). Your arithmetic was sound. The only
thing standing between you and that outcome is an ArbOS quirk you did not know
you were relying on.

### 1b. Why both are a shade under 3,397

The reference figure is simple interest:

```
1,000,000 x 0.04 x 31/365 = 3,397.26 USDC
```

The contract charged 3,391 — short by 6.26, or **0.184%**.

That gap is **missed Ethereum slots**. Post-Merge, Ethereum slots are exactly 12
seconds apart, but a slot with no proposed block still advances wall-clock time
while `block.number` does not move. A perfect month would be
2,678,400 / 12 = **223,200** blocks. A 0.184% shortfall implies about **222,788**
blocks produced — roughly **412 missed slots** across the month. That is squarely
in the normal mainnet range (typically 0.1-0.5% of slots, varying month to
month). Arbitrum inherits the identical undercount, because its L1 block estimate
is derived from blocks that actually landed.

So the mechanism is: `blocksElapsed * 12` measures *slots that produced a block*,
not elapsed time. It is a systematic **under**charge on Ethereum, drifting with
network health, and it is not constant month to month — expect the July 0.18% to
be 0.3% or 0.1% in other months. It is a real (small) revenue leak and a real
source of unexplainable reconciliation variance.

**One caveat on the 0.184% figure.** `index += index * ...` compounds on every
call, so the true charge depends on how often `accrueInterest()` was called.
Called once for the month it yields 3,397.26; called continuously it converges to
`1,000,000 x (e^(0.04 x 31/365) - 1)` = 3,403.07. The observed 3,391 sits below
both, so the block-drag is somewhere between 0.18% and 0.35% depending on the
real call pattern. Either way the story is the same — and note the second-order
point that **the amount a borrower owes is a function of how often a permissionless
function was called.** At 4% that spread is ~6 USDC/month and tolerable; it does
not stay tolerable at higher rates.

---

## 2. What this does on Base

Base is an OP Stack chain, and OP Stack does **not** override `NUMBER`.
`block.number` on Base is Base's own L2 block number, advancing every **2
seconds**, deterministically — the sequencer produces a block every slot,
including empty ones, so there is no missed-slot undercount to partially offset
the error.

```
31 days                    = 2,678,400 real seconds
Base blocks in that window = 2,678,400 / 2 = 1,339,200
secondsElapsed (contract)  = 1,339,200 x 12 = 16,070,400   <- 186 days
interest = 1,000,000 x 0.04 x 16,070,400 / 31,536,000
         = 1,000,000 x 0.04 x 0.509589
         = 20,383.56 USDC
```

**20,384 USDC instead of 3,397 — a 6x overcharge (6 = 12s / 2s), an effective
24.00% APR on a product sold as 4.00%.** Overcharge of ~16,986 USDC on this one
position, per month, compounding.

This is not just a billing error. Debt is being marked up 6x too fast, so
health factors decay 6x too fast and borrowers get liquidated on positions that
are actually solvent. That is the part that turns a reconciliation problem into
an incident.

And the multiplier is not stable. Base has been driving block times down
(1-second blocks, and Flashblocks preconfirmations in the 200ms range). Whatever
the canonical block interval is on launch day, it is a chain-governance parameter
you do not control:

| Base block time | multiplier | 31-day charge | effective APR |
|---|---|---|---|
| 2 s (current canonical) | 6x | 20,384 | 24% |
| 1 s | 12x | 40,767 | 48% |
| 250 ms | 48x | 163,068 | 192% |
| 200 ms | 60x | 203,836 | 240% |

A block-time reduction on Base is shipped by Base, not by you, and it silently
multiplies your interest rate. Same tail risk exists on mainnet in the other
direction: if Ethereum reduces slot time to 6s (an active roadmap item), your
existing mainnet deployment starts charging **half** the intended rate overnight,
with no code change and no alert.

---

## 3. What I would change

### The fix: stop counting blocks, read the clock

`block.timestamp` is well-defined and chain-agnostic. On mainnet it is the slot
timestamp. On OP Stack it is exact and deterministic. On Arbitrum it is the L2
timestamp, kept close to real time by the sequencer and monotonic. Blocks are a
chain-specific implementation detail; seconds are not.

```solidity
uint64 public lastAccrualTime;   // was: uint256 lastAccrualBlock

function accrueInterest() public {
    uint256 nowTs = block.timestamp;
    uint256 secondsElapsed = nowTs - lastAccrualTime;
    if (secondsElapsed == 0) return;
    index += index * rateBps * secondsElapsed / (10_000 * 365 days);
    lastAccrualTime = uint64(nowTs);
}
```

That is the whole change. It removes the `SECONDS_PER_BLOCK` constant, the
missed-slot drag, and the entire class of per-chain-deployment bug — one code
path, correct on all three chains.

**Do not** "fix" it by making `SECONDS_PER_BLOCK` a per-chain constructor
argument. It would work on deploy day and rot the moment a chain retunes its
block time, with no on-chain signal that anything changed. You would be
hardcoding a number that another team controls.

### Before you deploy anywhere, also confirm

1. **`index` scale.** With floor division, each accrual truncates. If `index` is
   scaled at 1e18 or 1e27 the loss is sub-wei and irrelevant. If it is scaled at
   1e6 (USDC-like), then `1e6 * 400 * 12 / (1e4 * 31_536_000)` truncates to
   **zero** — every short accrual would round away and interest would stop
   accruing entirely. Your July numbers imply the scale is fine, but verify it,
   because moving to timestamps makes short intervals more common.

2. **Monotonicity guard.** With `uint64` timestamps and unchecked arithmetic
   patterns, assert `nowTs >= lastAccrualTime` (or keep it in checked math) so a
   sequencer clock artifact can never underflow into an enormous elapsed time.

3. **Day-count convention.** `365 days` is act/365-fixed. Confirm that is what the
   loan documents say, and that Finance reconciles against the same convention —
   act/360 or act/365.25 will produce a persistent, correct-looking discrepancy
   that people waste weeks chasing.

4. **Call-frequency dependence.** The charge still varies with how often
   `accrueInterest()` is called, bounded by continuous compounding. At 4% that is
   ~6 USDC/month on a 1M position — fine, but document it as intended behavior so
   it is not rediscovered as a bug, and re-examine if you ever raise rates.

### The existing deployments

Mainnet and Arbitrum have been **under**charging by roughly 0.18-0.35%, varying
with mainnet slot participation. It is small and in the borrowers' favor, so there
is no urgency, but it is a known liability and it will not reconcile cleanly in
any month. Decide deliberately whether to true up historically or absorb it, then
migrate both to the timestamp version alongside Base.

### Sign-off recommendation

**Do not deploy the current bytecode to Base.** It is a 6x overcharge and a
wrongful-liquidation vector on day one. Ship the timestamp version to Base, and
schedule the same migration for mainnet and Arbitrum — the mainnet deployment is
one Ethereum slot-time change away from halving your interest revenue, and the
Arbitrum deployment is correct only by accident.
