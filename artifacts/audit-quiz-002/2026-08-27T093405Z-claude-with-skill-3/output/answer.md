# `accrueInterest()` across mainnet, Arbitrum One, and Base

## Short version

Arbitrum agreed with mainnet because **`block.number` on Arbitrum is not the
Arbitrum block number — it is the L1 block number.** Nitro deliberately aliases
it. So on Arbitrum the counter you are reading ticks once per ~12s Ethereum
slot, not once per 250ms L2 block, and `SECONDS_PER_BLOCK = 12` happens to be
right there for the same reason it is right on mainnet. The 250ms cadence is
exposed separately, via `ArbSys.arbBlockNumber()`, which this contract never
calls.

**Base will not save you the same way.** Base is OP Stack, and OP Stack does not
alias `block.number` — it is the L2 block number, one every 2 seconds. The
contract will read 6 blocks where mainnet reads 1, and will charge **~6× the
intended interest**: roughly **20,400–20,600 USDC** on that same 1,000,000 /
31 days, against the 3,397 the rate implies. Effective rate ~24% nominal /
~27% APY instead of 4%.

The fix is to stop counting blocks. Use `block.timestamp`.

---

## 1. The July reconciliation

### 1a. Why Arbitrum matched mainnet

Arbitrum Nitro redefines the L1 opcodes for a rollup context:

