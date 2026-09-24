# Oracle design review: WETH collateral / USDC debt, 85% LTV, Ethereum mainnet

## Short version

Reading `slot0` is not "our own reserve of truth." `slot0` is *the price left behind by
the last swap that touched the pool*. Anyone willing to pay two rounds of the 0.05% swap
fee gets to choose what that number is, for the exact duration of our `staticcall` and no
longer.

Worked below: displacing this pool by 10% and reading it in the same transaction costs an
attacker roughly **$5k–$10k**, and the cheapest payoff path on a book like ours returns
**several hundred thousand to over a million dollars**. That is a 20–100× return on a
single atomic transaction. The design is not marginally risky; it is a standing bounty.

Recommendation: price collateral with **Chainlink ETH/USD ÷ USDC/USD**, validated with the
checks in §5, and use a Uniswap V3 **30-minute TWAP only as a divergence sentinel** that
trips a circuit breaker — never as the price itself, and never `slot0` under any
circumstances.

---

## 1. The load-bearing error in the write-up

> "arbitrage bots would drag it back within the same block, so they would eat the loss for nothing"

This is the whole argument, and it is false. The attack is a **single transaction**:

```
tx (one atomic callstack):
  1. flashLoan(5,000,000 USDC)            // Balancer / Morpho: 0 fee
  2. swap USDC -> WETH on the 0.05% pool  // pushes slot0 up 10%
  3. call OUR contract                    // it reads slot0, sees the 10% price
  4. swap WETH -> USDC back               // returns slot0 to where it was
  5. repay flash loan
```

No other transaction can be inserted between steps 2 and 4. There is no window for an
arbitrage bot to exist in. The attacker is not holding a displaced price across a block
boundary and hoping to escape — the displacement lives and dies inside their own callstack.

The corollary matters just as much: **the attacker never pays the notional.** Step 4
retraces exactly the same curve as step 2. In Uniswap V3 the fee is skimmed from the input
and is *not* added to the pool's liquidity, so the curve the attacker walks back down is
bit-for-bit the one they walked up. The round trip returns the principal in full. The only
thing consumed is:

- the 0.05% fee on leg 2,
- the 0.05% fee on leg 4,
- gas,
- the flash-loan fee (zero on Balancer or Morpho).

"Tens of millions of dollars" is the *notional*, not the cost. Confusing the two is the
single most common way a lending market ends up in a post-mortem.

Two smaller factual corrections while we're here:

- **$200M TVL is not $200M of depth.** In a concentrated-liquidity pool, TVL counts LP
  positions parked in ticks that are currently out of range. Those positions offer exactly
  zero resistance until the price reaches them. The only number that matters is the active
  liquidity at and adjacent to the current tick, which on this pool is a small fraction of
  headline TVL.
- **Post-Merge mainnet makes single-block manipulation easier, not harder.** Block builders
  sell deterministic ordering and top-of-block placement. The attacker doesn't have to win
  a gas auction; they buy the slot position outright through a bundle.

---

## 2. What it costs to move the price 10%

### Notional required

For a constant-liquidity band, moving price from `P` to `P'` requires
`Δy = L·(√P' − √P)` of token1 in. For a 10% move, `√1.10 = 1.0488`, i.e. a 4.88% move in
√P, so the USDC required is **4.88% of the USDC-side virtual reserve**.

- **Upper bound (v2-equivalent):** if all $200M were full-range, that's $100M per side, and
  4.88% of it is **~$4.9M**.
- **Realistic (V3 concentrated):** liquidity in this pool clusters tightly around spot and
  thins out fast past ±2%. Pushing to ±10% means clearing the dense zone and then crossing
  sparse ticks where each tick moves the price a lot for very little input. The realistic
  notional is **$3M–$8M**, i.e. *below* the v2 bound, not above it.

Either way, "tens of millions" overstates the notional by roughly an order of magnitude —
and the notional isn't the cost anyway.

### Actual cost, at $5M notional

| Component | Cost |
|---|---|
| Leg 2 swap fee (0.05% × $5M) | $2,500 |
| Leg 4 swap fee (0.05% × ~$5M) | $2,500 |
| Flash loan (Balancer / Morpho) | $0 (Aave v3 at 0.05% would be $2,500) |
| Gas (~1.5M gas @ 20–100 gwei, ETH $3k) | $90 – $450 |
| **Total** | **≈ $5,100 – $7,500** |

Add a builder payment if they need guaranteed top-of-block placement. Even at a generous
$50k bribe in a contested block, the all-in cost is **under $60k**, and in the ordinary
uncontested case it is **about $5,000**.

