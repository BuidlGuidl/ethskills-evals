# USDC → WETH on Base — approach, venue choice, and pre-flight

`swap.ts` swaps native USDC into WETH on Base mainnet (chain 8453) with viem.
It is written for desk-size clips (10^5 USDC and up), so it treats routing and
slippage as the product, not the plumbing.

## Approach

The script does not trust its own address table. On every run, before anything
can move funds, it:

1. **Checks identity, not just presence.** Asserts `eth_chainId == 8453`, that
   USDC/WETH answer `symbol()`/`decimals()` as expected, and that every router
   and quoter reports the factory it is supposed to belong to
   (`router.factory()`, `quoter.factory()`, `router.WETH9()`). A mismatched
   address fails here rather than at a bad fill.
2. **Derives pools from the verified factories.** No pool address is hardcoded.
   `factory.getPool(USDC, WETH, fee|tickSpacing)` gives the pool; the pool's own
   `token0`/`token1` and `fee`/`tickSpacing` are then asserted against what was
   asked for.
3. **Quotes every candidate pool at the real clip size**, prints the full table
   with basis points against a reference rate, and routes to the numbers.
4. **Measures price impact** by quoting a small 1,000 USDC probe on the same
   pools. Both quotes are fee-inclusive, so the difference is impact, not fee.
   `MAX_IMPACT_BPS` (default 50) aborts the run if the clip is too big for
   today's liquidity.
5. **Searches for a two-way split** across the best two pools (ternary search on
   a 1% grid — the output curve is concave, so ~12 quote pairs find the max) and
   uses it only if it beats the single best route by `MIN_SPLIT_GAIN_BPS`.
6. **Re-quotes immediately before each transaction**, aborts if the price moved
   more than `SLIPPAGE_BPS` against us since planning, and sends with
   `amountOutMinimum` derived from that fresh quote plus a deadline.
7. Reports the realised fill: WETH received, USDC/WETH rate, bps vs the probe.

`DRY_RUN=true` (the default) does all of the above and sends nothing.

## Venue: Aerodrome Slipstream, with Uniswap v3 quoted alongside it every run

Measurements below are one 500,000 USDC clip, all quoted in the same block
(Base 50,145,659, 2026-08-18) through each venue's own quoter. "bps" is against
the fee-inclusive rate from a 1,000 USDC probe.

