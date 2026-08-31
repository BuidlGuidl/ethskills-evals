Done. `forge build` and `forge test` both pass (34 unit tests offline; 3 fork tests pass against live Base when `BASE_RPC_URL` is set).

## What's here

- **`src/UsdcYieldVault.sol`** — ERC4626 over USDC. Deposits stay idle until a keeper deploys them, 5% stays as a withdrawal buffer, plus deposit cap, pause, and `Ownable2Step` governance separated from a keeper allowlist.
- **`src/strategies/AerodromeUsdcWethStrategy.sol`** — swaps half to WETH, adds liquidity to the Aerodrome volatile USDC/WETH pool, stakes the LP in the gauge; `harvest()` claims AERO, sells it, takes a performance fee, and compounds the rest.
- **Tests** — mocks that reproduce Aerodrome's constant-product math, LP minting, and gauge staking, plus a fork suite that runs the real lifecycle on Base.
- **`README.md`** — deployment, keeper runbook, integration rationale, and known limitations.

## Verification over recall

I resolved every external address on-chain rather than from memory, which mattered: the AERO address I'd have written from memory (`0x940181a94A35A4569E4529A3CD67377E17d5e00D`) has no code on Base. The real one is `...CDfB74e38FD98631`, obtained via `Voter.gauges(pool)` → `gauge.rewardToken()`. Router/gauge function selectors were checked against deployed bytecode before I wrote the interfaces.

Two things the live fork taught me that the mocks wouldn't have:
- A 23.7k USDC swap against the real pool costs **1.24%** vs Chainlink, so the 1% guard correctly rejects it. That's why `deployToStrategy` takes an amount — large inflows get deployed in ~20k slices. The README gives operators the sizing.
- For gauged Aerodrome pools, swap fees are routed to veAERO voters (`feesVotingReward`), not to stakers. So the yield is an emissions bet, and I said so rather than implying LPs earn fees.

## Design choices worth flagging

- `totalAssets()` values the LP as `2·sqrt(valueA·valueB)` off the Chainlink feed, so flash-loan reserve skews can't move the share price — a test dumps 40% of the WETH reserve and the value moves <0.5%. Swap floors come from the feed, never a router quote; AERO has no feed on Base, so its leg is floored by the AERO/WETH pool TWAP.
- Fair LP value exceeds what unwinding actually recovers (fees + impact), so strict ERC4626 `redeem` reverts on a full exit rather than shortchanging the caller. I added `redeem(shares, receiver, owner, maxLossBps)` for opt-in bounded loss.

## Concern I'll restate

Depositors hand over USDC and end up holding half an ETH position — this is not principal-protected, and emissions have to beat impermanent loss. It's at the top of the README along with six other limitations (socialized withdrawal costs, harvest front-running, optimistic `maxWithdraw`, no audit).

I didn't commit anything; the work is uncommitted in the working tree.
