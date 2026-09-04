# `accrueInterest()` — July reconciliation, Base forecast, and what to change

**Bottom line up front:** the contract does not measure time. It measures
`block.number` and multiplies by a hardcoded 12. That happened to be right on
mainnet and *accidentally* right on Arbitrum, for a reason that does not
generalize. On Base it will be wrong by roughly **6×** (or 12×, or 60× —
see §2). Do not deploy this bytecode to Base.

---

## 1. Why July reconciled

### 1a. Why Arbitrum matched mainnet

The premise behind "I braced for the Arbitrum figure to be nonsense" is that
`block.number` on Arbitrum counts 250 ms L2 blocks. It does not.

On Arbitrum Nitro, the `NUMBER` opcode — Solidity's `block.number` — returns
an **estimate of the L1 (Ethereum) block number**, not the L2 block number.
This is a deliberate Nitro design decision for exactly the compatibility
reason you're benefiting from. The L2 block number is only reachable via
`ArbSys(0x64).arbBlockNumber()`, which this contract never calls.

So both deployments are metered by the *same counter*: Ethereum mainnet's
block height. Identical bytecode, identical input signal, identical answer.
The agreement is real, but it is a property of Arbitrum's L1-aliased
`block.number`, not evidence that the contract is chain-portable.

The "couple of dollars" of residual disagreement is the boundary artifact:
Arbitrum's reported L1 block number lags true L1 height and advances in
jumps, so the July-open and July-close snapshots don't land on exactly the
same L1 blocks as mainnet's. $2 out of $3,391 is 5.9e-4 of the charge ≈ **131
L1 blocks ≈ 26 minutes of lag differential** across the two window
endpoints. That is squarely in the normal range for Nitro's L1 block
tracking. It is noise, not drift — it does not accumulate.

### 1b. Why both landed under 3,397

Two effects, pulling in opposite directions. The one you noticed is the net
of them.

Let `T = 365 days = 31,536,000 s`, `31 days = 2,678,400 s`, `r = 0.04`.

**Effect A — compounding, pushes the charge UP.**
`index += index * ...` compounds on every call. A perfectly-timekeeping
version of this contract, called frequently, charges the *continuously
compounded* amount, not the simple amount:

```
x_ideal = 0.04 × 2,678,400 / 31,536,000 = 0.00339726
simple  : 1,000,000 × 0.00339726          = 3,397.26   ← your reference figure
compound: 1,000,000 × (e^0.00339726 − 1)  = 3,403.03
                                            ────────
                                            +5.77 USDC
```

**Effect B — missed L1 slots, pushes the charge DOWN.**
Post-Merge Ethereum has a fixed 12-second *slot* time, but `block.number`
increments once per *produced block*, and some slots are missed (offline or
late proposers, reorged proposals). Real average block time is therefore
slightly **above** 12 s. The contract credits exactly 12 s per block, so it
systematically under-counts elapsed time.

Solve for the block count implied by the observed 3,391:

```
e^x − 1 = 0.003391  →  x = ln(1.003391) = 0.00338526
x = 0.04 × 12N / 31,536,000  →  12N = 2,668,922 s  →  N ≈ 222,410 blocks
```

Against 223,200 blocks for a perfect 12 s cadence:

```
block deficit      = 790 blocks           = 0.354 %
implied avg block  = 2,678,400 / 222,410  = 12.043 s
implied miss rate  ≈ 0.35 %
```

0.35% is consistent with the missed-slot rate mainnet has been running at.
It is directly checkable — pull the block numbers at the July 1 and August 1
boundaries from any explorer and confirm the delta is ≈222,400, not 223,200.
I'd do that before signing off; it converts this from a fitted explanation
into a verified one.

**Reconciliation:**

| | USDC |
|---|---:|
| Simple interest at the stated rate | 3,397.26 |
| + compounding (Effect A) | +5.77 |
| − 0.354% block deficit (Effect B) | −12.03 |
| **= charged** | **3,391.00** |

Note what this means: the two errors are the same order of magnitude and
nearly cancel. The $6 you saw is a *residual*, not a single small bug. The
underlying errors are ~2× larger than the discrepancy that surfaced.

### 1c. One confound worth ruling out

