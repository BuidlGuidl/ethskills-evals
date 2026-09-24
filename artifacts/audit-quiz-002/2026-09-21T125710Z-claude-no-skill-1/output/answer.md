# Block-based interest accrual: July reconciliation and Base forecast

## Short version

The contract doesn't measure time. It counts blocks and assumes each one is 12 seconds long. That assumption is almost right on mainnet. On Arbitrum it is right only by luck. On Base it is wrong by a factor of 6. **Do not deploy this to Base as written.** On Base it would charge about 6× the stated rate, roughly 24% a year instead of 4%.

---

## 1. July reconciliation

### Why Arbitrum matches mainnet

On Arbitrum One, the Solidity `block.number` does **not** return the Arbitrum block number. It returns an **approximate Ethereum L1 block number**: the latest mainnet block the sequencer (Arbitrum's block producer) has seen. The real L2 block number, which ticks roughly every 250 ms, is only available through `ArbSys(address(100)).arbBlockNumber()`.

So on Arbitrum, `blocksElapsed` counts **mainnet blocks**. Your 250 ms arithmetic (which would give about 48× too much interest) would be correct if `block.number` were the L2 number. It isn't. Both deployments count the same clock, mainnet blocks, so they land on the same figure. The couple of dollars of difference comes from Arbitrum's copy of the L1 block number lagging mainnet a little, plus exactly when `accrueInterest()` happened to be called near the month boundaries.

This is an Arbitrum-specific quirk, not a guarantee. It is also why the contract "works" there at all.

### Why both come in a shade under 3,397

- The rate implies: 1,000,000 × 4% × 31/365 = **3,397.26** (simple interest).
- The contract assumes 31 days = 2,678,400 s / 12 = **223,200 blocks**.
- Mainnet has one *slot* (a 12-second window for a block) every 12 s, but some slots are **missed**: the chosen validator doesn't produce a block. A missed slot takes up 12 real seconds but adds no block. So July contained fewer than 223,200 blocks, and the contract counted less time than actually passed.
- 3,391 / 3,397.26 ≈ 0.9982. That means the contract saw about 0.2% fewer blocks than slots. This is a normal missed-slot rate.

A second effect points the other way. Each `accrueInterest()` call compounds: it adds interest onto interest already added. If it's called often, 31 days of compounding would give up to about 3,403 instead of 3,397. So depending on how often the function was called, the real block shortfall was somewhere around 0.2–0.35%. Either way, the gap comes from **missed slots making the block count run behind the wall clock**. Rounding in the integer division is negligible provided `index` is kept at a high scale such as 1e18 (check this, see below).

Arbitrum shows the same shortfall because it counts the same mainnet blocks, missed slots included.

---

## 2. What happens on Base

Base is built on the OP Stack. There, `block.number` **is** the L2 block number, and Base produces a block every **2 seconds**, steadily, with no missed slots.

Worked for 1,000,000 USDC over 31 days:

| | Value |
|---|---|
| Real time | 31 × 86,400 = 2,678,400 s |
| Blocks on Base | 2,678,400 / 2 = **1,339,200** |
| `secondsElapsed` the contract computes | 1,339,200 × 12 = **16,070,400 s** (≈186 days) |
| Interest, one accrual at month end | 1,000,000 × 0.04 × 16,070,400 / 31,536,000 = **20,383.56 USDC** |
| Interest if accrued very frequently (compounding) | 1,000,000 × (e^(0.04×186/365) − 1) ≈ **20,592.73 USDC** |
| Correct figure | **3,397.26 USDC** |

So a borrower would be charged about **20,400–20,600 USDC instead of about 3,397**, an overcharge of about 17,000 USDC per million per month. Annualized, that is an effective rate of about **24% (about 27% with compounding)** instead of 4%. The 6× factor is simply 12 s ÷ 2 s. It doesn't depend on who calls the function or when.

---

## 3. What I would change

1. **Accrue on `block.timestamp`, not `block.number`.** This is the real fix, and it works on all three chains:

   ```solidity
   uint256 public lastAccrualTime;

   function accrueInterest() public {
       uint256 elapsed = block.timestamp - lastAccrualTime;
       if (elapsed == 0) return;
       index += index * rateBps * elapsed / (10_000 * 365 days);
       lastAccrualTime = block.timestamp;
   }
   ```

   Delete `SECONDS_PER_BLOCK`. Timestamps measure real time, so missed slots and differing block speeds stop mattering. Validators or sequencers can shift a timestamp by a few seconds at most, which doesn't matter for interest.

2. **Existing deployments.** Mainnet is off by about 0.2%, and Arbitrum works only because of the L1-block-number quirk. Both should move to timestamps when you can. If the contracts are upgradeable, set `lastAccrualTime = block.timestamp` in the same transaction that makes a final accrual under the old block logic. That way no period is counted twice or skipped. If they aren't upgradeable, plan a migration. The July shortfall is small: about 6 USDC per million per month, and it favors borrowers.

3. **Check the scale of `index`.** If `index` is stored at a low precision (for example 1e6), each call's integer division can round the interest down to zero. Anyone can call `accrueInterest()`, so a borrower could then call it every block and erase their interest. With a 1e18 or 1e27 scale this isn't a practical concern. Confirm which scale the contract uses.

4. **Optional: make compounding independent of call frequency.** Today the effective rate depends slightly on how often people call `accrueInterest()`: between 3,397 and 3,403 per million per month. If Finance wants "4.00%" to mean one exact number, choose either simple interest (accrue against a fixed principal) or a fixed compounding formula. Then document which one you chose.

5. **Add a test before the Base deploy.** Fork each target chain, move 31 days forward (both time and blocks, at that chain's block rate), and assert the accrued interest ≈ 3,397 per 1,000,000.

### Unresolved questions
- Is the contract upgradeable (via a proxy), or is a redeploy and migration needed for mainnet and Arbitrum?
- What is the scale of `index` (1e18? 1e27?)
- Should "4.00%" mean simple or compounded interest for reconciliation purposes?
