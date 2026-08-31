# Fixed-rate accrual: mainnet / Arbitrum reconciliation, and what happens on Base

## Short version

`block.number` does not mean the same thing on every chain. On Arbitrum One it
returns the **L1 (Ethereum) block number**, not the Arbitrum block number. That
is the whole reason the July numbers matched: both deployments were metering in
Ethereum blocks. Base is an OP Stack chain where `block.number` *is* the L2
block number, produced every 2s. The same bytecode there charges **~6x too much
interest**. Do not deploy it as written.

---

## 1. The July reconciliation

### 1a. Why Arbitrum agreed with mainnet

Your instinct that 250ms blocks should blow this up is correct arithmetic
applied to the wrong variable. Arbitrum's `NUMBER` opcode is remapped: it
returns an approximation of the L1 block number at the point the transaction
was sequenced, not the L2 block height. The L2 block number is only reachable
via `ArbSys(0x64).arbBlockNumber()`, which this contract never calls.

So on Arbitrum, `blocksElapsed` counts **Ethereum blocks**, which arrive at
~12s. `SECONDS_PER_BLOCK = 12` happens to be right there — for a reason that has
nothing to do with Arbitrum's own block production.

What `block.number` means, by chain:

| Chain | `block.number` returns | Effective seconds per unit |
|---|---|---|
| Ethereum mainnet | L1 block | ~12.0 (nominal 12, see below) |
| Arbitrum One | **L1 block** (sequencer-updated) | ~12.0 |
| Base / OP Stack | **L2 block** | 2.0 (chain config) |

Two second-order consequences worth knowing, neither of which affects the
monthly total:

- Arbitrum's L1 block number advances in **jumps**, not smoothly — it updates
  when the sequencer posts/observes L1 progress. Intra-day accrual is lumpy;
  over a month it converges exactly on the L1 rate.
- `blocksElapsed == 0` fires often on Arbitrum (many L2 blocks share one L1
  block number), so those calls early-return. That is harmless here, and it
  incidentally avoids the truncation-dust problem you'd otherwise get from
  accruing hundreds of times per L1 block.

The residual couple-of-dollar gap between the two deployments is boundary
alignment: your July window opens and closes on slightly different L1 blocks on
each chain, plus a different `accrueInterest()` call cadence (which matters —
see 1c).

### 1b. Why both are under 3,397

3,397.26 is simple pro-rata: `1,000,000 x 0.04 x 31/365`. Getting 3,391 means
the contract credited **less elapsed time than actually passed**.

31 days = 2,678,400 real seconds = 223,200 twelve-second slots. But Ethereum
does not produce a block in every slot — missed/empty slots (offline proposers,
late blocks, reorged-out proposals) mean the realised count is lower, and the
contract's clock only ticks on blocks that exist. Its clock therefore runs
slow, permanently, by the missed-slot rate.

Arbitrum reads the *same* L1 block numbers, so it inherits the *identical*
undercount. That is why the two agree — not coincidence, same clock.

### 1c. The size of the gap, decomposed

The observed shortfall is 3,391 / 3,397.26 = **-0.184%**. Two effects run in
opposite directions:

- **(a) Missed slots** — pushes the charge *down*. Every empty slot is 12
  seconds of interest never credited.
- **(b) Stepwise compounding** — pushes it *up*. `index += index * ...` compounds
  on each call, so the more often anyone calls `accrueInterest()`, the more is
  owed. Upper bound over the month is about `r^2/2 = (0.0033972)^2/2` = **+5.8
  USDC**; roughly +5.6 if it was accrued daily, +0 if accrued once.

So the split depends on your call log:

| Accrual cadence | (b) compounding | implied (a) miss | implied avg block time |
|---|---|---|---|
| once for the month | +0.0 | -0.184% | 12.022s |
| daily (31 calls) | +5.6 | -0.35% | 12.042s |
| every block | +5.8 | -0.36% | 12.043s |

Both implied miss rates (0.18%–0.36%) sit squarely inside mainnet's normal
range. Nothing anomalous happened in July; the sign and magnitude are fully
explained by empty slots.

**To pin it exactly:** sum `blocksElapsed * 12` across July's accrual events on
mainnet and compare to 2,678,400. The deficit is (a); the remainder is (b).

The point to take away is not the six dollars. It is that on mainnet this
contract charges an unpredictable rate slightly *below* 4.00%, drifting with L1
client health — a parameter you neither control nor observe.

---

## 2. What this code does on Base

Base's `block.number` is the L2 block number. Base mainnet produces a block
every **2 seconds**, deterministically — the sequencer emits a block even when
empty, so unlike mainnet there is no undercount. The multiplier is a clean
**6.0x**.

31 days on Base:

