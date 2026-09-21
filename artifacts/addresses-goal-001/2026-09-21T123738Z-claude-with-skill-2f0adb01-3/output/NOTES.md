# USDC → WETH on Base: notes

## Approach

`swap.ts` sells USDC for WETH directly against on-chain pools. There's no aggregator API.

1. **Safety checks.** Chain id is 8453. The Chainlink sequencer-uptime feed says the sequencer is up and hasn't restarted in the last hour. Chainlink ETH/USD is under 1h old.
2. **Quote every deep WETH/USDC pool on-chain** through each protocol's QuoterV2 (a read-only contract that simulates a swap and returns the output).
3. **Greedy split.** The order is cut into `SLICES` equal pieces (default 20). Each piece goes to the pool that gives the most extra WETH for it. Deep pools take more and thin pools take less, so price impact is spread out. This costs about `venues + SLICES` quoter calls.
4. **Oracle guard.** If the blended quote is more than `MAX_ORACLE_DEVIATION_BPS` (default 0.75%) worse than Chainlink ETH/USD, the script aborts. This catches a manipulated pool, a bad quote, or an order that's too big for on-chain liquidity.
5. **Execution** (only with `EXECUTE=1`, otherwise dry run):
   - Exact-amount USDC approvals per router, never unlimited.
   - One swap tx per leg. Each leg is re-quoted right before sending and simulated first.
   - Each leg's `amountOutMinimum` is the larger of:
     - fresh quote − `SLIPPAGE_BPS`
     - oracle-fair output − `MAX_ORACLE_DEVIATION_BPS`
   - 120s deadline. On Uniswap it's enforced through `SwapRouter02.multicall(deadline, [...])`, because its `exactInputSingle` has no deadline field.
   - Prints the WETH actually received and the average price.

```bash
npm install
RPC_URL=<paid Base RPC> AMOUNT_USDC=250000 npx tsx swap.ts                     # dry run
RPC_URL=... AMOUNT_USDC=250000 PRIVATE_KEY=0x... EXECUTE=1 npx tsx swap.ts     # live
```

## Venue choice: Aerodrome Slipstream + Uniswap V3, split

Aerodrome is Base's largest DEX. Its concentrated-liquidity ("Slipstream") WETH/USDC pools, together with the Uniswap V3 pools, hold most of the WETH/USDC depth on Base. No single pool is always best. Which one wins changes with size and time. Live quotes on 2026-09-21:

| Size | Result |
|---|---|
| 300k USDC | Best single-pool quotes ~108.9–109.7 WETH (Uni V3 0.3%, Uni V3 0.05%, Aero CL-100 all within ~0.1%). The split gave **109.96 WETH**, ~0 bps from Chainlink. |
| 15M USDC | The split routed most of it into Uni V3 0.3% and still came out 185 bps below the oracle, so the script aborted as designed. |

So the script doesn't hardcode one venue. It quotes all of them and splits the order.

Pools used (WETH/USDC):

| Venue | Detail |
|---|---|
| Uniswap V3 | fee tiers 0.01%, 0.05%, 0.30% |
| Aerodrome Slipstream | tick spacings 1 and 100 |

Other tiers and Aerodrome's classic volatile pool were checked and are thin or worse priced.

**Not used, but worth considering:**
- **Aggregators** (1inch v6 `0x111111125421cA6dc452d289314280a0f8842A65`, 0x, Odos, Kyber). They also reach Uniswap V4 and other pools and can do multi-hop routes, so they may beat this by a few bps. They need API keys and you have to trust calldata built off-chain. If you add one, keep this script's oracle check and `minOut` floor around it.
- **Uniswap V4 on Base** (PoolManager `0x498581ff718922c3f8e6a244956af099b2652b2b`). Not included; the Universal Router encoding adds a lot of complexity. It may have a competitive WETH/USDC pool, so check before assuming it doesn't matter.
- **For multi-million sizes:** RFQ/OTC or a TWAP (splitting the order over time) beats any single-block on-chain swap.