Note also: an attacker reading `slot0` isn't restricted to 10%. They pick whatever
displacement maximises profit, and the cost scales roughly with `√(1+d) − 1` — sublinearly.
Going from 10% to 25% displacement only about doubles the fee bill.

---

## 3. What they get for it

### Path B — push the price *down*, harvest liquidations (the cheap one)

This is the path that pays at 10% and is therefore the one that will actually be used.

Push WETH down 10%. Every position whose *true* LTV sits in **[76.5%, 85%)** now reads
above 85% and is liquidatable (85% × 0.9 = 76.5%). The attacker liquidates them in the same
transaction.

The liquidator repays `D` USDC of debt and receives collateral valued at `D × (1 + bonus)`
**at the manipulated oracle price**. Since that price is 0.9× reality, the WETH they receive
is truly worth:

```
D × 1.08 / 0.90  =  D × 1.20      (assuming an 8% liquidation bonus)
```

**A flat 20% instant profit on every dollar of debt they close.**

| Debt sitting in the 76.5–85% band | Closeable @ 50% close factor | Attacker profit | ROI on ~$7k cost |
|---|---|---|---|
| $1M | $500k | $100k | ~14× |
| $5M | $2.5M | $500k | ~70× |
| $10M | $5M | $1.0M | ~140× |

The damage lands on *our borrowers*, who were never unhealthy and get wiped out anyway.
Critically, this path does **not** need to beat any LTV threshold — the liquidation bonus is
pure margin on top. It is profitable at *any* manipulation size, which is why it is the
binding threat, not the over-borrow path everyone thinks of first.

### Path A — push the price *up*, over-borrow and walk away

Worth working because the answer is genuinely non-obvious: **a 10% inflation is not enough
here.** Credit `1.1V`, borrow `0.85 × 1.1V = 0.935V`, abandon collateral worth `V` → the
attacker *loses* 6.5%. The break-even inflation is:

```
1 / 0.85  =  1.1765   →  you need > 17.65% inflation
```

So the teammate's specific "10%" figure happens to be below the threshold for *this* path.
That is not a defence — it's a coincidence of the 85% LTV, and the attacker simply pushes
further, because pushing further is cheap:

At **25% inflation** (`√1.25 = 1.118` → ~11.8% of virtual reserve → ~$12M notional,
≈$12k in fees):

- Deposit $2M of true WETH → credited $2.5M → borrow $2.125M USDC → abandon.
- Profit: **$125k per wallet.**
- The WETH is flash-loanable, and the $2.125M of USDC borrowed buys back more than the $2M
  of WETH owed at true prices, so the flash loan closes cleanly.

**And the $2M cap does not bound this.** The cap is per position. Nothing stops ten fresh
addresses opening ten $2M positions inside the same transaction while the price is
displaced: **$1.25M profit for ~$12k**. The real bound is how much USDC is in the pool.

> Design consequence independent of the oracle choice: the $2M limit must be enforced as a
> **global per-block borrow cap**, not only a per-position cap, or any oracle failure —
> manipulation, a bad Chainlink print, anything — gets multiplied by however many addresses
> the attacker can spin up in one transaction.

### Summary

| | Cost | Gross payoff | ROI |
|---|---|---|---|
| Path B (down 10%, liquidate) | ~$7k | $100k – $1M+ | 14× – 140× |
| Path A (up 25%, over-borrow, 10 wallets) | ~$12k | ~$1.25M | ~100× |

---

## 4. Also not safe: the things that are merely *less* bad

- **TWAP as the primary price.** A 30-minute Uniswap V3 TWAP raises the manipulation cost
  by orders of magnitude, but it is not a source of truth. A validator with consecutive
  slots can sustain a displacement across blocks; V3 TWAP is a geometric mean of *ticks*,
  which is cheap to skew when liquidity is thin; and the pool's observation cardinality has
  to have been grown in advance or `observe()` reverts. It also *lags* — during a real
  crash a 30-min TWAP reports a price that no longer exists, which is exactly when
  liquidations need to be accurate. Use it as a sentinel, not as the number.
- **`slot0` with a "sanity band" around it.** Attackers just manipulate within the band and
  repeat. Bounding an attacker's per-transaction profit while leaving the per-transaction
  cost at $7k is not a mitigation.
- **The teammate's one genuinely correct point.** Chainlink *is* a third-party trust
  assumption: we inherit their node set and their aggregator's upgrade authority. That is
  real and should be named honestly. The right answer to it is redundancy and a divergence
  circuit breaker (§5.9–§5.10) — not self-sourcing from a pool anyone can rent for $7k.

