# accrueInterest(): July reconciliation, and what happens on Base

## Short version

- The contract measures time as `block.number * 12`. That only works where `block.number` goes up once every 12 seconds.
- **Arbitrum:** in Solidity, `block.number` on Arbitrum returns an **L1 (Ethereum) block number**, not Arbitrum's own ~250 ms block count. It's the sequencer's recent view of L1. So it goes up about every 12 s, the same as mainnet. That's why Arbitrum matches mainnet. It's luck from a chain-specific quirk, not a design that's correct.
- **Why both show 3,391 instead of 3,397:** mainnet misses some slots, so fewer blocks get made than 12-second slots go by. The contract counts blocks, not time, so it counts less time than really passed.
- **Base:** `block.number` is Base's **own L2 block number**, with a new block every **2 s**. The contract will treat each 2 s as 12 s, so interest runs **6× too fast**. That's roughly 24% a year instead of 4%. On 1,000,000 USDC over 31 days, that's about **20,380–20,590 USDC instead of about 3,397**.
- **Fix before deploying to Base:** use `block.timestamp` and remove `SECONDS_PER_BLOCK`.

---

## 1. July reconciliation

### Target figure
1,000,000 × 4% × 31/365 = **3,397.26 USDC** (simple interest).

### Why Arbitrum didn't blow up
You were right that Arbitrum makes a block about every 250 ms. With 250 ms blocks, `blocksElapsed × 12` would overstate time by about 48× (12 / 0.25). But on Arbitrum the `NUMBER` opcode (`block.number`) does not return the L2 block number. It returns an L1 block number, roughly the Ethereum block the sequencer had seen when it took the transaction. Arbitrum's own block number is only available through `ArbSys(address(100)).arbBlockNumber()`.

So on Arbitrum, `block.number - lastAccrualBlock` counts **Ethereum blocks**. Multiplied by 12, you get the same "time" figure as on mainnet, and the charge comes out the same. The two differ by a couple of dollars because:
- Arbitrum's L1 block number trails real L1 a bit and moves in steps (it can jump several blocks at once).
- `accrueInterest()` is called at different moments on each chain, so start and end points don't line up exactly.
- Compounding differs slightly because the call frequency differs (see below).

### Why both come in under 3,397
Ethereum has a 12-second **slot**, but not every slot produces a block. When a proposer is offline or late, the slot is **missed**: 12 s go by and `block.number` doesn't move. Over 31 days there are 223,200 slots. If some are missed, `blocksElapsed × 12` comes out **smaller** than the real time elapsed, and the borrower is charged less. Arbitrum reads L1 block numbers, so it picks up the same shortfall. That's why both chains are short by the same amount.

Two smaller effects pull in opposite directions:
- **Compounding (pushes the charge up).** Each call does `index += index × rate × dt`. So calling it often compounds interest. If it were called continuously, 31 days at 4% would come to about 3,403 USDC. Anyone can call `accrueInterest()`, so how much compounding happens depends on how often people happen to call it.
- **Integer rounding (pushes the charge down, by very little).** The division rounds down on every call, in the borrower's favor. How much this matters depends on the scale of `index`. With 1e18 scale it's negligible.

3,391 is 0.18% under the simple figure. Against the fully compounded figure it's about 0.35% under. Both are in line with a normal mainnet missed-slot rate. The exact split depends on how often accrual was called in July. You can confirm from chain data: count blocks between the first and last July accrual, compare with (last timestamp − first timestamp) / 12, and the gap is the missed slots.

**Bottom line:** mainnet undercharges a little because missed slots aren't counted. Arbitrum matches mainnet only because its `block.number` happens to be an Ethereum block number.

---

## 2. What this code does on Base

Base (OP Stack) is different from Arbitrum: `block.number` is Base's **own L2 block number**, and Base makes a block every **2 seconds**. It doesn't have missed slots in the Ethereum sense. A block is produced every 2 s.

Over 31 days:

| Quantity | Value |
|---|---|
| Real time elapsed | 31 × 86,400 = 2,678,400 s |
| Base blocks produced | 2,678,400 / 2 = **1,339,200** |
| `secondsElapsed` computed by contract | 1,339,200 × 12 = **16,070,400 s = 186 days** |
| Interest if accrued once (simple) | 1,000,000 × 0.04 × 186/365 = **20,383.56 USDC** |
| Interest if accrued very often (compounded) | 1,000,000 × (e^(0.04×186/365) − 1) ≈ **20,592.73 USDC** |
| Correct figure | **3,397.26 USDC** |

So the borrower pays about **6× the stated rate**, roughly **24.3% a year instead of 4%**. That's about 17,000 USDC of overcharge per 1M per month. If Base's block time ever changes, the multiplier changes too (1 s blocks would make it 12×). Also, because anyone can call `accrueInterest()`, anyone can push the charge toward the higher, compounded figure by calling it often.

This is a correctness/fund-loss bug for borrowers on Base. It could also cause unfair liquidations, if liquidation checks read the inflated debt.

---

## 3. What I'd change

**Measure time directly. Don't infer it from block count.**

```solidity
uint256 public lastAccrualTime;

function accrueInterest() public {
    uint256 secondsElapsed = block.timestamp - lastAccrualTime;
    if (secondsElapsed == 0) return;
    index += index * rateBps * secondsElapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

- Remove `SECONDS_PER_BLOCK` and `lastAccrualBlock`. Set `lastAccrualTime = block.timestamp` in the constructor.
- `block.timestamp` is correct on mainnet (missed slots no longer cause undercharging), on Arbitrum, and on Base. It also stays correct if a chain changes its block time. The small leeway the sequencer or proposer has over timestamps doesn't matter at a 4% annual rate.
- Base's next month: deploy the fixed version. **Don't** deploy the current bytecode.
- Mainnet and Arbitrum: they undercharge a little and don't overcharge, so this isn't urgent. If they're upgradeable, call `accrueInterest()` once with the old logic, then switch to the new logic with `lastAccrualTime = block.timestamp` in the same transaction. If they're immutable, decide whether to leave them or migrate. Also, the Arbitrum deployment only works because of how Arbitrum's `block.number` behaves. If that ever changes, it breaks with no warning.
- Write down the intended rate meaning. Right now "4.00%" becomes a compounded rate whose size depends on how often anyone calls `accrueInterest()`. If finance means 4% simple, or 4% APY, pick one and make the math deterministic, e.g. a fixed per-second compounding rate. Then the reconciliation target is well defined.
- Add a test per target chain, run on a fork of mainnet, Arbitrum, and Base: move time forward 31 days, accrue, and check that interest on 1M USDC is about 3,397.

### Open questions
- Are the mainnet/Arbitrum deployments upgradeable, or would a fix mean migrating?
- Is 4% meant as simple APR or compounded APY?