## Addresses (Base mainnet, all checked on-chain 2026-09-21)

| Contract | Address |
|---|---|
| USDC (native Circle, **not USDbC**) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| Uniswap V3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| Uniswap V3 Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` |
| Aerodrome Slipstream QuoterV2 | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` |
| Aerodrome Slipstream CLFactory | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |
| Chainlink L2 Sequencer Uptime | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` |

How they were checked:
- Every contract has bytecode.
- Both routers' `factory()` match the quoters' `factory()`.
- Both routers' `WETH9()` = `0x4200…0006`.
- `getPool` returns live pools.
- The Chainlink feeds' `description()` and `latestRoundData()` return sane values.

Contract calls used:
- `QuoterV2.quoteExactInputSingle` (both protocols; the struct differs: `fee` vs `tickSpacing`)
- `SwapRouter02.multicall(uint256,bytes[])` wrapping `exactInputSingle`
- Slipstream `SwapRouter.exactInputSingle` (the struct has `deadline`)
- `USDC.approve` / `allowance` / `balanceOf`
- Chainlink `latestRoundData`

## Tested

- **Dry run against live Base:** 300k USDC split 270k Aero CL-100 / 30k Uni V3 0.05%.
- **Full execution on an anvil fork** (a local copy of Base state), account funded with 500k USDC:
  - Both approvals and both swaps succeeded.
  - Received 109.9725 WETH vs 109.9696 quoted; average price 2727.95 USDC/WETH.
- **Oracle guard:** a 15M order aborted at 185 bps below the oracle.
- `tsc --strict` passes.

## Before running with real funds

1. **Re-verify every address** on basescan yourself. Use native USDC `0x8335…2913`; USDbC (the old bridged USDC) is a different token.
2. **Use a paid/private RPC.** The public `mainnet.base.org` rate-limited us during quoting. The script aborts on RPC errors rather than routing on partial quotes, but a flaky RPC mid-execution can leave you half-filled.
3. **Dry run first, every time.** Read the split and the bps-vs-oracle figure. Then do a small live test (e.g. 1k USDC) before the full size.
4. **Tune the risk parameters for the market:**
   - `SLIPPAGE_BPS` (default 30) is per leg, measured against a quote taken seconds earlier. Keep it tight. Base has no public mempool, but back-running and fast price moves still happen.
   - `MAX_ORACLE_DEVIATION_BPS` (default 75) is the hard ceiling on total execution cost vs Chainlink. It includes pool fees (1–30 bps).
   - Chainlink ETH/USD has its own deviation threshold and heartbeat, so the oracle can lag a fast market by tens of bps. Don't set this bound tighter than the oracle can reliably meet.
5. **Legs are separate transactions.** A partial fill is possible: leg 1 succeeds and leg 2 reverts on its `minOut`. You'd then hold some WETH and some USDC. The script stops and tells you; re-run for the remaining amount. For atomic all-or-nothing, route through an aggregator or a small custom contract.
6. **USDC is assumed = $1.** The oracle check uses ETH/USD only. In a USDC depeg the check would be wrong; add a USDC/USD feed if that matters to the desk.
7. **Key handling.** `PRIVATE_KEY` from env is for scripts only. For treasury funds, sign with a hardware wallet, KMS, or a Safe multisig. With a Safe you'd propose these same calls instead of sending them. Keep the key out of shell history.
8. **Recipient.** `RECIPIENT` defaults to the sender. Double-check it if you set it: WETH sent to a wrong address is gone.
9. **Leftover allowances.** Approvals are exact and get used up by the swaps. If a leg reverts, its allowance stays in place; revoke it if you don't plan to retry.
10. **Size vs liquidity.** Hundreds of thousands of USDC fills near oracle today. Several million does not (185 bps at 15M). Above ~1–2M, split the order over time or use RFQ/OTC.
11. **Gas.** The account needs ETH on Base for 2 approvals and up to 5 swaps. That's cheap, but it can't be zero.
