# Flash-loan arbitrage bot — design

Borrow 100,000 USDC from Aave V3 on Ethereum mainnet, buy WETH on the cheaper DEX, sell it on the pricier one, repay the loan, keep what's left. All in one transaction; if any step comes up short, the whole thing reverts.

## Where the numbers come from

All numbers were read onchain via `cast` at **block 26,026,056 (2026-09-21 13:02 UTC)** unless marked otherwise. Re-check them before going live; they change.

| Item | Source | Value |
|---|---|---|
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | — |
| Flash-loan fee | `Pool.FLASHLOAN_PREMIUM_TOTAL()` | `5` bps = **0.05%** |
| USDC available in Aave | `USDC.balanceOf(aUSDC 0x98C2…6F5c)` | ~160.9M USDC (100k is fine) |
| DEX A: Uniswap V3 USDC/WETH 0.05% | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | mid price $2,739.15/ETH |
| DEX B: Uniswap V3 USDC/WETH 0.30% | `0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8` | mid price $2,732.42/ETH |
| Swap quotes | Uniswap QuoterV2 `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | see below |
| Base fee | block header | 0.534 gwei |
| ETH/USD | Chainlink `0x5f4e…8419` | $2,734.20 |

**Venue choice.** At 100k size only deep pools work. Other venues checked at the same time and ruled out:
- SushiSwap V2 USDC/WETH: 100k USDC → 21.67 WETH (~41% worse than fair). Too shallow.
- Curve tricryptoUSDC (`0x7F86…829B`): 100k USDC → 34.52 WETH (~5.5% worse than fair), fee ~0.37%. Too shallow.

So the example below uses the two Uniswap V3 pools (0.05% and 0.30% fee tiers) as "DEX A" and "DEX B". Other deep venues (Uniswap V4, Balancer, Fluid) weren't checked yet; do that before picking final venues. The cost model below works for any pair of venues.

## Execution sequence (one transaction)

Notation: `BUY` = the DEX where ETH is cheaper, `SELL` = the DEX where ETH is pricier.

| # | Step | USDC | WETH |
|---|---|---|---|
| 0 | Bot sends tx (private bundle, see costs) calling `Pool.flashLoanSimple(receiver, USDC, 100_000e6, params, 0)` | — | — |
| 1 | Aave sends 100,000 USDC to the receiver contract | +100,000.00 | |
| 2 | Aave calls `receiver.executeOperation(USDC, 100_000e6, premium=50e6, initiator, params)`. Check `msg.sender == Pool` and `initiator == this` | | |
| 3 | Swap 1 on `BUY`: 100,000 USDC → X WETH, with `amountOutMinimum` set | −100,000.00 | +X |
| 4 | Swap 2 on `SELL`: X WETH → Y USDC, with `amountOutMinimum` set | +Y | −X |
| 5 | Require `Y ≥ 100,050 + minProfit`, otherwise revert (nothing lost except gas, and a private bundle that reverts isn't included) | | |
| 6 | `USDC.approve(Pool, 100,050)`, return `true`; Aave pulls 100,000 + 50 fee | −100,050.00 | |
| 7 | Profit `Y − 100,050` stays in the contract; owner sweeps it | Y − 100,050 | 0 |

Gas is paid separately, in ETH, by the sending wallet.

**Measured example (block 26,026,056), buying on A and selling on B:**

| Step | Amount |
|---|---|
| Borrow | 100,000.00 USDC |
| Swap 1 on A (0.05%) | → 36.458611 WETH |
| Swap 2 on B (0.30%) | → 99,260.34 USDC |
| Repay | 100,050.00 USDC |
| Result | **−789.66 USDC → reverts at step 5** |

This direction was wrong at that block: A was 24.6 bps *more* expensive than B. But even if the direction had been right, the gap was smaller than the break-even worked out below, so no trade was worth making.

## Costs, itemized

Worked out for a 100k USDC round trip through the two Uniswap V3 pools, using the quotes above.

| # | Cost | How it's computed | USD |
|---|---|---|---|
| 1 | Aave flash-loan fee | 100,000 × 0.05% | **50.00** |
| 2 | Swap fee, 0.05% pool | 100,000 × 0.05% | **50.00** |
| 3 | Swap fee, 0.30% pool | ~99,620 × 0.30% | **298.86** |
| 4 | Price impact, 0.05% pool (100k in) | fair output after fee 36.489463 WETH − quoted 36.458611 WETH = 0.030852 WETH × $2,739.15 | **84.51** |
| 5 | Price impact, 0.30% pool (36.46 WETH in) | fair output after fee 99,321.47 − quoted 99,260.34 | **61.13** |
| 6 | Gas | ~400k gas (flash loan ~100k + two V3 swaps ~90–145k each, per quoter estimates + transfers) × 0.534 gwei × $2,734 | **0.58** |
| | **Total fixed-ish cost** | 1 + 2 + 3 + 4 + 5 + 6 | **545.08** |

Costs that change or depend on how you win the trade:

- **Gas when the network is busy**: same 400k gas at 20 gwei = $21.87; at 50 gwei = $54.68. Gas is cheap today (0.53 gwei), but the bot must read the base fee live.
- **Builder tip / priority fee**: other bots compete for the same gap. Winning usually means giving most of the surplus to the block builder (via Flashbots-style bundle or `coinbase.transfer`). This comes *out of profit*, so it doesn't move break-even, but it sets how much you actually keep. Budget it as a % of profit, not a fixed fee.
- **Failed attempts**: if sent through the public mempool, a revert still costs gas (~$0.5 today, ~$20+ when busy) and you get front-run. Send only as a private bundle, so a revert costs nothing.
- **Price impact scales with size**: the $145.64 impact (items 4+5) is for exactly 100k. It grows faster than linearly with size. With a small gap, the best trade size is often less than 100k.

Swapping in other venues: replace items 2–5 with that venue's fee tier and a quote for the actual size. Don't reuse these numbers.

## Minimum price gap (break-even)

Define the gap as the value difference, at mid prices, between the two venues for a 100k trade:

```
gap_usd = 100,000 × (P_sell − P_buy) / P_buy
profit  = gap_usd − (flash fee + swap fees + price impact + gas)
```

Break-even is where profit = 0:

```
gap_min = 50.00      (Aave flash fee, 0.05%)
        + 50.00      (swap fee, 0.05% pool)
        + 298.86     (swap fee, 0.30% pool)
        + 84.51      (impact, 0.05% pool)
        + 61.13      (impact, 0.30% pool)
        + 0.58       (gas @ 0.534 gwei)
        = 545.08 USD
