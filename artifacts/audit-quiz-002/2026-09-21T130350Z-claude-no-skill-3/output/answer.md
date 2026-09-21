# Interest accrual across mainnet / Arbitrum / Base

## Short version

The contract doesn't measure time. It counts `block.number` and assumes each block takes 12 s. What `block.number` means depends on the chain:

| Chain | What `block.number` returns | Real time per unit | Result |
|---|---|---|---|
| Ethereum | L1 block number | ~12 s (a bit more when slots are missed) | about right, slightly low |
| Arbitrum One | **L1 block number** (an approximate, slightly delayed copy of Ethereum's) | ~12 s | same as mainnet |
| Base (OP Stack) | **L2 block number** | 2 s | **6× too much interest** |

Do not deploy this to Base as written.

## 1. July reconciliation

**Why Arbitrum matches mainnet.** On Arbitrum, Solidity's `block.number` does not return Arbitrum's own block number, which ticks every ~250 ms. It returns an approximate Ethereum (L1) block number that the sequencer passes in. The real Arbitrum block number is only available through `ArbSys(address(100)).arbBlockNumber()`. So over July, `block.number - lastAccrualBlock` on Arbitrum grew by about the same count of Ethereum blocks as on mainnet. Then `× 12` gave the same "seconds" figure. The 250 ms estimate would have been correct if the contract used `arbBlockNumber()`, but it doesn't. You got the right answer by luck of how Arbitrum is built, not because the code handles it.

**Why both come in a bit under 3,397.**
- Rate-only figure: 1,000,000 × 4% × 31/365 = **3,397.26**.
- 31 days is 223,200 twelve-second slots. But Ethereum produces a block only when the chosen validator shows up. Missed slots produce no block, so `block.number` grows by fewer than 223,200. Each missed slot is 12 s of interest that is never charged.
- The index compounds every time `accrueInterest()` runs. With frequent calls, that adds up to about +$6 over the month (e^0.003397 − 1 vs 0.003397).
- Put together: 3,391 is ~$6 below simple interest and ~$12 below fully compounded. That means ~0.2–0.35% fewer blocks than slots, or roughly 450–800 missed slots in July. That matches normal mainnet missed-slot rates.
- Arbitrum reads those same L1 block numbers, so it misses the same slots and lands on the same shortfall. The "couple of dollars" gap is from different call timing (how often and when the index was compounded) and Arbitrum's L1 block number lagging by a few blocks at the start and end of the month.
- Integer rounding in the index update is negligible (<1 wei per call at 1e18 scale).

So mainnet undercharges a little, and by an amount that changes over time: it tracks validator uptime, not the clock.

## 2. What it does on Base

Base is an OP Stack chain. There, `block.number` is Base's own L2 block number. Blocks come every 2 s, with no missed slots.

- Real time: 31 days = 2,678,400 s
- Blocks: 2,678,400 / 2 = **1,339,200**
- Contract's "seconds": 1,339,200 × 12 = **16,070,400 s = 186 days**
- Simple interest: 1,000,000 × 0.04 × 186/365 = **20,383.56 USDC**
- With frequent accrual calls (compounding): e^0.020384 − 1 ≈ 2.059% → **~20,590 USDC**

That's **6×** the correct ~3,397. The effective rate is ~24% APR instead of 4%. Borrowers get overcharged by ~$17,000 per $1M per month. The exact number also depends on how often someone calls `accrueInterest()`. If Base ever shortens its block time, it gets worse (1 s blocks → 12×).

## What I'd change

1. **Measure time with `block.timestamp`, not block count.** This works the same on every chain:
   ```solidity
   uint256 public lastAccrualTime;

   function accrueInterest() public {
       uint256 elapsed = block.timestamp - lastAccrualTime;
       if (elapsed == 0) return;
       index += index * rateBps * elapsed / (10_000 * 365 days);
       lastAccrualTime = block.timestamp;
   }
   ```
   Remove `SECONDS_PER_BLOCK`. That constant is also why mainnet undercharges: missed slots stop mattering once you measure real time. L2 timestamps are set by the sequencer, but can only drift from real time within small limits and never go backwards, so this is fine for interest.
2. **Mainnet and Arbitrum deployments already live:** they're roughly right, so this isn't an emergency. But they undercharge ~0.2–0.35%, and the Arbitrum one relies on an Arbitrum-specific detail. If they're upgradeable, move them to timestamps. When switching, set `lastAccrualTime = block.timestamp` right after a final block-based `accrueInterest()` so no time is double-counted or skipped. If they aren't upgradeable, write down the known undercharge for finance.
3. **Optional:** if finance expects exactly the simple-interest number (3,397), decide whether the index should compound per call (the result then depends on how often people call it) or use simple interest per period. Either is fine, just pick one on purpose and document it.
4. **Before any new chain:** add a test that warps time by 31 days (`vm.warp`) and checks the charge, without depending on block count.

## Unresolved questions
- Are the mainnet/Arbitrum contracts upgradeable? That decides whether we migrate them or just document the gap.
- Should finance's expected figure be simple interest (3,397.26) or compounded (~3,403)?