| Solidity expression | Mainnet | Arbitrum One | Base (OP Stack) |
|---|---|---|---|
| `block.number` | L1 block, ~12s | **L1 block, ~12s** (sequencer's estimate of the L1 height) | **L2 block, 2s** |
| `ArbSys.arbBlockNumber()` | n/a | L2 block, ~250ms | n/a |
| `block.timestamp` | slot time | L2 wall-clock (sequencer, bounded drift vs L1) | L2 time, exact 2s steps anchored to L1 |

So on Arbitrum, `blocksElapsed` over July was ~223k, not ~10.7M. Two consequences
you may already have seen in logs and dismissed:

- Most `accrueInterest()` calls on Arbitrum are no-ops. ~48 consecutive L2 blocks
  share one L1 `block.number`, so 47 of every 48 calls hit the
  `blocksElapsed == 0` early return.
- Arbitrum's `block.number` is an *estimate* and updates in jumps rather than
  smoothly; it is monotonic and converges to the true L1 height, but it can lag
  by minutes. Over a month that averages out. Over an hour it does not — any
  short-window accrual on Arbitrum is noisy. That is a latent problem even
  though it did not show up in a 31-day reconciliation.

This is luck, not design. The contract is correct on Arbitrum only because
Arbitrum chose to make `block.number` lie in exactly the direction that happens
to match the hardcoded constant.

### 1b. Why both came in under 3,397

Two effects pull in opposite directions, and the block-count shortfall wins.

**Pulling down — Ethereum does not actually produce a block every 12 seconds.**
Slots are 12s, but slots get missed (proposer offline, late block, reorg). The
*slot* clock is exactly 12s; the *block* clock is 12s ÷ (1 − missed-slot-rate).
So over 31 real days:

```
theoretical blocks  = 2,678,400 s / 12 = 223,200
actual blocks       = 223,200 × (1 − m)
seconds the contract counts = actual blocks × 12 = 2,678,400 × (1 − m)
```

Every missed slot is 12 seconds of real time the contract never bills for. The
error is one-directional: `blocksElapsed × 12` can only ever *under*-count
elapsed wall-clock time on mainnet, never over-count.

**Pulling up — the formula compounds at whatever cadence callers use.**
`index += index * r * dt / YEAR` is a linear step applied to the *current* index,
so frequent calls compound. Bounds on the 31-day charge, ignoring the block
deficit:

- called once at the end (no compounding): 1e6 × 0.04 × 31/365 = **3,397.26**
- called every block (≈continuous): 1e6 × (e^0.0033973 − 1) = **3,403.04**

So compounding adds at most ~5.8 USDC here.

**Reconciling to 3,391.** Working backwards for the block deficit `m`:

- if callers were compounding heavily: 1 − 3,391/3,403.04 → **m ≈ 0.35%**,
  i.e. average real block time ≈ **12.042 s**
- if accrual was infrequent: 1 − 3,391/3,397.26 → **m ≈ 0.18%**,
  i.e. average real block time ≈ **12.022 s**

Both land squarely in mainnet's normal missed-slot range (~0.2–0.6%). Nothing
anomalous happened in July; you are looking at Ethereum's baseline liveness.
Arbitrum reported the same number because it was reading the same L1 block
clock, with the same missed slots baked in.

**Verify it in one line** — pull mainnet block heights at 2025-07-01T00:00Z and
2025-08-01T00:00Z:

```
avg_block_time = 2,678,400 / (block_aug1 − block_jul1)
```

If that comes out ~12.02–12.05s, the explanation above is confirmed and there
is nothing else to chase. A smaller secondary contributor: if the last
`accrueInterest()` before your reconciliation cutoff was some hours before the
cutoff, that tail is unbilled too — but that would not have produced matching
figures on two independent chains, so it is at most a rounding-level effect here.

For the record, the truncating integer division also always rounds in the
borrower's favour, but at 1e18 index scale that is sub-wei per call and not
part of the 6 USDC.

---

## 2. What this code does on Base

Base is OP Stack. `block.number` is the L2 block number. There is no L1 aliasing.
Blocks are produced on a **deterministic 2-second cadence** — the sequencer
produces a block every 2s whether or not there are transactions, so unlike
mainnet there is no missed-slot deficit. The overcharge is a clean, exact 6.00×.

### Arithmetic, 1,000,000 USDC, 31 days, 4.00% APR

```
real elapsed time            = 31 × 86,400        = 2,678,400 s
Base blocks in that window   = 2,678,400 / 2      = 1,339,200 blocks
contract computes            = 1,339,200 × 12     = 16,070,400 "seconds"
                                                  = 186.0 days   (6.00× reality)

no compounding:   1e6 × 0.04 × 16,070,400 / 31,536,000 =  20,383.56 USDC
continuous:       1e6 × (e^(0.04 × 186/365) − 1)       =  20,592.75 USDC
```

**Expected charge: ~20,400–20,600 USDC, against an intended 3,397.**
Overcharge ≈ **17,000 USDC per million per month**. Effective rate **24.0%
nominal / 27.1% APY**, not 4%.

### And it gets worse on Base's roadmap

Base has been shortening block time (2s, with 1s targeted; Flashblocks
preconfirms at 200ms). If canonical block time reaches 1s, the same deployed
bytecode silently doubles again:

| Base block time | multiplier | 31-day charge on 1M | effective APR |
|---|---|---|---|
| 2 s (today) | 6× | 20,384 – 20,593 | 24% nominal / 27.1% APY |
| 1 s | 12× | 40,767 – 41,610 | 48% nominal / 61.6% APY |

### Second-order damage

The overcharge is not just a billing error. Debt grows 6× too fast, so every
downstream threshold fires early: health factors decay 6× faster, borrowers get
**liquidated on positions that are actually solvent**, and any fixed-duration
loan terms are wrong by the same factor. That is the failure mode that costs you
users and gets escalated, not the invoice discrepancy.

### Do not ship it with `SECONDS_PER_BLOCK = 2`

The obvious patch — per-chain constant — is the wrong lesson. It hardcodes a
number that is not a constant:

- Base is actively reducing block time (2s → 1s). Your constant goes stale
  without a redeploy.
- Ethereum L1 may do the same: **EIP-7782** proposes cutting slot time to 6s. If
  that ships, your *mainnet* deployment starts under-charging by 2×, and your
  Arbitrum deployment with it (it inherits the L1 clock).
- It leaves the Arbitrum aliasing footgun armed for the next person who reads
  this code.

---

## 3. What I would change

### 3.1 Count seconds, not blocks (the actual fix)

`block.timestamp` means the same thing on all three chains — real elapsed
seconds — and needs no per-chain constant.

```solidity
uint256 public lastAccrualTime;

function accrueInterest() public {
    uint256 secondsElapsed = block.timestamp - lastAccrualTime;
    if (secondsElapsed == 0) return;
    index += index * rateBps * secondsElapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

Delete `SECONDS_PER_BLOCK` and `lastAccrualBlock` entirely. Timestamp
manipulation is not a concern at this granularity: L1 proposers can nudge a
timestamp by a couple of seconds, which at 4%/yr on 1M is fractions of a cent,
and on both L2s the timestamp comes from the sequencer and is bounded against L1.

### 3.2 Guard the truncation floor before you make this change

Moving from a 12-second minimum step to a 1-second minimum step increases
truncation exposure by 12×. The step is non-zero only when:

```
index × rateBps × secondsElapsed  ≥  10,000 × 31,536,000  = 3.1536e11
```

At `rateBps = 400`, `secondsElapsed = 1`, that needs `index > 7.9e8`. A 1e18-scaled
index clears this by nine orders of magnitude and is fine. **But confirm your
index scale** — if `index` is USDC-scaled (1e6), every per-second call truncates
to zero and an attacker can call `accrueInterest()` every block to hold interest
permanently at zero. That is a live griefing vector, cheap on an L2, and the
current 12-second floor is partially masking it. Add a test that asserts the
minimum-step accrual is non-zero on each target chain's block cadence.

### 3.3 Decide the compounding policy explicitly

`accrueInterest()` is permissionless, so the realised APY is
**call-frequency-dependent**: a lender who calls every block earns the
continuously-compounded rate, and a borrower who no-one calls on pays simple
interest. At 4%/31d the spread is 5.8 USDC per million and nobody cares. At 40%,
or over a year, it is material and it is gameable. Either:

- document that the contract charges "up to continuously compounded at
  `rateBps`" and state the APY as `e^r − 1` in the product spec, or
- accrue on a fixed cadence (round `secondsElapsed` down to a period boundary) so
  the result is path-independent.

Compound/Aave both take the first option; it is defensible, but it should be a
decision rather than an accident.

### 3.4 Sweep every other `block.number` in the codebase

This bug class is not confined to interest. Any grace period, timelock,
liquidation delay, or auction duration denominated in blocks has the same
portability problem, and the aliasing makes the pattern especially confusing:

| "600 blocks" means | mainnet | Arbitrum | Base 2s | Base 1s |
|---|---|---|---|---|
| wall-clock | ~2 hrs | ~2 hrs | 20 min | 10 min |

Grep for `block.number` and convert everything time-denominated to timestamps.

### 3.5 Migration for the two live deployments

You cannot just swap the storage variable. `lastAccrualTime` must be seeded at
upgrade time, or the first post-upgrade call bills from the unix epoch and the
index overflows. Sequence: call `accrueInterest()` to settle at the old
semantics, then in the initializer set `lastAccrualTime = block.timestamp`. If
the contracts are not upgradeable, redeploy and migrate positions with the index
carried over. Note that this *slightly increases* mainnet and Arbitrum billing
going forward — the missed-slot deficit from §1b disappears, so you will bill the
full 3,397 instead of 3,391. That is the correct number, but tell Finance before
it shows up as an unexplained variance.

### 3.6 Add fork tests so this cannot ship again

For each of mainnet, Arbitrum One, and Base: fork, `warp` 31 days, call
`accrueInterest()`, assert the index grew by 4% × 31/365 within tolerance. Three
tests, and this entire class of bug is closed permanently.

---

## Bottom line on the Base sign-off

**Do not deploy the current bytecode to Base.** It is not marginally wrong there,
it is 6× wrong, in the direction that overcharges borrowers and liquidates
solvent positions. Fix `accrueInterest()` to use `block.timestamp` first, check
the index scale per §3.2, and roll the same fix back to mainnet and Arbitrum —
those two are currently correct by coincidence, and EIP-7782 is enough to end the
coincidence without anyone touching your code.
