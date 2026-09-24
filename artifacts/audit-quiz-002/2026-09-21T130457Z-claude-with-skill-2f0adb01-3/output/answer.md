# Fixed-rate accrual: July reconciliation and Base deployment

## Short version

- **Arbitrum matched mainnet because `block.number` on Arbitrum is not the Arbitrum block number.** It returns an approximate **Ethereum L1 block number**. So the contract counted L1 blocks on both chains.
- **Both came in a little low because mainnet does not produce a block every 12 s.** Some slots are missed (no block that slot). The contract assumes exactly 12 s per block, so it undercounts time.
- **On Base the contract will overcharge about 6×.** Base (OP Stack) returns its own L2 block number, and Base makes a block every 2 s. About **20,400–20,600 USDC** instead of ~3,397.
- **Fix:** accrue on `block.timestamp`, not block count. Do not deploy the current code to Base.

---

## 1. July reconciliation

### What the rate implies

```
1,000,000 × 4% × 31/365 = 3,397.26 USDC   (simple interest, one accrual)
```

`accrueInterest()` compounds each time someone calls it (it multiplies the current `index`). With very frequent calls this gets close to continuous compounding:

```
1,000,000 × (e^(0.04 × 31/365) − 1) ≈ 3,403.03 USDC
```

So the "correct" figure for this code is somewhere between **3,397 and 3,403**, depending on how often it was called.

### Why Arbitrum matches mainnet

Your math (250 ms blocks → ~48× overcharge) would be right if `block.number` counted Arbitrum blocks. It doesn't. On Arbitrum One, the `block.number` opcode returns an **approximate L1 (Ethereum) block number**, set by the sequencer (the node that orders Arbitrum transactions) and kept in sync with L1. It moves forward in steps, not smoothly, but over a month it follows mainnet's block count closely.

To get the real Arbitrum block number you have to call `ArbSys(address(100)).arbBlockNumber()`. This contract doesn't, so on Arbitrum it counts **L1 blocks**, just like on mainnet. Same blocks counted → same interest. A dollar or two of difference comes from when each deployment was last accrued and the small lag in Arbitrum's view of the L1 block number.

This is luck: it only works because of an Arbitrum-specific quirk.

### Why both came in under 3,397

The code assumes every 12 s slot has a block. On Ethereum since the Merge, slots are 12 s but **some are missed** (the chosen validator is offline or late), and a missed slot does not increase `block.number`. Fewer blocks → the contract thinks less time has passed → less interest.

Working backwards from 3,391:

| How often accrued | "Expected" | Blocks counted vs. 223,200 slots in 31 days | Missed slots |
|---|---|---|---|
| Once (simple) | 3,397.26 | 3,391 / 3,397.26 ≈ 99.82% | ~0.18% (~410 slots) |
| Very often (compounded) | 3,403.03 | ≈ 99.65% | ~0.35% (~790 slots) |

A missed-slot rate of a few tenths of a percent is normal for mainnet. So a ~0.2–0.35% shortfall is exactly what you'd expect. Borrowers are slightly undercharged, and the gap grows whenever the network has a bad stretch of missed slots.

(Rounding down in the division also loses a tiny amount each call, but with an 18- or 27-decimal index that's negligible.)

---

## 2. What happens on Base

Base is built on the OP Stack. There, `block.number` is **Base's own L2 block number**, and Base makes a block **every 2 s, every time** (no missed slots).

Worked through on 1,000,000 USDC for 31 days:

```
Real time:          31 × 86,400            = 2,678,400 s
Blocks produced:    2,678,400 / 2          = 1,339,200 blocks
Contract's "time":  1,339,200 × 12         = 16,070,400 s  = 186 days
```

The contract acts as if **186 days** passed, not 31: **6× too much time.**

```
Simple (one accrual):     1,000,000 × 4% × 186/365           = 20,383.56 USDC
Frequent compounding:     1,000,000 × (e^(0.04 × 186/365) − 1) ≈ 20,592.80 USDC
Correct:                                                      ≈ 3,397–3,403 USDC
```

So borrowers get charged about **20,400–20,600 USDC instead of ~3,400**, an overcharge of about **17,000 USDC per million per month**. That's about **24% a year instead of 4%**. If Base ever shortens its block time, the error grows with it (e.g. 1 s blocks → 12×).

Since `accrueInterest()` is public, anyone can apply it at any time. The overcharge starts building from the first block, and there's no way to undo it after the fact.

---

## 3. What I'd change

**Use timestamps, not block counts:**

```solidity
uint256 public lastAccrualTimestamp;

function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTimestamp;
    if (elapsed == 0) return;
    index += index * rateBps * elapsed / (10_000 * 365 days);
    lastAccrualTimestamp = block.timestamp;
}
```

- Remove `SECONDS_PER_BLOCK` completely. No constant about block time works on every chain.
- `block.timestamp` means real time on mainnet, Arbitrum, Base, and other OP Stack chains. Missed slots don't matter, block speed doesn't matter, and it gives the full 3,397 (or up to 3,403 with compounding) on every chain.
- Timestamp manipulation isn't a real concern here. Mainnet timestamps are fixed to the slot. On L2s the sequencer can only shift them within tight limits (on Arbitrum, at most ~24 h back / ~1 h forward, and never earlier than the previous block). That's small next to a 4% annual rate, and it can't build up over time.

**Other points:**

1. **Existing deployments.** Mainnet and Arbitrum are running the block-based version. If they can be upgraded, move storage from `lastAccrualBlock` to `lastAccrualTimestamp` in the same transaction that calls a final `accrueInterest()`. If they can't be upgraded, plan a migration. Either way, both chains are currently undercharging by ~0.2–0.35%. It's small, but it's systematic, and Arbitrum's result depends on a chain quirk that could change.
2. **Compounding.** Because anyone can call `accrueInterest()`, the effective yearly rate depends on how often it's called: 4.00% if rarely, up to ~4.08% (e^0.04 − 1) if every block. Decide which one "4.00% per year" means and document it. If it must be exactly 4.00% APY, compute the per-second rate from the APY. If it's meant as an APR, accept the small difference.
3. **Checklist for multi-chain deploys.** Treat `block.number` as a red flag in any contract that has to work across chains. It means L1 block on Arbitrum, L2 block on OP Stack chains, and has other meanings elsewhere. Use it only for ordering, never to measure time.
4. **Test before Base.** Add a fork test on Base (and Arbitrum) that moves forward 31 days of real blocks/time and checks the interest is ≈ 3,397–3,403 per 1M.

**Recommendation:** don't sign off on Base with this code. The timestamp change is small, fixes Base, and removes the hidden undercharge on the existing two chains.
