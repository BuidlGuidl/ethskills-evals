# Block-based interest accrual: July reconciliation and Base forecast

## TL;DR
- The contract measures time by counting blocks and assumes each block is 12 s. That only holds when `block.number` counts Ethereum L1 blocks.
- **Arbitrum:** `block.number` returns an estimate of the **L1** block number, not Arbitrum's own ~250 ms block count. So the contract counted mainnet-paced blocks and matched mainnet.
- **Both under 3,397:** some mainnet 12 s slots produce no block (a missed slot). Missed slots mean fewer blocks than 31 days / 12 s, so less interest is charged.
- **Base:** `block.number` is Base's **own** block number. Base makes a block every 2 s, so the contract will charge about **6× the interest**: roughly **20,384 USDC instead of 3,397** on the example. **Don't deploy it as-is.**
- **Fix:** accrue interest based on `block.timestamp`, not `block.number`.

---

## 1. July reconciliation

### Why Arbitrum matched mainnet
On Arbitrum One, the `block.number` opcode does **not** return the L2 block number. It returns the sequencer's view of the latest **L1 (Ethereum) block number**. That value lags L1 a little and moves forward in jumps, but over a month it tracks mainnet closely. The real L2 block number is only available through `ArbSys(address(100)).arbBlockNumber()`.

So on Arbitrum, `blocksElapsed` counted Ethereum blocks, and `× 12` came out close to real elapsed time. Your "tens of times too much" figure would be correct if the contract read Arbitrum's ~250 ms blocks: 12 / 0.25 = 48×. It doesn't read them. You were protected by an Arbitrum-specific quirk, not by the design.

### Why both are a shade under 3,397
Expected interest at the rate alone (simple interest):

    1,000,000 × 0.04 × 31/365 = 3,397.26 USDC

That assumes 31 × 86,400 / 12 = **223,200 blocks**. Mainnet produced fewer than that. A slot whose proposer is offline or late produces no block, but real time still passes. Each missed slot costs 12 s of interest.

    3,391 / 3,397.26 ≈ 0.99816  →  ≈ 222,790 blocks counted, ≈ 410 slots missed (~0.18%)

That is a normal missed-slot rate for mainnet. Arbitrum inherits the same L1 block count, so it shows the same shortfall. That is why the two agree to within a couple of dollars. The small gap between them comes from Arbitrum's L1-number lag at the start and end of the month, and from differences in when `accrueInterest()` was called.

(Minor extra effects: each `accrueInterest()` call rounds the index down, which lowers the total slightly. Frequent calls also compound interest, which raises it slightly. Both effects are tiny next to the missed slots.)

So the code undercharges by roughly 0.2% on both chains today. How much depends on validator performance, not on your rate.

---

## 2. What happens on Base
Base is built on the OP Stack. There, `block.number` is the **L2 block number**, and Base produces a block every **2 s**. Flashblocks are sub-block previews and do not change `block.number`.

    Blocks in 31 days  = 31 × 86,400 / 2 = 1,339,200
    secondsElapsed     = 1,339,200 × 12  = 16,070,400 s = 186 days
    Real elapsed time  = 2,678,400 s     = 31 days      → 6× overcount

    Interest (single accrual at end)  = 1,000,000 × 0.04 × 186/365 = 20,383.56 USDC
    Interest (accrued very often)     ≈ 1,000,000 × (e^(0.04×186/365) − 1) ≈ 20,593 USDC

The borrower would be charged **≈ 20,384–20,593 USDC instead of 3,397**, about 6× too much. That is an effective rate of about **24% per year instead of 4%**.

- Unlike mainnet, the OP Stack sequencer doesn't skip slots, so the 6× figure is exact.
- If Base shortens its block time again (it has been discussed), the multiplier rises: 1 s blocks would mean 12×. A network setting change would silently change your interest rate.
- Anyone can call `accrueInterest()`. That doesn't change the total, but the overcharge is locked into the index as soon as someone calls it.

---

## 3. What I'd change
Measure elapsed time directly:

```solidity
uint256 public lastAccrualTime;

function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTime;
    if (elapsed == 0) return;
    index += index * rateBps * elapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

- Set `lastAccrualTime = block.timestamp` in the constructor or initializer. Remove `SECONDS_PER_BLOCK` entirely.
- `block.timestamp` works the same way on mainnet, Arbitrum, Base and other L2s. On L2s the sequencer sets it, within bounded drift from real time. That is accurate to seconds, which is fine for a 4% rate.
- This recovers the ~0.2% currently lost to missed slots on mainnet and Arbitrum, giving 3,397 on the example.
- Decide whether the rate is meant to be a simple APR or should compound. As written, the index compounds every time someone calls `accrueInterest()`, so the effective rate depends on how often it's called. Over 31 days the difference is tiny (3,397 vs ~3,403). Pick one on purpose and document it.
- Keep `index` in high-precision fixed point (1e18 or 1e27) so rounding down on each call is negligible.
- Existing deployments: if they're upgradeable, migrate by setting `lastAccrualTime = block.timestamp` in the upgrade step, right after one final `accrueInterest()` under the old logic. If they aren't upgradeable, they are only off by about 0.2% (undercharging), so the fix isn't urgent there. Base is the deployment that must not ship with block-number accounting.
- Add a test that runs accrual with 2 s, 12 s and 0.25 s block spacing and asserts the same interest. A test like that would have caught this.

### Unresolved questions
- Is the intended rate a simple 4% APR or a compounding one?
- Are the mainnet and Arbitrum deployments upgradeable?
- What precision does `index` use?
