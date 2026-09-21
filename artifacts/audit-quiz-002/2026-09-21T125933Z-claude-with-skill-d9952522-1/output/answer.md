# accrueInterest(): July reconciliation and Base deployment

## Short version

- The contract doesn't measure time. It counts blocks and assumes each one is 12 s.
- On **Arbitrum**, `block.number` returns an **L1 (Ethereum) block number**, not Arbitrum's own ~250 ms block count. So Arbitrum counted mainnet blocks, and it landed on mainnet's number by accident.
- Both come in a bit **under** 3,397 because mainnet makes fewer than one block per 12 s. Some slots are **missed** (no block is produced), so the block count falls short of wall-clock time.
- On **Base** (OP Stack), `block.number` is Base's own L2 block number, and Base makes a block **every 2 s**. The contract will count 6× the real time and **charge about 6× the interest: ~20,380–20,590 USDC instead of ~3,397.**
- Fix: accrue on `block.timestamp`, not `block.number`. Do this before Base, and preferably on the existing deployments too.

---

## 1. July reconciliation

### Target
1,000,000 × 4% × 31/365 = **3,397.26 USDC** (simple interest on the rate).

### Mainnet: 3,391
31 days = 2,678,400 s, which is **223,200 twelve-second slots**. The contract charges for `blocks × 12` seconds, so it only matches real time if every slot produced a block. In practice some slots are missed: the proposer is offline, late, or the block gets orphaned, and `block.number` does not advance for that slot.

- 3,391 / 3,397.26 ≈ 0.9982, so about 0.2% fewer blocks than slots if the index was accrued rarely.
- `accrueInterest()` compounds: each call multiplies `index` on top of the last one. If it was called often (it's public, and every borrow or repay probably calls it), compounding adds up to ~6 USDC (the continuous-compounding figure is 3,403.04). Backing that out, 3,391 means ~222,400 blocks, or **~0.35% missed slots**.

Either way, a missed-slot rate of a few tenths of a percent is normal for mainnet and explains the entire shortfall. Integer rounding in the index update is negligible next to it.

### Arbitrum: also 3,391
Your arithmetic would be correct if `block.number` were Arbitrum's own block height. It isn't. On Arbitrum (Nitro), **`block.number` in the EVM returns an approximation of the L1 block number.** The sequencer periodically syncs it to the latest Ethereum block it has seen. Arbitrum's native L2 block height is only available through `ArbSys(0x64).arbBlockNumber()`.

So on Arbitrum the contract was counting Ethereum mainnet blocks all along, with the same missed slots and the same shortfall. The couple of dollars of difference come from:
- the L1 number on Arbitrum lags real L1 and moves in jumps (the sequencer updates it periodically, not every 12 s), so the start and end of the window are off by a few blocks;
- different accrual timing and cadence on each deployment (compounding, and where the month boundaries fall).

**This is luck, not correctness.** The Arbitrum deployment is correct only because of an Arbitrum-specific quirk. The code itself still assumes something that isn't true.

## 2. What happens on Base

Base is an OP Stack chain. There, `block.number` is the **L2 block number**, and blocks come every **2 seconds**. They are produced by the sequencer on a fixed schedule, so unlike mainnet there are effectively no missed slots.

Worked through for 1,000,000 USDC over 31 days:

| Step | Value |
|---|---|
| Real seconds | 31 × 86,400 = 2,678,400 |
| Blocks produced (÷ 2 s) | **1,339,200** |
| `secondsElapsed` the contract computes (× 12) | 16,070,400 s = **186 days** |
| Interest, accrued once at the end (simple) | 1,000,000 × 0.04 × 186/365 = **20,383.56 USDC** |
| Interest, accrued frequently (≈ continuous) | 1,000,000 × (e^(0.04·186/365) − 1) ≈ **20,592.73 USDC** |
| Correct charge | **3,397.26 USDC** |

**Borrowers get overcharged ~6× (≈ +17,000 USDC per 1M per month).** In rate terms that's a 24% APR instead of 4%. Because anyone can call `accrueInterest()`, anyone can also push the figure to the top of that range by calling it often. Borrowers could be liquidated on debt they don't actually owe.

## 3. What I'd change

**Must fix (blocker for Base):** accrue by timestamp.

```solidity
uint256 public lastAccrualTime;

function accrueInterest() public {
    uint256 elapsed = block.timestamp - lastAccrualTime;
    if (elapsed == 0) return;
    index += index * rateBps * elapsed / (10_000 * 365 days);
    lastAccrualTime = block.timestamp;
}
```

- Delete `SECONDS_PER_BLOCK`. Block time is a property of the chain, not something the contract should hardcode.
- Set `lastAccrualTime = block.timestamp` in the constructor/initializer.
- `block.timestamp` tracks real time on mainnet, Arbitrum and Base. It fixes the 6× bug on Base and the ~0.2–0.35% undercharge on mainnet and Arbitrum.
- Timestamps can be manipulated only slightly: validators/sequencers have a few seconds of leeway, which is irrelevant for a 4% loan.

**Existing deployments:** they currently undercharge slightly and rely on assumptions that can break:
- Arbitrum only works because of how it defines `block.number`.
- Mainnet only works while slots are 12 s. Shorter slot times have been proposed for Ethereum; if slots dropped to 6 s, this code would double-charge on mainnet too.

Migrate them to the timestamp version at the next upgrade or redeploy. If they're not upgradeable, at least record this as a known risk.

**Decide and document the rate definition:** the index compounds on every call, so the effective rate depends on how often someone calls `accrueInterest()`. That can be anywhere from 4.00% simple to ~4.08% continuously compounded. Pick one:
- keep compounding and call 4% the continuously-compounded rate (APR, not APY), accepting that calls push it toward the top; or
- move to a per-second rate so the compounding is predictable.

This is minor next to the Base bug, but finance should know the target 3,397 isn't exactly what the code computes.

**Before any new chain:** write a test that warps the timestamp and rolls the block number at that chain's real block time (Foundry `vm.warp` + `vm.roll`) and checks that 31 days of accrual comes out at ≈ 3,397.

## Unresolved questions
- Is the contract upgradeable? That decides how to migrate mainnet and Arbitrum.
- Is 4% meant as a simple or a compounded rate? That decides the exact target finance should reconcile against.
