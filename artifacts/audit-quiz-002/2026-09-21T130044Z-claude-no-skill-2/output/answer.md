# Block-based interest accrual: July reconciliation and Base deployment

## Short version

- **Arbitrum matched mainnet because `block.number` on Arbitrum returns the Ethereum (L1) block number, not the Arbitrum block number.** The contract was counting mainnet blocks on both chains.
- **Both came in slightly low because mainnet does not produce a block in every 12-second slot.** Sometimes a validator misses its slot. The contract assumes exactly 12 s per block, so every missed slot is 12 s of interest that never gets charged.
- **On Base, `block.number` is Base's own block number, and Base makes a block every 2 s.** The contract will treat each 2 s as 12 s and charge about **6× the correct interest**: roughly **20,384 USDC instead of 3,397** on 1,000,000 USDC over 31 days.
- **Fix:** measure elapsed time with `block.timestamp`, not with a block count. Do not deploy the current code to Base.

---

## 1. The July reconciliation

### What the rate should give

31 days = 2,678,400 s.

```
1,000,000 × 0.04 × 31/365 = 3,397.26 USDC
```

### Why Arbitrum did not charge tens of times too much

Your estimate would be right if `block.number` counted Arbitrum blocks (about 4 per second). It doesn't. On Arbitrum One, the `NUMBER` opcode (`block.number` in Solidity) returns an **approximate L1 (Ethereum mainnet) block number**, as last reported to the sequencer (the node that orders Arbitrum transactions). The Arbitrum block number itself is only available through the precompile `ArbSys(address(100)).arbBlockNumber()`.

As a result:

- `block.number - lastAccrualBlock` on Arbitrum counts **mainnet blocks**, which advance about every 12 s.
- Many Arbitrum blocks in a row report the same L1 number. For those, `blocksElapsed == 0` and the function returns early without moving `lastAccrualBlock`, so no time is lost.
- Over a month, the Arbitrum deployment counts almost exactly as many blocks as the mainnet deployment. That's why the two agree. The couple of dollars of difference comes from the L1 number on Arbitrum trailing real L1 by a little, from different start and end points for the month, and from accrual calls landing at different moments on each chain.

So Arbitrum gave the right answer by accident. The contract never measured Arbitrum's block rate.

### Why both are slightly under 3,397

The contract's real clock is "number of mainnet blocks × 12 s". Mainnet has one **slot** every 12 s, but a slot produces no block when its validator is offline or late (a missed slot). July had 223,200 slots, and fewer blocks than that.

```
3,391 / 3,397.26 = 0.99816  →  about 0.18% of slots had no block
                            →  about 410 missed slots in July
                            →  about 82 minutes of time never charged
```

That missed-slot rate is normal for mainnet. Both chains count the same mainnet blocks, so both lose the same amount.

One more factor: each `accrueInterest()` call compounds (adds interest on interest). If someone called it very often, compounding would push the figure up, toward about 3,403 at one call per block. In that case the missed-slot shortfall was larger than 0.18%, roughly 0.35%. Either way, the direction and cause are the same: the contract counts blocks, blocks are fewer than slots, and the borrower is undercharged.

Rounding down in integer division is negligible here if `index` uses 1e18 or 1e27 precision.

---

## 2. What happens on Base

Base is built on the OP Stack. There, `block.number` is **Base's own block number**. Base produces a block every **2 s**, on a fixed schedule with no missed slots.

Worked through for 1,000,000 USDC over 31 days:

```
real time                  = 2,678,400 s
Base blocks                = 2,678,400 / 2          = 1,339,200 blocks
contract's secondsElapsed  = 1,339,200 × 12         = 16,070,400 s  (= 186 days)

interest, one accrual at month end:
  1,000,000 × 0.04 × 186/365                       = 20,383.56 USDC

interest, accrual called very often (near-continuous compounding):
  1,000,000 × (e^(0.04 × 186/365) − 1)             ≈ 20,593 USDC

correct figure                                     =  3,397.26 USDC
```

**Borrowers get overcharged by about 6×.** The effective rate is about 24% a year instead of 4%. Every 31 days of real time is booked as 186 days. The exact figure between 20,384 and 20,593 depends on how often someone calls `accrueInterest()`. The function is public, so anyone can push the charge toward the top of that range by calling it often.

It could get worse. If Base ever shortens its block time (for example to 1 s), the overcharge doubles without any change to your contract. Flashblocks (Base's sub-second previews of upcoming blocks) do not change `block.number` today, but a future change to block time could.

---

## 3. What I would change

**Required before deploying to Base:** use time, not block count.

```solidity
uint256 public lastAccrualTime;

function accrueInterest() public {
    uint256 secondsElapsed = block.timestamp - lastAccrualTime;
    if (secondsElapsed == 0) return;
    index += index * rateBps * secondsElapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

- Delete `SECONDS_PER_BLOCK` and `lastAccrualBlock`. Set `lastAccrualTime = block.timestamp` in the constructor.
- `block.timestamp` means real time on mainnet, Arbitrum, Base and other L2s, so the charge no longer depends on block rate or missed slots. On mainnet and Arbitrum this also recovers the roughly 0.2% that was being lost.
- On L2s, the sequencer sets the timestamp within limits (on Arbitrum, up to about 24 h in the past or 1 h in the future, and it never goes backwards). That's fine for interest accrual.

**Also worth deciding:**

1. **Compounding.** Right now, how much interest a borrower pays depends on how often anyone calls `accrueInterest()`: 3,397 at one call a month, about 3,403 at one call per block. Choose one on purpose:
   - Simple 4% APR: track principal and time, and don't compound the index.
   - A true 4% APY: use a per-second compounding formula (a precomputed per-second rate raised to the power of the elapsed seconds, as in Aave's or Compound's math).

   Then document which one it is.
2. **Existing deployments.** Mainnet and Arbitrum both undercharge by about 0.2%, and Arbitrum is correct only because of the L1-block-number behaviour described above. If the contracts can be upgraded, move them to the timestamp version. If not, record the shortfall and plan a migration. Don't treat the Arbitrum result as proof that the code is safe on other chains.
3. **Test for the case that caught us.** Add a fork test for each target chain that warps forward N days and checks the interest against `principal × rate × days/365`. It would have flagged the Base 6× error immediately.

## Open questions

- APR or APY: which does the loan agreement promise?
- Are the mainnet and Arbitrum contracts upgradeable, or do they need a redeploy and migration?
