# USDC → WETH on Base — desk notes

`swap.ts` sells USDC for WETH on Base mainnet (chain id 8453). It is built for
size: it quotes every liquid USDC/WETH venue on Base before each fill, checks the
result against an independent price oracle, splits or slices the parent order
when that improves the fill, and refuses to send anything it could not simulate.

```bash
npm install
cp .env.example .env        # fill in RPC_URL, PRIVATE_KEY, AMOUNT_USDC

# read-only: quotes, oracle check, and a full eth_call simulation of the swap
DRY_RUN=true  RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=500000 npx tsx swap.ts

# live
DRY_RUN=false RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=500000 SLICES=4 npx tsx swap.ts
```

`DRY_RUN` defaults to `true`. Every knob is an env var; see `.env.example`.

## What the script does

1. **Preflight** — asserts the RPC really is chain 8453, re-reads `symbol()` and
   `decimals()` from the hardcoded token addresses (a wrong-chain RPC or a typo'd
   constant dies here, not after the transfer), checks USDC and gas balances.
2. **Quote every venue** — Uniswap v3 fee tiers 0.01% / 0.05% / 0.30% via
   `QuoterV2`, and Aerodrome Slipstream tick spacings 1 / 50 / 100 / 200 via its
   `QuoterV2`. Nothing about which pool is deepest is hardcoded; the answer moves
   with the market and even between slices of the same order.
3. **Route** — take the best single venue, then grid-search a two-venue split
   (`SPLIT_STEPS`) and keep it only if it beats the single venue by
   `SPLIT_MIN_GAIN_BPS`, since the second leg costs a second transaction and a
   second block of price risk.
4. **Oracle guard** — convert the notional at the Chainlink ETH/USD mid and abort
   if the pools price the trade more than `MAX_ORACLE_DEVIATION_BPS` below it, or
   if the feed is stale. This is the check that stops a manipulated or drained
   pool from quietly eating a large order; `amountOutMinimum` alone would not,
   because it is derived from the same manipulated quote.
5. **Execute** — exact-amount approval, `simulateContract` (real `eth_call`
   against current state) and only then the send, one leg at a time, with the
   fill measured by WETH balance diff rather than trusted from the quote.
6. **Slice** — `SLICES` child orders with `SLICE_DELAY_SECONDS` between them,
   re-quoted from scratch each time so arbitrage can refill the pools in between.

## Venue choice

**Uniswap v3 `SwapRouter02` + Aerodrome Slipstream, quoted against each other on
every fill.** Measured on Base at block 50,153,999, selling 500,000 USDC in one
shot. Chainlink ETH/USD at that block was 1917.80, so a fill at the mid would be
260.72 WETH:

| Venue | Out for 500k USDC | vs mid |
|---|---|---|
| Aerodrome Slipstream, tickSpacing 100 | 260.30 WETH | −0.16% |
| Uniswap v3, 0.30% | 260.19 WETH | −0.20% |
| Uniswap v3, 0.05% | 257.75 WETH | −1.14% |
| Uniswap v3, 0.01% | 81.55 WETH | unusable |
| Uniswap v4 (0.30%/60, via `V4Quoter`) | 64.96 WETH | unusable |
| Uniswap v4 (0.05%/10) | 7.40 WETH | unusable |
| Slipstream tickSpacing 50 / 200 | <1 WETH | unusable |

Two things follow, and they are why the script is built the way it is:

- **The deepest venue is not fixed.** Slipstream ts=100 won the first 250k slice
  in the test run; after that fill moved its price, Uniswap v3 0.30% won the
  second. A script that hardcodes "the USDC/WETH 0.05% pool" — the intuitive
  choice, and the wrong one here — would have paid about 1% more.
- **Uniswap v4 pools on Base are not yet deep enough for this size**, so v4 is
  not wired in. Re-measure before assuming that stays true. Aerodrome's v2-style
  volatile AMM is likewise ignored: Slipstream is where Aerodrome's USDC/WETH
  depth lives.

**Why not an aggregator (0x, 1inch, CoW, Odos)?** For 500k+ they are worth
pricing, and for multi-million clips CoW's batch auction or an RFQ desk will
usually beat any single AMM path. They were not made the default because each one
means an API key, an off-chain dependency in the trade path, and executing
calldata your own code did not construct — for a first treasury tool the
on-chain, fully simulatable path is the one you can audit line by line. The
sensible next step is to add an aggregator as one more "venue" in `VENUES` and
let the same oracle guard and `amountOutMinimum` discipline apply to it.

## Address provenance

Every address in `swap.ts` was verified by reading the contract on Base mainnet,
not copied from a docs page. The right-hand column is the check that proves it —
re-run any of them before you trust this file.