```

**Below a ~$545 gap on 100k (≈ 54.5 bps, or ≈ $14.9 per ETH at $2,735), running it loses money.** At 20 gwei gas the line rises to ~$566; at 50 gwei, ~$599.

Checking against the measured block: the gap between the pools was 24.6 bps ≈ $246 on 100k, well under $545. Correct result: don't trade.

Where the costs come from: 64% is swap fees ($349), 27% is price impact ($146), 9% is the Aave fee ($50), and gas is ~0%. The biggest lever is venue choice. Two pools at 0.05% would cut swap fees to $100 and break-even to about $296, though price impact would need re-quoting.

## Implementation notes

- Before sending, simulate the whole trade with `eth_call` / QuoterV2 at the exact size. Only send if `simulated profit − tip > 0`.
- Set `amountOutMinimum` on both swaps and check the repayment amount in `executeOperation`. Never trust a quote taken in an earlier block.
- Receiver contract: only `Pool` can call `executeOperation`, only this contract can start the loan, only the owner can sweep. Keep no standing approvals besides the exact repayment amount.
- Fork-test on an Anvil mainnet fork at a pinned block: a profitable path, the revert path (gap too small), and a slippage revert.

## Open questions

1. Final second venue: check Uniswap V4, Balancer, and Fluid USDC/WETH depth and fees at 100k?
2. Fixed 100k size, or pick the size that maximizes profit for each opportunity?
3. Tip policy: what % of profit goes to the builder?
