# Aero USDC/WETH Vault (Base) — v1

ERC-4626 vault. Users deposit USDC and get `avUSDC` shares.
- Idle USDC is split about 50/50 into USDC + WETH, added to the **Aerodrome vAMM WETH/USDC** pool, and the LP tokens are staked in that pool's **gauge** (the contract that pays out AERO rewards).
- A keeper calls `harvest()` to claim AERO, sell it for USDC, and put everything idle back into staked LP (compounding).
- Withdrawals come from idle USDC first. If that isn't enough, the vault pulls out just enough LP and sells the WETH it gets back.

```
src/AeroUsdcWethVault.sol      vault + strategy (single contract)
src/interfaces/                minimal Aerodrome / Uniswap V3 / Chainlink interfaces
script/BaseAddresses.sol       Base mainnet addresses (checked onchain)
script/Deploy.s.sol            deploy script
test/AeroUsdcWethVault.t.sol   unit tests (mock DEXes / oracle)
test/*.fork.t.sol              Base fork tests (skipped unless BASE_RPC_URL is set)
```

## Build and test

```bash
forge build
forge test                                            # unit tests; fork suite is skipped
BASE_RPC_URL=https://mainnet.base.org forge test --match-contract Fork   # real Base contracts
```

## External integrations and why

| Purpose | Integration | Why |
|---|---|---|
| Liquidity position + yield | Aerodrome vAMM WETH/USDC `0xcDAC…5C43` + gauge `0x519B…C025` | Aerodrome (now "Aero") is the main DEX on Base. Its emissions go to staked LP, so a staked position earns AERO. That gives `harvest()` a real reward to claim and compound. The vAMM LP is a plain ERC-20 (x·y=k, full range), so there are no price ranges to manage and it can be valued safely (see below). A concentrated-liquidity (Slipstream) position would need range management — too much for v1. |
| USDC↔WETH swaps (zap in / unwind) | Uniswap V3 USDC/WETH 0.05% pool via SwapRouter02 `0x2626…e481` | The vAMM holds only ~$9M and charges a 0.3% fee: a 100k USDC swap there loses ~2.5%. Live quotes on 2026-09-21 for 100k USDC→WETH: Uniswap V3 0.05% returned 36.509 WETH, Slipstream returned 36.480, and the oracle fair price was ~36.56. Uniswap was the cheapest, and its interface is standard. |
| AERO → USDC | Aerodrome vAMM AERO/USDC (via Aerodrome Router) | The deepest AERO market (~$36M). |
| Pricing | Chainlink ETH/USD `0x7104…Bb70` + L2 sequencer uptime feed `0xBCF8…6433` | Share price must never come from the pool's own spot price, which can be moved within one transaction. The sequencer feed stops pricing while Base's sequencer (the node that orders transactions) is down, and for 1h after it comes back. |
| Vault standard | OpenZeppelin ERC4626 v5.1 | Standard interface. The virtual-share offset (`_decimalsOffset = 6`) blocks first-depositor share-inflation attacks. |

## Safety design

- **LP valuation**: `2·sqrt(rUSDC · rWETH · pETH)` using the Chainlink price ("fair reserves"). A swap in the pool changes its spot price but not `k`, so a flash loan can't inflate or deflate `totalAssets()`. USDC is treated as exactly $1.
- **Exit haircut** (`exitHaircutBps`, default 30 bps): the vault's WETH and LP are booked slightly under fair value. When someone withdraws, the cost of unwinding comes out of this margin, so it isn't pushed onto the holders who stay.
- **Pool price guard**: before every invest or unwind, the vAMM spot price must be within `maxDeviationBps` (1%) of Chainlink. Every USDC↔WETH swap has a minimum output set from the oracle (`maxSlippageBps`, 1%).
- **Profit unlock**: harvested profit is released into the share price in a straight line over `profitUnlockPeriod` (6h). This stops someone from depositing just before a harvest and withdrawing right after.
- **Deposit cap**, **pause** (stops deposits and harvests; withdrawals still work), **`emergencyExit`** (owner pulls all liquidity out; the owner sets the minimum amounts, so it still works if the oracle fails), **Ownable2Step** ownership transfer.
- **Fails closed**: if the oracle is stale or the sequencer is down, `totalAssets()` reverts, and so do deposits and withdrawals, until the feed recovers.

## Deployment

1. Set the env vars: `OWNER` (use a multisig), `KEEPER` (a hot EOA or keeper service), and optionally `DEPOSIT_CAP` (in USDC with 6 decimals; default `100000e6`).
2. Run the fork tests against the current Base state: `BASE_RPC_URL=… forge test --match-contract Fork`.
3. Deploy:
   ```bash
   forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --account deployer
   ```
   The constructor rejects a pool that isn't the USDC/WETH volatile pool, and a gauge that doesn't match the pool or doesn't pay AERO.
4. Start with a low cap. Raise it later with `setParams(...)`.

## Keeper operation

- Call `harvest(minUsdcOut)` every **6–24h**, and also soon after large deposits so new USDC gets invested. The keeper or the owner can call it.
- `minUsdcOut` protects the AERO sale, since there is no onchain AERO price check. Compute it off-chain:
  ```
  aero = vault.pendingRewards()
  quote = AerodromeRouter.getAmountsOut(aero, [(AERO, USDC, false, factory)])[1]
  minUsdcOut = quote * 0.99
  ```
- Skip the harvest when `pendingRewards()` is worth less than the gas it costs, unless there is idle USDC waiting to be invested.
- If `harvest` reverts with `PriceDeviation`, the vAMM is out of line with Chainlink, either because arbitrage is lagging or someone is manipulating the pool. Retry later. If it reverts with `StaleOracle` or `SequencerDown`, wait for the feed to recover.
- Watch the `Harvested`, `Invested` and `Freed` events. Also track idle USDC compared with LP value, and whether the gauge is still alive (`Voter.isAlive(gauge)`).

## Known limitations (v1)

- The keeper chooses `minUsdcOut`, so a compromised keeper could lose one harvest's worth of AERO to a sandwich trade. Users' principal is not at risk from this.
- The cost of swapping into the pool during `harvest` is shared by all holders (a few bps on Uniswap at normal sizes).
- A withdrawal that needs a large LP unwind can revert (`InsufficientLiquidity`) if slippage exceeds the haircut. Withdraw a smaller amount, or the owner can widen the params.
- USDC is assumed to be worth $1. There is no performance fee.
- Not audited.