| venue / pool | WETH out | vs probe |
|---|---:|---:|
| Aerodrome Slipstream `ts=100` `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | 261.1276 | −5.8 bps |
| Aerodrome Slipstream `ts=50` (gauges-v3) `0x3FE04A59Ebd38cF06080a6F60a98D124eb59392A` | 261.0642 | −8.3 bps |
| Uniswap v3 `fee=3000` `0x6c561B446416E1A00E8E93E221854d6eA4171372` | 260.1616 | −42.8 bps |
| Uniswap v3 `fee=500` `0xd0b53D9277642d899DF5C87A3966A349A798F224` | 258.6000 | −102.6 bps |
| Aerodrome v2 vAMM `0xcDAC0d6c6C59727a65F871236188350531885C43` | 230.1699 | −1190.7 bps |
| Uniswap v4 `fee=3000/ts=60` (PoolManager `0x4985…2b2b`) | 64.9398 | −7514.6 bps |
| Uniswap v4 `fee=500/ts=10` | 7.7089 | −9705.0 bps |

Best split in that block: 50% / 50% across the two Slipstream pools → 261.2020
WETH, **+2.9 bps** over the best single route (~$140 on a 500k clip). At 1,000,000
USDC the same search gave +5.0 bps. The script re-derives this each run.

Three things this table is meant to settle:

- **Aerodrome's v2-style `Router` cannot reach Slipstream.** Slipstream is a
  separate concentrated-liquidity deployment with its own factory, router and
  quoter, keyed by `tickSpacing` instead of `fee`. Routing "Aerodrome" through
  the familiar `Router` at `0xcF77a3Ba…` costs about 1,190 bps at this size —
  roughly $60k on a 500k clip — with a completely genuine address and a
  transaction that succeeds. The vAMM pool is quoted on every run as a control.
- **Slipstream has three live deployments.** Aerodrome's repo lists the
  *initial* deployment, a *gauge-caps* deployment, and *gauges-v3* as current.
  New gauges come from gauges-v3, but the older pools stay live and keep
  trading: today the single deepest USDC/WETH pool is still the initial
  deployment's `ts=100`, with gauges-v3 `ts=50` a few bps behind, and the two
  together beat either alone. The script quotes all three factories, so it does
  not matter which one is "current" when you run it.
- **Uniswap v4 is not a contender for this pair on Base right now** — its
  USDC/WETH pools are thin enough that a desk clip would be destroyed there.
  Uniswap v3 `fee=3000` is a real backup (~35–45 bps) and the script will route
  to it automatically if the Aerodrome pools move.

No aggregator is used. A 1inch/0x/Odos quote is a legitimate alternative and
will sometimes beat this by splitting into pools we do not quote, but it adds a
third-party API, an approval to their router, and calldata you cannot audit at
send time. Two direct venues quoted honestly at clip size is the tighter tool
for a treasury desk; if you want an aggregator, quote it against this script's
table before switching, not instead of it.

## Addresses in `swap.ts`

Every address below was verified on Base mainnet on **2026-08-18** by reading
code and identity from the chain (`symbol()`, `factory()`, `WETH9()`,
`voter() → ve() → token() == AERO`), and cross-checked against the protocols'
own deployment lists. The script re-checks all of it at runtime.

| what | address |
|---|---|
| USDC (native, Circle, 6dp) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH (canonical Base, 18dp) | `0x4200000000000000000000000000000000000006` |
| Slipstream initial: factory / router / quoter | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` / `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` / `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` |
| Slipstream gauge-caps: factory / router / quoter | `0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a` / `0xcbBb8035cAc7D4B3Ca7aBb74cF7BdF900215Ce0D` / `0x3d4C22254F86f64B7eC90ab8F7aeC1FBFD271c6C` |
| Slipstream gauges-v3 (current): factory / router / quoter | `0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef` / `0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F` / `0x514c8B5f54112481E28028F1166Bd78501089259` |
| Uniswap v3: factory / SwapRouter02 / QuoterV2 | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` / `0x2626664c2603336E57B271c5C0b26F421741e481` / `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| Aerodrome v2 (control quote): factory / Router | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` / `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |

Deliberately **not** used: `USDbC` `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`
(bridged USDC, same ticker in most UIs, ~$5.7M supply against native USDC's
~$4.2B, thin pools). If a counterparty sends you USDbC, this script will not
swap it.

## Before you run this with real funds

The person running this did not watch anyone verify these addresses. Do these
first.

1. **Re-verify the addresses on Base yourself.** Deployments move; this file is
   a snapshot of 2026-08-18.
   ```bash
   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url $RPC_URL   # USDC
   cast call 0x698Cb2b6dd822994581fEa6eA4Fc755d1363A92F "factory()(address)" --rpc-url $RPC_URL # → 0xf8f2eB…
   ```
   and settle them against Aerodrome's `slipstream` repo deployment table and
   Uniswap's deployments docs, not against this file. If Aerodrome ships a
   fourth Slipstream deployment, add its factory/router/quoter to `CL_VENUES` —
   otherwise the script will quietly keep routing to the older pools.
2. **Confirm the token is the one your desk holds.** Native USDC, not USDbC.
3. **Use a private/paid RPC.** The default `https://mainnet.base.org` rate-limited
   the quote pass into failure during testing; a dropped quote is a worse route,
   not an error.
   Any route that fails to quote is printed with `!` — read those lines.
