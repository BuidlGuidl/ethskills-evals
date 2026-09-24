# accrueInterest(): July reconciliation and the Base deployment

## Short version
- The contract counts time as **blocks × 12 s**. That assumption only holds on a chain whose `block.number` goes up once every 12 seconds.
- **Arbitrum:** `block.number` does **not** return the Arbitrum block number. It returns an **Ethereum L1 block number**, as last seen by the sequencer (the node that orders Arbitrum transactions). So the contract was really counting mainnet blocks on both chains. That's why the two figures match.
- **Both come in a little under 3,397** because mainnet does not produce a block in every 12-second slot. When a slot is missed, 12 s pass with no block, so time counted from blocks falls short of real time.
- **Base:** `block.number` **is** the Base block number, and Base makes a block every **2 s**. Each 2 s gets counted as 12 s, so interest runs **6× too fast**: about **20,400–20,600 USDC** instead of 3,397 on the example.
- **Fix:** accrue on `block.timestamp`, not `block.number`. Do not deploy to Base as-is.

---

## 1. July reconciliation

**Expected figure (simple interest, rate only):**
1,000,000 × 0.04 × 31/365 = **3,397.26 USDC**

**Why mainnet shows 3,391.**
31 days = 2,678,400 s = 223,200 slots of 12 s. A slot is missed when the validator picked for it doesn't produce a block. Each missed slot adds 12 s of real time but no block. So `blocksElapsed × 12` is always a little less than real time. 3,391 / 3,397.26 ≈ 0.998, a shortfall of about 0.2%. That fits mainnet's typical missed-slot rate. (The contract also compounds each time someone calls it. Compounding pushes the figure *up* slightly: with frequent calls, the full-rate figure would be about 3,403. So the real share of missed slots is probably a bit above 0.2%. Either way, the charge falls short because blocks are missing. Rounding down in integer division adds a negligible amount.)

**Why Arbitrum matches mainnet.**
Your ~250 ms figure is right for Arbitrum's own blocks. But in Arbitrum's EVM, `block.number` returns an *approximate L1 (Ethereum) block number*. The sequencer updates it every so often (it can lag L1 by a minute or so, and it jumps forward in steps). To get Arbitrum's own block number you have to call `ArbSys(address(100)).arbBlockNumber()`. So on Arbitrum:
- `block.number` moved at mainnet speed, about one step per 12 s slot actually filled;
- `blocksElapsed × 12` tracked real time exactly as badly as on mainnet;
- you inherited the same missed-slot shortfall, so you got the same ~3,391.

The Arbitrum number is right by accident, not because the code handles it. The small gap between the two chains comes from when and how often `accrueInterest()` was called, plus the sequencer's lag and step-wise updates of the L1 number.

## 2. What happens on Base

Base runs the OP Stack, the software Optimism uses for its rollups. On OP Stack chains `block.number` is the **L2 block number**, and Base makes one block every **2 s**, with essentially no missed blocks.

Over 31 days:
- real seconds: 31 × 86,400 = 2,678,400
- Base blocks: 2,678,400 / 2 = **1,339,200**
- seconds the contract thinks passed: 1,339,200 × 12 = **16,070,400 s = 186 days**

Interest on 1,000,000 USDC:
- accrued once at the end (simple): 1,000,000 × 0.04 × 186/365 = **20,383.56 USDC**
- accrued often (close to continuous compounding): e^(0.04 × 186/365) − 1 = e^0.020384 − 1 ≈ 0.020593, i.e. **≈ 20,593 USDC**

Compared with the correct **3,397**, that is **6×**. Borrowers are overcharged about **17,000–17,200 USDC** per million per month, an effective rate of about **24% a year instead of 4%**. Anyone can call `accrueInterest()`, so anyone can make the most of this: calling it often locks in the compounding at the higher end. And if Base ever shortens its block time, the error grows with it (1 s blocks would mean 12×).

## 3. What to change

Measure time directly with the clock, not by counting blocks:

```solidity
uint256 public lastAccrualTime;

function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTime;
    if (elapsed == 0) return;
    index += index * rateBps * elapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

- Remove `SECONDS_PER_BLOCK` completely. Block time is different on every chain and can change after a network upgrade, so it should never be hardcoded.
- `block.timestamp` is correct on mainnet, Arbitrum and Base. Validators or sequencers can shift it by a few seconds, which doesn't matter for interest charged over days.
- Set `lastAccrualTime = block.timestamp` in the constructor or initializer.
- **Existing mainnet and Arbitrum deployments:** they have been slightly *undercharging* (about 0.2%). If they can be upgraded, move to the timestamp version. When you do, seed `lastAccrualTime` with the current timestamp and call `accrueInterest()` under the old logic right before switching, so no period is counted twice or skipped. If they can't be upgraded, decide whether the ~0.2% shortfall is acceptable. It's a small loss for the lender, not a safety problem.
- **Decide what "4.00%" means.** The index compounds on every call, so the actual yearly figure depends on how often people call it (up to e^0.04 − 1 ≈ 4.08%). If finance means 4.00% simple (APR), convert it to a per-second rate that gives 4.00% effective, or reconcile against the compounded figure. Otherwise every reconciliation will show a small gap that depends on how often the function was called.
- Add a test that runs the same 31-day scenario on forks of each target chain (mainnet, Arbitrum, Base) and checks the result is within rounding of the expected interest.

**Recommendation:** block the Base launch until accrual uses `block.timestamp`. As written, the code overcharges borrowers on Base by about 6×.
