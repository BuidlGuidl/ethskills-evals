# `accrueInterest()` across chains — July reconciliation, and what happens on Base

**Bottom line up front:** the contract does not measure time. It measures `block.number` and
multiplies by a hardcoded 12. That happens to be right on mainnet and *accidentally* right on
Arbitrum, and it will be wrong by a factor of **6×** on Base (24% effective APR instead of 4%),
or 12×/60× if Base's block time drops further. Do not deploy this bytecode to Base.

---

## 0. The one fact the whole thing turns on

`block.number` does not mean the same thing on every chain. It is not a clock, and each chain
defines it differently:

| Chain | What `block.number` returns | Cadence of that counter |
|---|---|---|
| Ethereum mainnet | L1 block number | 12 s (one per slot, minus missed slots) |
| **Arbitrum One** | **the L1 block number** (an ArbOS estimate of it — *not* the L2 block number) | **~12 s**, because it tracks L1 |
| Base / OP Stack | the **L2** block number | 2 s (Base's L2 block time) |

Arbitrum's real L2 block counter is exposed separately, via `ArbSys.arbBlockNumber()`. Solidity's
`block.number` on Arbitrum deliberately reports L1, precisely so that naive block-counting contracts
ported from mainnet don't blow up. OP Stack made the opposite choice: `block.number` is the L2 block,
and L2 blocks come every 2 s regardless of L1.

"Identical bytecode, identical constructor args" guarantees identical *instructions*. It guarantees
nothing about what `NUMBER`, `TIMESTAMP`, `BLOCKHASH`, `PREVRANDAO` or `BASEFEE` *return* — those are
chain-defined. This contract's entire time base sits on one of them.

---

## 1. Explaining the July reconciliation

### 1a. Why Arbitrum matched mainnet

Your intuition was arithmetically correct and rested on one wrong premise. Had `block.number`
counted Arbitrum's ~250 ms L2 blocks, July would have been:

```
L2 blocks in 31 days   = 2,678,400 s / 0.25 s   = 10,713,600
secondsElapsed         = 10,713,600 × 12        = 128,563,200 s  (≈ 4.077 years)
interest               = 1,000,000 × 0.04 × 4.077 ≈ 163,072 USDC
```

~48× too much — "tens of times," exactly as you predicted. You got 3,391 instead, which is the
observation that falsifies the premise. Both deployments are reading the **same L1 slot clock**, so
they count the same blocks over the same wall-clock window and land on the same number. The 250 ms
L2 blocks are invisible to this contract.

The "couple of dollars" of residual spread between the two is boundary drift: Arbitrum's L1-block
figure is an *estimate*, refreshed as the sequencer ingests L1 data, so it can be somewhat stale at
either end of the reconciliation window. At this size, **$1 of difference ≈ 788 seconds ≈ 66 L1
blocks** of relative endpoint lag. A couple of dollars is ~150 blocks of drift across a month —
entirely ordinary.

### 1b. Why both came in under 3,397

Target, simple interest, Act/365-fixed:

```
1,000,000 × 0.04 × (31 / 365) = 3,397.26 USDC
```

That figure assumes 31 days of *wall-clock* time. The contract instead charges
`blocksElapsed × 12` seconds. A perfect month at 12 s/block is 2,678,400 / 12 = **223,200 blocks**.
Mainnet never produces a perfect month: **missed slots** (proposer offline, late block, reorg'd
slot) produce a slot with no block. Every missed slot is 12 seconds of interest the contract never
charges. There is no catch-up mechanism — the time is gone permanently.

Two second-order effects run the other way and one runs with it:

- **Compounding (+).** `index += index * ...` compounds at every call, so the more often anyone
  calls `accrueInterest()`, the more is charged. Over a month at 4%: between +$0.00 (one call at
  month end — pure simple interest) and +$5.77 (called every block — effectively continuous).
- **Integer truncation (−).** `index * rateBps * elapsed / (10_000 * 365 days)` floors. Negligible
  *provided* `index` carries ~1e18 precision — at 1e18 a single-block increment is ~1.5e10 units, so
  the lost sub-unit is ~1e-10 of it. If `index` were USDC-scaled (1e6) the per-call increment would
  floor to **zero** and you'd have accrued nothing at all, so we can infer from the 3,391 that the
  index is high-precision. Worth confirming rather than inferring.

Backing out the missed-slot count from the 3,391:

| Assumption about call frequency | Implied charged seconds | Implied blocks | Missed slots | Miss rate |
|---|---|---|---|---|
| Called once (no compounding) | 2,673,464 | 222,789 | 411 | 0.18% |
| Called every block (max compounding) | 2,668,935 | 222,411 | 789 | 0.35% |

So: **411–789 missed slots over July, a 0.18%–0.35% miss rate.** That sits squarely inside mainnet's
historical band. The reconciliation is fully explained — no bug beyond the design flaw, but note this
is a *systematic undercharge*: the protocol has been leaking ~0.2–0.35% of interest revenue on both
deployments, every month, forever.

Arbitrum inherits the identical shortfall because it is metering the identical L1 slot clock.

### 1c. The uncomfortable part

Arbitrum is not *correct*, it is *correct on average over a long window*. `block.number` there is a
bounded estimate that can stall and then jump. Over 31 days the errors wash out; over a 10-minute
window they do not. Anything short-horizon and adversarial — liquidation thresholds, health factors,
oracle staleness gates measured off this index — is reading a clock that can freeze during sequencer
batch delays (borrowers accrue free time) and then step forward discontinuously. A month-long
reconciliation is the one measurement that cannot detect this class of problem.

---

## 2. What this code does on Base

Base is OP Stack: `block.number` is the **L2** block number, produced on a fixed **2-second** cadence,
deterministically, whether or not there are transactions. No missed slots — the shortfall from §1b
disappears and is replaced by a straight 6× multiplier.

```
Real elapsed                 = 31 days                      = 2,678,400 s
Base blocks in that window   = 2,678,400 / 2                = 1,339,200 blocks
Contract computes:
  secondsElapsed             = 1,339,200 × 12               = 16,070,400 s   (= 186 days)
  fraction of year           = 16,070,400 / 31,536,000      = 0.509589
Charge (simple)              = 1,000,000 × 0.04 × 0.509589  = 20,383.56 USDC
Charge (fully compounded)    = 1e6 × (e^0.0203836 − 1)      = 20,592.70 USDC
```

**A borrower with 1,000,000 USDC of debt is charged ~20,384–20,593 USDC for July instead of 3,397.**
That is 6.00× — an effective **24.00% APR** (27.12% APY at continuous compounding) on a contract whose
`rateBps` says 400.

The exact multiple is `12 / (Base block time)`, and Base's block time is a *parameter under active
reduction*, not a constant. Confirm the live value at deploy time; the sensitivity is the point:

| Base block time | Multiple | Effective APR | July charge on 1M (simple → compounded) |
|---|---|---|---|
| 2 s (OP Stack default) | 6× | 24% | 20,384 → 20,593 |
| 1 s | 12× | 48% | 40,767 → 41,609 |
| 200 ms | 60× | 240% | 203,836 → 226,092 |

Note the failure mode: this doesn't revert, doesn't emit anything unusual, and reconciles cleanly
against itself. It silently overcharges every borrower, and the overcharge compounds into `index`
irreversibly. By the time month-end reconciliation catches it, positions have been liquidated at
inflated debt. And a chain-side block-time reduction — which requires no action from you — silently
doubles the rate on a live deployment.

---

## 3. What I would change

### 3.1 Use `block.timestamp`. (required)

`block.timestamp` means the same thing on every chain: seconds. Mainnet, Arbitrum, Base, and every
future target all report real wall-clock seconds. It also removes the missed-slot leak — July would
have priced at 3,397.26 on both deployments.

```solidity
uint256 public lastAccrualTime;   // replaces lastAccrualBlock

function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTime;
    if (elapsed == 0) return;
    index += index * rateBps * elapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

Delete `SECONDS_PER_BLOCK`.

Timestamp trust, since it's the usual objection: mainnet proposers can nudge the timestamp by a few
seconds within consensus bounds — at 4% APR that's worth fractions of a cent and is not an attack
surface here. OP Stack timestamps are deterministic (fixed 2 s increments anchored to L1). Arbitrum's
sequencer sets it with bounds enforced against L1. All three are dramatically better clocks than a
block counter.

### 3.2 Migration hazard — do not do this in-place carelessly. (required)

If this is behind a proxy and you swap `block.number` → `block.timestamp` while reusing the storage
slot, the slot holds an old *block number* (~2.3e7). Read as a timestamp that is 1970, so the first
post-upgrade call computes `elapsed ≈ 1.8e9 s` — roughly **57 years of interest applied in a single
transaction**, instantly bankrupting every borrower. Reinitialize the slot to `block.timestamp` in
the same transaction as the upgrade, atomically, and gate it so it cannot be run twice. If it's a
fresh deployment per chain, just initialize `lastAccrualTime = block.timestamp` in the constructor
(the existing code has the same hazard if `lastAccrualBlock` is ever left at 0).

### 3.3 Pin down the compounding convention. (should fix)

`index += index * rate * elapsed / ...` compounds once per call, so **the total interest charged is a
function of how often an unpermissioned public function is called**. Anyone can push it toward the
continuous limit for free. Today that's a bounded ~0.17% of interest (~$5.77 per $1M-month at 4%),
but it scales with rate and horizon, and it means two identical positions can owe different amounts.
Either document it explicitly as "compounds on every interaction," or restructure to a
principal-time basis so the result is call-frequency independent. Pick one deliberately; right now
it's unspecified behavior.

### 3.4 Confirm `index` precision, and state it as an invariant. (should fix)

Interest is lost to truncation whenever `index * rateBps * elapsed < 10_000 * 365 days`. With
1 s granularity that requires `index > 7.9e8`, so 1e18-scaled is safe and 1e6-scaled silently accrues
nothing. Assert `index >= 1e18` at initialization and add a test at minimum `elapsed`. Overflow is not
a concern at these magnitudes (worst realistic numerator ~7e29 vs 2^256).

### 3.5 Ban `block.number`-as-clock repo-wide, and test the invariant per chain. (should fix)

- CI grep for `block.number` and any `SECONDS_PER_BLOCK`-style constant; require an explicit waiver.
- Add a fork test per target chain: advance 31 days at that chain's *real* block cadence, assert
  accrued interest is 3,397 ± tolerance. This test — run against a Base fork — is what would have
  caught this before deployment rather than at month-end reconciliation. Make it a deployment gate.
- Audit the rest of the codebase for the sibling assumptions: `blockhash` (returns pseudorandom values
  on Arbitrum, not real L1 hashes), `block.prevrandao` (not randomness on any L2), `block.coinbase`,
  gas accounting, and the OP Stack L1 data fee. Same root cause, different opcode.

### 3.6 Document the day-count convention. (nice to have)

`365 days` is Act/365-Fixed. In a 366-day year borrowers pay 4.011%. Fine as a choice — just make it
a stated convention rather than an accident.

---

## Sign-off recommendation

**Blocking on Base.** Ship 3.1 + 3.2 + 3.5's fork test before the Base deployment. Separately, the
existing mainnet and Arbitrum deployments are undercharging ~0.2–0.35% of interest and are running on
a clock that is only reliable over long windows — worth scheduling a migration on its own merits, not
just as Base prep.

## Open questions

1. Is `index` 1e18-scaled? (Inferred from the 3,391, not verified.)
2. Proxy or fresh deploy per chain? Determines whether 3.2 is a live-funds hazard or a constructor line.
3. Is anything short-horizon — liquidations, health factors, staleness checks — reading this index on
   Arbitrum? That's where the estimate-not-a-clock issue bites, and a monthly reconciliation can't see it.
4. Which compounding convention do you actually want (3.3)?
5. Confirmed current Base block time at deploy date, and is a reduction scheduled inside the contract's lifetime?