4. **Dry-run first, on the same RPC**: `DRY_RUN=true AMOUNT_USDC=250000 npx tsx swap.ts`.
   Sanity-check the resulting USDC/WETH rate against an independent price
   source before executing. A quote is not a price feed; if the whole venue set
   is mispriced, the script has nothing to compare against.
5. **Size the clip.** 500k in one shot cost ~6–14 bps of impact in testing; the
   `MAX_IMPACT_BPS` guard (default 50) is the backstop, not the plan. For
   multi-million positions, run the script repeatedly in clips spaced over
   minutes, and watch whether impact per clip degrades — that means you are
   ahead of the arbitrage that refills the pools.
6. **Set `SLIPPAGE_BPS` deliberately** (default 20). It bounds the gap between
   the re-quote and the fill; too tight fails in volatility, too loose is a gift
   to whoever reorders you. Base is a single-sequencer FCFS chain with no public
   mempool auction, so this is exposure to price movement more than to
   sandwiching — but `amountOutMinimum` and `DEADLINE_SECONDS` (default 120) are
   what actually protect the fill.
7. **Approvals.** The script approves exactly the leg amount to the router it is
   about to use, per leg. It never approves `type(uint256).max`. If you change
   this, note that a split trade approves two different routers.
8. **Key handling and recipient.** `PRIVATE_KEY` is read from the environment —
   use a hot key funded with only the clip plus gas, or replace
   `privateKeyToAccount` with your signer/HSM. Set `RECIPIENT` if the WETH
   should land somewhere other than the sender (verify it holds/expects WETH,
   the script does not).
9. **Hold some ETH on Base for gas.** A leg costs ~130k–250k gas.
10. **Watch the two-transaction case.** A split executes as two sequential
    transactions; between them the market can move. Each leg is independently
    re-quoted and bounded, so the risk is a partial fill (leg 1 done, leg 2
    aborted), not a bad fill. Decide in advance what your desk does with a
    half-filled clip, or run with `ALLOW_SPLIT=false`.

## Configuration

`RPC_URL`, `PRIVATE_KEY`, `AMOUNT_USDC`, `SLIPPAGE_BPS` (20), `MAX_IMPACT_BPS`
(50), `DEADLINE_SECONDS` (120), `DRY_RUN` (true), `ALLOW_SPLIT` (true),
`MIN_SPLIT_GAIN_BPS` (3), `RECIPIENT`, `FORCE_ROUTE` (substring of a route
label, e.g. `FORCE_ROUTE="uniswap-v3 fee=3000"`, to override the router choice).
See `.env.example`.

## What was tested

Against a fork of Base mainnet (`anvil --fork-url … --fork-block-number
50146456`), with an account funded with 500k USDC:

- Identity checks, discovery of 16 USDC/WETH pools, and full-size quoting.
- A 500,000 USDC clip executed as a 69/31 split across Slipstream `ts=100` and
  gauges-v3 `ts=50`: **260.969 WETH received, −9.9 bps vs the probe rate**, both
  legs mined (208k and 246k gas).
- The Uniswap v3 path (`SwapRouter02.multicall(deadline, [exactInputSingle])`)
  and the Aerodrome v2 path (`swapExactTokensForTokens`) each executed via
  `FORCE_ROUTE`.
- The impact guard aborting the run when `MAX_IMPACT_BPS` is exceeded.

Against **live Base mainnet**, a 250,000 USDC dry run quoted all 16 pools and
planned a single leg through Slipstream gauges-v3 `ts=50` at 3.0 bps of impact
(130.638 WETH). No transaction was sent.

Not tested: a live mainnet transaction. Execution evidence above is from the
fork, against real Base state.

## Limitations

- Single-hop only. Multi-hop routes (e.g. USDC → cbBTC → WETH) and >2-way
  splits are not searched.
- Quotes come from the venues' own quoters at the head block; they are a
  simulation, not a commitment.
- Gas cost is not part of the route comparison (a few cents on Base against
  basis points on a six-figure clip).
- Exact-input only; there is no exact-output mode.