Also worth internalising: even absent an attacker, `slot0` is *by construction* the
post-last-swap price. A routine MEV sandwich's front-run leg sets the number our contract
reads. We would be marking a $2M book to whatever the last bot in the block did.

---

## 5. What to price collateral with, and what to check around it

**Primary:** Chainlink ETH/USD, divided by Chainlink USDC/USD, on mainnet.

Verify both feed addresses against `data.chain.link` at deploy time and store them as
`immutable`. Do not hardcode addresses copied from a document, including this one.

### The checks, in order

1. **`price > 0`.** Reject zero and negative. `latestRoundData` returns `int256`.
2. **`updatedAt != 0`.** A zero timestamp is an incomplete round.
3. **`block.timestamp - updatedAt <= heartbeat + grace`, per feed.** Use each feed's *own*
   heartbeat. ETH/USD is a 1-hour heartbeat; USDC/USD is **24 hours**. A blanket
   `< 3600` check applied to USDC/USD will revert the whole market roughly permanently.
   This is the single most common way this check is gotten wrong.
4. **`block.timestamp >= updatedAt`.** Guards against a future-dated round.
5. **Sanity bounds.** `require(price > MIN && price < MAX)` with governance-settable
   absolute bounds. The historical failure here (Venus/LUNA) was a feed pinned at its
   aggregator floor while the real asset went to zero, and the lending market happily kept
   quoting the floor price.
6. **Read `decimals()` from the aggregator; do not hardcode 8.**
7. **Normalise decimals explicitly.** WETH is 18, USDC is **6**, Chainlink is 8. Pick one
   internal precision (18 recommended), convert at the boundary, and multiply before
   dividing everywhere.
8. **Do not assume USDC = $1.** Use the USDC/USD feed, but clamp it to a band (e.g.
   `[0.97, 1.03]`) and trip the breaker if it leaves that band. Rationale: a genuine depeg
   makes USDC debt *cheaper* in USD terms and therefore makes borrowers safer, but the
   USDC/USD feed's 24-hour heartbeat means it lags a fast depeg badly, and an unclamped
   stale-then-catching-up print can mass-liquidate a healthy book. Outside the band, our
   85% LTV calibration doesn't hold anyway and a human should be in the loop.
9. **Divergence sentinel.** Compute a 30-minute Uniswap V3 TWAP via `observe()` and compare
   it to the Chainlink price. If they diverge by more than ~5%, trip the circuit breaker.
   Grow the pool's observation cardinality at deploy time and handle `observe()` reverting.
   This catches a Chainlink malfunction without ever making the manipulable pool the price.
10. **What the breaker does matters more than when it trips.** Halt new borrows and
    collateral withdrawals. Be deliberate about liquidations: halting them converts an
    oracle risk into a bad-debt risk, while running them on a suspect price is the attack
    itself. Recommendation — halt liquidations too, but only for a short bounded window
    (~30 min) with an alert, then auto-resume. A >5% Chainlink-vs-30min-TWAP divergence is
    rare enough that eating a little bad-debt risk is the better trade.
11. **`answeredInRound >= roundId` is obsolete.** It is a no-op on modern OCR2 feeds; the
    staleness check in (3) is what actually does the work. Don't cargo-cult it.
12. **Budget for legitimate oracle error in the risk parameters.** Chainlink's 0.5%
    deviation threshold plus intra-heartbeat drift means the reported price can lawfully sit
    ~1% off market. The gap between 85% LTV and the liquidation bonus has to absorb that
    before it absorbs anything else.
13. **If we ever deploy to an L2** (Arbitrum, Optimism, Base): check the sequencer uptime
    feed and enforce a grace period after a restart, otherwise the first block after
    downtime liquidates everyone against a stale price.

