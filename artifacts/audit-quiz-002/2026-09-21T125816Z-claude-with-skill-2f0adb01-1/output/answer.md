# Block-based interest accrual: mainnet vs Arbitrum vs Base

## TL;DR
- The contract works out time from **block count × 12 s**. That is only roughly right on mainnet. On Arbitrum it gives the right answer by accident, and on Base it is badly wrong.
- **Arbitrum** matched mainnet because on Arbitrum, Solidity's `block.number` returns an **L1 (Ethereum) block number**, not the Arbitrum block number. So the contract was counting Ethereum blocks the whole time.
- **Both come in slightly under 3,397** because Ethereum doesn't produce a block in every 12 s slot. Some slots are missed (the proposer is offline or late), so fewer blocks pass than 31 days / 12 s.
- **Base** is an OP Stack chain. There, `block.number` is Base's own block number, and a new block comes every **2 s** with no gaps. The contract would count 6× the real time and charge **about 20,400–20,600 USDC instead of about 3,397**. In effect that's about 24% APR instead of 4%.
- **Fix:** accrue on `block.timestamp`, not `block.number`. **Do not deploy the current bytecode to Base.**

---

## 1. July reconciliation

### Expected figure
The rate on its own gives simple interest: 1,000,000 × 0.04 × 31/365 = **3,397.26 USDC**.

### Why Arbitrum ≈ mainnet
On Arbitrum One, `block.number` (the `NUMBER` opcode) returns an L1 block number. The sequencer (the operator that orders Arbitrum transactions) sets it from the latest Ethereum block it has seen. It lags real L1 by a few minutes and sometimes jumps several blocks at once. To get the real Arbitrum block number, which advances roughly every 250 ms, you have to call `ArbSys(address(100)).arbBlockNumber()`, and this contract doesn't.

So on Arbitrum the contract counted Ethereum blocks, the same as mainnet did. That is why the results agree. You were right that the real Arbitrum block rate would have given about 48× too much interest. The code just never sees that rate.

The couple-of-dollars gap between the two chains comes from two things:
- The L1 number Arbitrum reports lags by a few minutes at the start and end of the month.
- `accrueInterest()` was called at different times on each chain. Each call compounds, so the call pattern slightly changes the total.

### Why both are a bit under 3,397
- 31 days / 12 s = **223,200 slots**. Mainnet produces a block in most slots, but not all of them.
- Every missed slot is 12 s of real time the contract never charges for.
- 3,391 / 3,397.26 ≈ 0.9982, so about **0.2% fewer blocks** than slots.
- The shortfall is actually a bit bigger than that. Because each `accrueInterest()` call compounds on the current index, frequent calls push the total up toward continuous compounding, which is **3,403.04**. Against that, 3,391 means about **0.35%** missed slots. That is in line with mainnet's usual missed-slot rate.
- Integer rounding in `index * rateBps * secondsElapsed / …` also rounds down every call. It's negligible if `index` is high precision (e.g. 1e18 or 1e27).

So mainnet's figure is "4% minus missed slots, plus a bit of compounding". Arbitrum copies it because it is also counting L1 blocks.

---

## 2. What happens on Base

On Base (OP Stack), `block.number` is Base's own block number. Base makes a block exactly every **2 s**, one per slot, with no missed slots.

| | |
|---|---|
| Real time | 31 days = 2,678,400 s |
| Base blocks | 2,678,400 / 2 = **1,339,200** |
| Time the contract thinks passed | 1,339,200 × 12 = 16,070,400 s = **186 days** |
| Interest charged, simple (few accruals) | 1,000,000 × 0.04 × 186/365 = **20,383.56 USDC** |
| Interest charged, compounded (accrued very often) | 1,000,000 × (e^(0.04×186/365) − 1) ≈ **20,592.73 USDC** |
| Correct figure | **≈ 3,397 USDC** |

- Borrowers would be **overcharged 6×**, about **+17,000 USDC per 1M per month**. That works out to 24% APR, or about 27% APY if compounded, instead of 4%.
- Anyone can call `accrueInterest()`. That only changes how often interest compounds (between the two charged figures above). It does not remove the 6× error.
- The size of the error depends on Base's block time. If Base ever shortens it (it has been 2 s so far), the overcharge grows by the same factor, with no code change on your side.
- It is also wrong in the other direction for suppliers and liquidations. Debt grows 6× faster than the rate you advertise, so healthy positions get liquidated early.

---

## 3. What I would change

1. **Accrue on time, not blocks.**
   ```solidity
   uint256 public lastAccrualTime;

   function accrueInterest() public {
       uint256 elapsed = block.timestamp - lastAccrualTime;
       if (elapsed == 0) return;
       index += index * rateBps * elapsed / (10_000 * 365 days);
       lastAccrualTime = block.timestamp;
   }
   ```
   - This behaves the same on mainnet, Arbitrum, Base, and any other chain. It gives exactly 3,397 (plus compounding) and doesn't depend on missed slots.
   - `block.timestamp` can't be meaningfully manipulated here. Since the Merge, mainnet timestamps are fixed to the 12 s slot. On L2s the sequencer can only move them within a narrow allowed window, which is negligible for 4% APR.
   - Remove `SECONDS_PER_BLOCK` entirely.
2. **Don't "fix" it with a per-chain constant** (e.g. `SECONDS_PER_BLOCK = 2` on Base). It still breaks if the chain's block time changes, it still undercounts on mainnet, and it keeps the Arbitrum trap in place.
3. **Decide on simple vs compounded interest and write it down.** Right now, the interest someone ends up paying depends on how often someone calls `accrueInterest()`. At 4% that's roughly a 6 USDC per 1M per month difference, small but real. If finance expects exactly 3,397, either document that "4%" is an APR compounded on each call, or use a simple-interest model that accrues only against principal.
4. **Existing deployments:**
   - Mainnet and Arbitrum currently undercharge by about 0.2–0.35%. That's minor, but it's a revenue leak and a reconciliation difference every month.
   - If they are upgradeable, migrate them by setting `lastAccrualTime = block.timestamp` in the same transaction that runs a final block-based `accrueInterest()`.
   - If they aren't upgradeable, just be aware the shortfall will continue.
5. **Tests:** add a fork test per target chain that warps 31 days (`vm.warp` + `vm.roll` with that chain's real block time) and checks the result is ≈ 3,397 per 1M. That would have caught this.

**Recommendation: block the Base deployment until accrual uses `block.timestamp`.**

### Open questions
- Are the mainnet and Arbitrum contracts upgradeable, or do we need a migration plan instead?
- Should "4%" mean simple APR (3,397 exactly) or compounded? Finance should confirm.