| Constant | Address | Verified by |
|---|---|---|
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol()` → `USDC`, `decimals()` → 6, `name()` → `USD Coin` |
| WETH | `0x4200000000000000000000000000000000000006` | `symbol()` → `WETH`, `decimals()` → 18 |
| Uniswap v3 `SwapRouter02` | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()` → the v3 factory below, `WETH9()` → WETH above |
| Uniswap v3 `QuoterV2` | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | same `factory()` / `WETH9()` |
| Uniswap v3 factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | returns live pools for USDC/WETH at 100/500/3000 |
| Slipstream `SwapRouter` | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `factory()` → the CL factory below |
| Slipstream `QuoterV2` | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | `factory()` → the CL factory below |
| Slipstream CL factory | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` | returns live CL pools for USDC/WETH |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | `description()` → `ETH / USD`, `decimals()` → 8 |

The one that bites people: **`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` is
USDbC**, the old bridged dollar, not the USDC the desk holds. It is named in
`swap.ts` only so nobody "fixes" the real constant into it. Its liquidity is a
fraction of native USDC's and a large order there fills badly.

Contract calls the script actually depends on:

- `QuoterV2.quoteExactInputSingle((tokenIn,tokenOut,amountIn,fee,sqrtPriceLimitX96))`
  and the Slipstream variant, which takes `int24 tickSpacing` in place of `uint24 fee`.
- `SwapRouter02.multicall(uint256 deadline, bytes[] data)` wrapping
  `exactInputSingle((tokenIn,tokenOut,fee,recipient,amountIn,amountOutMinimum,sqrtPriceLimitX96))`.
  SwapRouter02 dropped the deadline field from the params struct; `multicall` is
  how Uniswap reintroduces it, so the swap cannot sit in a mempool and execute later.
- `Slipstream SwapRouter.exactInputSingle((tokenIn,tokenOut,tickSpacing,recipient,deadline,amountIn,amountOutMinimum,sqrtPriceLimitX96))`
  — note the different field order and the `deadline` inside the struct.
- `USDC.approve`, `WETH.balanceOf`, `AggregatorV3.latestRoundData`.

## Before you run this with real funds

**Signing.** The script takes a raw `PRIVATE_KEY` from the environment. That is
fine for a fork test and wrong for a desk moving hundreds of thousands: the key
sits in a shell history, a process list, and a `.env` on disk. Before production,
swap `privateKeyToAccount` for a KMS/HSM signer, or propose the two transactions
to a Safe and let the desk's signers approve them. Nothing else in the file
changes — only the `account` passed to `createWalletClient`.

**Rehearse on a fork.** `anvil --fork-url <base rpc> --fork-block-number <head>`,
fund the account, and run with `DRY_RUN=false` against the fork first. That is
how this script was validated: 500,000 USDC in 2 × 250,000 slices filled at
1920.68 USDC/WETH, 0.15% below the Chainlink mid, routing to Slipstream and then
to Uniswap v3 as the first fill moved the book.

**Parameters.** `MAX_SLIPPAGE_BPS` (default 30 = 0.30%) is per leg, against a
quote taken seconds earlier — it is protection against movement between quote and
inclusion, not a budget for price impact. Impact is already inside the quote.
`MAX_ORACLE_DEVIATION_BPS` (default 100 = 1%) is the real circuit breaker; it
must be wide enough to cover genuine fees plus impact at your size (measure with
`DRY_RUN=true`) and tight enough to stop a manipulated pool. If a dry run at your
size shows the route 0.9% below mid, do not simply raise the limit — split the
order further with `SLICES`.

**Sizing and slicing.** At 500k the on-chain cost was about 15 bps, so slicing
gains little and mostly buys optionality. As size grows, impact grows faster than
linearly: dry-run 1M, 2M, 5M and read the "below mid" number before committing.
For genuinely large clips, run `SLICES` over hours rather than minutes, or take
the order off-chain.

**Approvals.** Each leg approves exactly what it needs and the swap consumes it,
so no standing allowance is left behind. Keep it that way — do not "optimize" it
into an infinite approval to save 50k gas.

**Recipient.** The output is **WETH**, not ETH, and it goes to `RECIPIENT` (the
signer by default). If the desk wants native ETH, add a `WETH.withdraw` step;
verify the receiving address is one the desk controls on Base specifically.

**Gas.** Fees are paid in ETH on Base, not USDC. `MIN_GAS_ETH` refuses to start
without a buffer; a swap here costs ~130k–210k gas.

**If a send times out.** `awaitReceipt` reports the hash and tells you not to
re-run. Honour that: a "timed out" transaction is usually still in flight (this
happened during fork testing — the transaction landed a minute later), and
re-running would sell the slice twice. Check the hash, then resume with the
remaining amount.

**RPC quality matters.** Deep tick-crossing quotes are slow; the transport uses a
60s timeout and the script treats an RPC failure during quoting as **fatal**
rather than silently dropping that venue — a dropped venue is how an order ends
up in a worse pool. Use a paid endpoint; a rate-limited public one turns routing
into a coin flip.

**MEV.** Base's sequencer does not currently expose a public pending-transaction
mempool, so classic sandwiching is limited today — but that is an operator policy,
not a guarantee, and JIT liquidity and backrunning still exist. `amountOutMinimum`
plus the deadline is the actual protection. Do not widen slippage "to make it go
through".

**Token risk.** USDC on Base is upgradeable and its issuer can freeze addresses;
the swap will simply revert if the signer or recipient is blacklisted. WETH is a
fixed, non-upgradeable predeploy.

## Known limits

- Single-hop USDC→WETH only. No multi-hop route (e.g. via cbBTC) is considered;
  at current depth it does not help, but it is the first thing to add if a
  future market makes intermediate hops attractive.
- The split search covers the best two venues, in `SPLIT_STEPS` increments, and
  assumes both quotes hold while the two transactions land in sequence.
- Legs execute sequentially, not atomically. If the second leg fails, the first
  has already filled; the script stops and reports what filled.
- No aggregator / RFQ integration, no private-orderflow endpoint, no scheduled
  execution beyond the in-process slice loop. Those are the natural next steps
  if the desk's clip sizes grow.