### Reference implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @notice Prices WETH collateral in USDC terms for health calculations.
/// @dev Returns 18-decimal USDC-per-WETH. Never reads a DEX spot price.
contract WethUsdcOracle {
    AggregatorV3Interface public immutable ethUsd;    // 8 decimals, 1h heartbeat
    AggregatorV3Interface public immutable usdcUsd;   // 8 decimals, 24h heartbeat

    uint256 public constant ETH_USD_MAX_AGE  = 1 hours + 15 minutes;  // heartbeat + grace
    uint256 public constant USDC_USD_MAX_AGE = 24 hours + 1 hours;    // heartbeat + grace

    // Absolute sanity bounds, 8 decimals. Governance-settable in production.
    int256 public constant ETH_MIN = 100e8;
    int256 public constant ETH_MAX = 100_000e8;
    int256 public constant USDC_MIN = 0.97e8;
    int256 public constant USDC_MAX = 1.03e8;

    error StalePrice(address feed, uint256 updatedAt);
    error InvalidPrice(address feed, int256 price);
    error OutOfBounds(address feed, int256 price);

    constructor(AggregatorV3Interface _ethUsd, AggregatorV3Interface _usdcUsd) {
        require(address(_ethUsd) != address(0) && address(_usdcUsd) != address(0), "zero feed");
        // Both feeds must report 8 decimals for the scaling below to hold.
        require(_ethUsd.decimals() == 8 && _usdcUsd.decimals() == 8, "unexpected decimals");
        ethUsd = _ethUsd;
        usdcUsd = _usdcUsd;
    }

    function _read(
        AggregatorV3Interface feed,
        uint256 maxAge,
        int256 lo,
        int256 hi
    ) internal view returns (uint256) {
        (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();

        if (price <= 0) revert InvalidPrice(address(feed), price);
        if (updatedAt == 0 || updatedAt > block.timestamp) {
            revert StalePrice(address(feed), updatedAt);
        }
        if (block.timestamp - updatedAt > maxAge) {
            revert StalePrice(address(feed), updatedAt);
        }
        if (price < lo || price > hi) revert OutOfBounds(address(feed), price);

        return uint256(price); // 8 decimals
    }

    /// @return USDC per WETH, scaled to 1e18.
    function wethPriceInUsdc() external view returns (uint256) {
        uint256 eth  = _read(ethUsd,  ETH_USD_MAX_AGE,  ETH_MIN,  ETH_MAX);
        uint256 usdc = _read(usdcUsd, USDC_USD_MAX_AGE, USDC_MIN, USDC_MAX);

        // (eth/1e8) / (usdc/1e8) scaled to 1e18. Multiply before divide.
        return (eth * 1e18) / usdc;
    }
}
```

Health calculation on top of it, with the decimal conversion made explicit — this is where
the WETH-18 / USDC-6 mismatch bites:

```solidity
uint256 constant LTV_BPS = 8_500; // 85%

/// @param collateralWeth  WETH amount, 18 decimals
/// @param debtUsdc        USDC amount, 6 decimals
function isLiquidatable(uint256 collateralWeth, uint256 debtUsdc)
    internal view returns (bool)
{
    uint256 px = oracle.wethPriceInUsdc();              // 1e18, USDC per WETH

    // collateral value in 18-dec USDC terms
    uint256 collateralValue18 = (collateralWeth * px) / 1e18;
    // debt: 6 -> 18 decimals
    uint256 debtValue18 = debtUsdc * 1e12;

    // debt > collateral * 0.85   (multiply before divide; no truncation)
    return debtValue18 * 10_000 > collateralValue18 * LTV_BPS;
}
```

### Before this goes anywhere near mainnet

- Fork-test the whole flow at a pinned block: assert the health calculation is *unchanged*
  when a manipulating swap moves `slot0` by ±30% in the same transaction. That test is the
  regression guard for this entire review.
- Fuzz `isLiquidatable` across the full range of collateral, debt, and price, including
  zero and max, and assert no truncation-to-zero.
- Simulate a stale feed, a zero price, a negative price, and a USDC print at $0.88 — assert
  the breaker trips and that no position becomes liquidatable that shouldn't be.
- Global per-block borrow cap, not just the $2M per-position cap (§3).
- Slither clean on the oracle and health-calc paths; no unresolved unchecked-return or
  unprotected-state-change findings.
- Source verified on Etherscan after deploy.

---

## 6. One paragraph to send back to the teammate

The instinct — prefer data we can verify ourselves over a third-party dependency — is a
good one, and the Chainlink trust assumption you flagged is real and worth mitigating. But
`slot0` isn't self-sourced truth; it's the price left by the last swap, and for about
$7,000 in fees an attacker gets to be that last swap, read our contract, and swap back,
all inside one transaction where no arbitrage bot can reach them. They never pay the
notional, only the two 0.05% fees, because in an atomic round trip the curve is retraced
exactly. On our book, a 10% downward push pays roughly 20% on every dollar of debt
liquidated — six figures, plausibly seven. We should price with Chainlink, check it
properly (staleness per-feed, positive, bounded, decimals normalised), and use a 30-minute
TWAP only to detect Chainlink going wrong.