```
real elapsed            2,678,400 s
blocks produced         2,678,400 / 2        = 1,339,200
blocksElapsed * 12      1,339,200 * 12       = 16,070,400 s   <- what the contract believes
                                             = 186.0 days
```

The contract thinks 6 months have passed in one month.

```
simple:     1,000,000 * 0.04 * 16,070,400 / 31,536,000  = 20,383.56 USDC
```

With stepwise compounding at daily accrual, ~20,586 USDC. Call it **20,400 –
20,600 depending on call cadence, against a correct 3,397** — an overcharge of
roughly **17,000 USDC per month** on this one position.

Annualised, a "4.00% fixed" loan bills at **24% simple / ~27.1% continuously
compounded**. And since `accrueInterest()` is permissionless and compounding is
path-dependent, anyone can call it in a tight loop to push toward the upper
bound.

### The worse part

`SECONDS_PER_BLOCK` is a `constant` — it is baked into bytecode. There is no
setter and no way to correct this post-deployment without a redeploy and a debt
migration.

And Base's block time is a chain config parameter set by the sequencer operator,
not by you. It is 2s today; Base has publicly pursued shorter block times
(Flashblocks ship 200ms preconfirmations, with a stated direction toward
sub-2s full blocks). **Confirm Base's current block time immediately before any
deploy.** If Base halves it to 1s in a future hardfork, this contract silently
goes from 24% to 48% APR with no transaction, no event, and no code change on
your side. That is the actual risk class here: you have delegated your interest
rate to another team's config file.

(Flashblocks alone do not change this — preconfirmations don't increment
`block.number`. A block-time hardfork does.)

---

## 3. What I would change

### Required: meter in seconds, not blocks

```solidity
uint256 public lastAccrualTime;   // replaces lastAccrualBlock

function accrueInterest() public {
    uint256 secondsElapsed = block.timestamp - lastAccrualTime;
    if (secondsElapsed == 0) return;
    index += index * rateBps * secondsElapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

Delete `SECONDS_PER_BLOCK` entirely. `block.timestamp` tracks wall-clock on all
three chains: mainnet (proposer can nudge it a few seconds — irrelevant at this
magnitude), Arbitrum (sequencer-set, clamped against L1, accurate in practice),
Base (L2 block timestamp, real time). This is the only change that makes
"4.00% per year" mean 4.00% per year everywhere, including retroactively fixing
the mainnet undercount.

Do **not** take the alternative of making `SECONDS_PER_BLOCK` a per-chain
immutable. It still breaks the day a chain changes its block time, and it does
nothing for mainnet's missed-slot drift.

### Recommended: make compounding path-independent

As written, the amount owed depends on *how often someone calls a public
function*. Over a year at 4% the spread is 4.000% (one call) to 4.081%
(continuous) — small, but it means the rate is not fixed, and it is a free
lever for anyone with gas. Use a per-second rate raised to the elapsed power
(Maker `rpow` / Aave's binomial approximation):

```
index = index * rayPow(ONE_RAY + ratePerSecond, secondsElapsed) / ONE_RAY;
```

Then N calls of 1 second and 1 call of N seconds produce the same index. Decide
explicitly whether the quoted 4.00% is nominal or effective; if effective, set
`ratePerSecond = 1.04^(1/31_536_000) - 1`.

### Also

- **Migration.** The live mainnet and Arbitrum deployments cannot be patched
  (`constant`). If they are behind a proxy, the new implementation needs a
  one-time `lastAccrualTime` initialiser; if not, they need redeploy plus debt
  migration. Either way, decide what you do about July's shortfall on existing
  borrowers before it grows.
- **Overflow.** `index * rateBps * secondsElapsed` is fine for a 1e18-scaled
  index, but tight for a 1e27 (ray) index over long gaps. Use `mulDiv`.
- **Truncation.** Integer division truncates in the protocol's favour by <1 wei
  per call. Negligible at 1e18 scale; if you ever move to per-block accrual on
  a fast chain with a low-precision index, re-check it.
- **Test that would have caught this.** A fork test per target chain asserting
  `(block.number delta) * 12 == (block.timestamp delta)` over a ~1000-block
  window. It passes on mainnet and Arbitrum and fails loudly on Base. Add it
  as a deploy-time gate for every new chain.
- **`365 days` vs 365.25.** Cosmetic, but pick one and document it; it is
  currently a ~0.07% mismatch against any annualised figure quoted to
  borrowers.

---

## Unresolved questions

1. Are the live mainnet/Arbitrum deployments proxied, or does fixing this mean
   a redeploy and debt migration?
2. Is 4.00% meant as nominal-with-compounding or effective annual? Determines
   the per-second rate constant.
3. Do you want to true up July's ~0.18% undercharge on existing borrowers, or
   let it stand and fix forward only?
4. What is your accrual call cadence in practice? Needed to close out the
   reconciliation exactly, and it changes as soon as compounding is made
   path-independent.