The July charge also depends on *when* `accrueInterest()` was last called
before the window opened and closed. If keeper activity is sporadic, the
month-boundary alignment alone can move the number. The fact that both
chains produced 3,391 argues for the systematic explanation above, but if
your accrual cadence is irregular, confirm the boundary accrual timestamps
before treating the 0.35% as a clean miss-rate measurement.

---

## 2. What this code does on Base

Base is an OP Stack chain. On OP Stack, `block.number` is the **L2 block
number** — it increments once per L2 block. There is no L1 aliasing. (L1
height on Base is read from the `L1Block` predeploy at
`0x4200...0015`, which this contract never touches.)

So the contract will credit 12 seconds of interest for every Base block.
The error factor is `12 / (Base block time in seconds)`.

Base launched at **2 s** blocks and has been actively reducing block time
(Flashblocks preconfirmations at 200 ms, with a stated roadmap toward
1 s and then sub-second canonical blocks). **Confirm the current canonical
block time before quoting a single number** — but here is the arithmetic at
each rung, same 1,000,000 USDC, same 31 days:

### At 2 s blocks (6× error)

```
blocks in 31 days   = 2,678,400 / 2          = 1,339,200
secondsElapsed      = 1,339,200 × 12         = 16,070,400 s   (= 186 days)
x                   = 0.04 × 16,070,400 / 31,536,000 = 0.0203836
charge              = 1,000,000 × (e^0.0203836 − 1)  = 20,592.71 USDC
```

**20,593 USDC instead of 3,397 — 6.06× over.** The contract believes it is
charging a 24% nominal APR; the borrower's realized effective annual rate is
`e^0.24 − 1 = 27.1%`.

### At 1 s blocks (12× error)

```
secondsElapsed = 2,678,400 × 12 = 32,140,800 s  (= 372 days — more than a year, in a month)
charge         = 1,000,000 × (e^0.0407671 − 1)  = 41,609.60 USDC
```

**41,610 USDC — 12.25× over.** Nominal 48% APR, effective 61.6%.

### At 200 ms blocks (60× error)

```
secondsElapsed = 160,704,000 s
charge         = 1,000,000 × (e^0.2038356 − 1)  = 226,097 USDC
```

**226,097 USDC — 66.6× over.** Nominal 240% APR, effective ~1,002%.

### Operational consequence

This is not a reconciliation nuisance. At 2 s blocks a healthy position
crosses its liquidation threshold in days instead of years, and every
borrower on the deployment does so simultaneously. The first month on Base
is a protocol-wide cascade of unjustified liquidations, and the `index` is
one-directional — you cannot un-accrue it without an admin write.

And note the structural point that outlives any specific number above:
**Base's block time is a parameter the chain operator changes unilaterally,
and has already changed once.** Even if you hardcoded the correct value
today, a Base block-time reduction silently doubles or quintuples your
interest rate with no transaction on your contract. A block-count meter is
not just wrong here, it is *unownable*.

---

## 3. What I would change

### 3.1 Required: meter with `block.timestamp`, not `block.number`

This is the fix. `block.timestamp` means wall-clock seconds on all three
chains and is the correct unit for a time-denominated rate:

- **Mainnet** — proposer-set, ±seconds of manipulability, irrelevant at 4%/yr.
- **Arbitrum** — sequencer clock, guaranteed monotonic and bounded relative
  to L1; force-included txs take the L1 timestamp.
- **Base / OP Stack** — advances by exactly the block time per block,
  anchored to the L1 origin block's timestamp. Immune to block-time changes.

Minimum diff, preserving current semantics:

```solidity
uint256 public lastAccrualTime;   // replaces lastAccrualBlock

function accrueInterest() public {
    uint256 dt = block.timestamp - lastAccrualTime;
    if (dt == 0) return;
    index += index * rateBps * dt / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

`SECONDS_PER_BLOCK` is deleted, not corrected. Do **not** "fix" this by
making it a constructor argument — that leaves you exposed to Base changing
its block time post-deployment, and it breaks the identical-bytecode
property you're relying on.

Migration: this is a storage-layout change and a semantic change to the same
slot. On upgrade, seed `lastAccrualTime = block.timestamp` in the same
transaction, after a final `accrueInterest()` under the old rule. Getting
this ordering wrong on mainnet accrues ~1.7 billion seconds of interest in
one call.

### 3.2 Recommended: make the rate call-frequency-independent

Independent of the chain bug, `index += index * ...` is **path-dependent**:
the realized cost depends on how often somebody calls `accrueInterest()`.
Called once at year end it is 4.000%; called every block it is
`e^0.04 − 1 = 4.081%`. That is 8 bps of spread on a product sold as
"fixed-rate," determined by keeper behaviour rather than by the contract.
It is also the source of the +5.77 in §1b — half your July discrepancy is
this, not the block-time bug.

Two clean resolutions; pick one deliberately:

**(a) Path-independent compounding (Maker-style `rpow`)** — keeps
compounding, removes the call-frequency dependence, because
`rpow(k, a) · rpow(k, b) ≈ rpow(k, a+b)`:

```solidity
uint256 constant RAY = 1e27;
uint256 public immutable ratePerSecondRay;  // k such that k^(365 days) = 1.04

function accrueInterest() public {
    uint256 dt = block.timestamp - lastAccrualTime;
    if (dt == 0) return;
    index = index * rpow(ratePerSecondRay, dt, RAY) / RAY;
    lastAccrualTime = block.timestamp;
}
```

Set `ratePerSecondRay = 1.04^(1/31_536_000)` so the *effective* annual rate
is exactly 4.00%, which is presumably what Finance means by "4.00% per year."

**(b) Linear accrual against a principal snapshot** — no compounding at all,
exactly 4.00% simple, trivially auditable. Cheaper and simpler; choose it if
the product is genuinely simple-interest.

Whichever you pick, state in the docs whether 4.00% is nominal or effective.
Right now it is neither — it is "somewhere between, depending on keepers."

### 3.3 Minor

- **Rounding direction.** The integer division truncates, always in the
  borrower's favour, on every call. With a 1e18/1e27-scaled `index` this is
  dust (sub-1e-12 relative), but it is a systematic one-way leak. Make it a
  conscious choice rather than an accident of `/`.
- **`365 days` ignores leap years** — a 0.27% error in leap years, larger
  than the discrepancy that prompted this review. Same class of baked-in
  calendar assumption as `SECONDS_PER_BLOCK`. Decide whether the product
  quotes act/365 fixed (fine, keep it, document it) or actual/actual.

### 3.4 Tests that would have caught this

1. **Cross-chain differential:** fork mainnet, Arbitrum, and Base; run an
   identical 31-day accrual on each; assert all three agree to within
   1e-9 relative. Today this fails on Base by 6×.
2. **Path-independence invariant:** assert that 1,000 small accruals over a
   period equal one large accrual over the same period. Today this fails,
   which is Effect A.
3. **Absolute rate assertion:** assert that a 365-day accrual on 1,000,000
   yields exactly 40,000 (or 40,811 for effective) — pin the number, don't
   just check it's "about right."

---

## Recommendation

Block the Base deployment. Ship the `block.timestamp` change (§3.1) plus a
decision on §3.2 to all three chains together, so the deployments stay
bytecode-identical. The mainnet and Arbitrum numbers are within a few dollars
today, which makes this feel low-urgency — but that agreement is a
coincidence of Arbitrum's L1-aliased `block.number`, and it is precisely the
false confidence that would have carried this bug onto Base.

---

## Unresolved questions

1. **Base canonical block time as of the deployment date** — 2 s, 1 s, or
   sub-second? Changes the error factor from 6× to 60×. Needs confirming
   against Base's current chain config, not from memory.
2. **Is 4.00% nominal or effective?** Determines whether §3.2(a) or (b) is
   correct, and whether the +5.77 in July was an overcharge or the spec.
3. **Is the contract upgradeable?** Determines whether §3.1 is a storage
   migration or a redeploy-and-migrate-positions exercise.
4. **Do the July boundary accruals land near the month edges?** Needed to
   confirm the 0.35% miss-rate figure rather than infer it (§1c).
5. **Any other `block.number` uses** — governance timelocks, oracle
   staleness, grace periods? Each carries the same 6×/60× distortion on
   Base and should be swept in the same change.
