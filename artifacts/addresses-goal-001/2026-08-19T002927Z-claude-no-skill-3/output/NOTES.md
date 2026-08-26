# USDC → WETH on Base — approach, venue choice, and pre-flight checklist

`swap.ts` is a self-contained viem script that routes a USDC → WETH order on Base
mainnet (chain id 8453). It is written for desk-sized clips (10^5 USDC and up),
so it behaves less like a "call the router" snippet and more like a small
execution engine: discover pools, quote them, split, sanity-check, then execute
leg by leg.

```bash
npm install
# dry run — quotes and guards only, no key needed
RPC_URL=https://mainnet.base.org AMOUNT_USDC=250000 npx tsx swap.ts
# live
RPC_URL=<rpc> PRIVATE_KEY=0x… AMOUNT_USDC=250000 npx tsx swap.ts --execute
```

## Addresses used (all Base mainnet, all verified on-chain)

| What | Address | How it was checked |
| --- | --- | --- |
| USDC (native Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol() == "USDC"`, `decimals() == 6` |
| WETH9 | `0x4200000000000000000000000000000000000006` | `symbol() == "WETH"`; canonical OP-stack predeploy |
| Uniswap v3 factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | referenced by both the router and the quoter below |
| Uniswap SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()` → v3 factory, `WETH9()` → WETH |
| Uniswap QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `factory()` → v3 factory |
| Aerodrome Slipstream CLFactory | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` | referenced by the Slipstream router and quoter |
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `factory()` → CLFactory, `WETH9()` → WETH |
| Aerodrome Slipstream QuoterV2 | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | `factory()` → CLFactory |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | `description() == "ETH / USD"`, 8 decimals |

Pool addresses are **not** hardcoded: they come from
`UniswapV3Factory.getPool(USDC, WETH, fee)` and
`CLFactory.getPool(USDC, WETH, tickSpacing)` at run time.

`verifyAddresses()` re-runs the whole right-hand column on every invocation and
aborts before any approval if a single check fails (including "is this RPC
actually chain 8453"). A router or quoter that does not point at the factory it
claims to belong to is the cheapest possible signal that an address is wrong,
and it costs one `eth_call` to check.

## Venue: Aerodrome Slipstream first, Uniswap v3 alongside it — decided per order

For USDC/WETH at desk size on Base today, the two venues that matter are
Aerodrome's concentrated-liquidity AMM (Slipstream) and Uniswap v3. Effective
price (USDC per ETH, lower is better) from the official quoters, all at block
50,155,937, with Chainlink mid at 1913.08:

| Size | Aerodrome CL, spacing 100 | Uniswap 0.05% | Uniswap 0.30% | Uniswap 1.00% |
| --- | --- | --- | --- | --- |
| 10k USDC | **1913.5** | 1914.3 | 1920.9 | 1924.2 |
| 250k USDC | **1914.9** | 1923.4 | 1921.3 | 2224.9 |
| 500k USDC | **1916.3** | 1933.9 | 1921.6 | 4204.8 |

Three things fall out of that table, and they are the whole design rationale:

1. **The Aerodrome CL100 pool is currently the deepest book for this pair on
   Base** — ~15 bps of impact on a 500k clip versus ~107 bps in Uniswap's 0.05% pool. It
   is the venue the script picks today, and it is why Aerodrome is wired in
   alongside Uniswap rather than as an afterthought.
2. **The ranking between pools changes with size.** Uniswap's 0.05% pool beats
   its 0.30% pool at 10k and loses to it at 250k and above, because in-range
   liquidity — not the fee tier — decides who wins at size. Any hardcoded fee
   tier is wrong at some size, and the sizes this desk trades are exactly the
   ones where it flips.
3. **The cost of guessing scales with the clip.** Routing 500k to the "obvious"
   Uniswap 0.05% pool instead of the best venue costs ~92 bps ≈ USD 4.6k on a
   single ticket. That is why the script quotes every live pool at run time
   rather than hardcoding a router — and why it re-checks on every run rather
   than trusting the table above, which will be stale by the time you read it.

The script therefore treats venue selection as an optimization, not a constant:

- discovers all USDC/WETH pools on both factories (fee tiers 100/500/3000/10000,
  tick spacings 1/50/100/200/2000) and drops any with `liquidity() == 0`;
- quotes each at one slice of the order, shortlists the ones within
  `SHORTLIST_TOLERANCE_BPS` (default 500) of the best marginal price, capped at
  `MAX_VENUES`;
- runs a **greedy marginal allocator**: the order is cut into `SPLIT_SLICES`
  (default 10) slices and each slice goes to whichever pool currently offers the
  best marginal output given what it has already been allocated. Because each
  pool's output is concave in its input, that greedy pass is the optimal split at
  that slice granularity;
- executes the split only if it beats the best single pool by at least
  `MIN_SPLIT_GAIN_BPS` (default 2) — otherwise it routes to one pool and pays
  one lot of gas instead of three. At 250k–500k today the Aerodrome CL100 pool
  is deep enough that splitting does *not* win; the allocator discovers that on
  its own rather than being told.

### Venues deliberately not used

- **Aerodrome v2 / Uniswap v2-style constant-product pools.** Orders of this size
  eat them; they never win a slice, and quoting them costs more than they are
  worth.
- **Uniswap v4.** The PoolManager (`0x498581fF718922c3f8e6A244956aF099B2652b2b`)
  is live on Base and USDC/ETH liquidity is migrating there, but pricing it needs
  the v4 quoter plus a full `PoolKey` (including the hook address) per pool, and
  hooked pools need per-hook diligence before a treasury routes size through
  them. Adding v4 means adding another `Venue` kind — the allocator itself does
  not change. Worth doing before this script is used at 7-figure size.
- **Aggregators (0x / 1inch / KyberSwap / Odos) and CoW Protocol.** For a real
  desk these are usually the better answer: they add multi-hop routes (e.g. via
  cbBTC or USDbC), RFQ/PMM inventory, and — with CoW — batch auctions and
  MEV-protected settlement at a signed limit price. They are not used here
  because they turn the script into "trust an off-chain API's calldata", which
  needs its own controls (API key handling, `allowanceTarget` allowlisting,
  simulating returned calldata, quote expiry). The right upgrade path is to add
  an aggregator quote as one more `Venue` and let the same allocator compare it
  against the on-chain pools — keep the on-chain path as the floor, not the
  ceiling.

## Guards between the quote and the money moving

- **Address verification** (above) — aborts before any approval.
- **Price-impact guard.** A 1/1000-size probe quote establishes the marginal
  price; if the routed price is worse than that by more than
  `MAX_PRICE_IMPACT_BPS` (default 100), the script aborts and tells you to work
  the order in clips.
- **Oracle sanity check.** Chainlink ETH/USD must be fresh
  (`MAX_ORACLE_AGE_SEC`, default 3600 — the feed's heartbeat is 20 min) and
  within `MAX_ORACLE_DEVIATION_BPS` (default 200) of the routed price. This is
  what stops the script from trading into a pool whose price has been pushed, or
  from executing against a stale/forked RPC view of the world.
- **Re-quote drift guard.** If a leg's fresh quote is more than
  `MAX_REQUOTE_DRIFT_BPS` (default 50) worse than what the plan assumed, the leg
  is refused instead of executed at the new, worse level — `amountOutMinimum`
  alone would happily follow the market down. The script reports how much of the
  order already filled so you can re-run for the remainder.
- **Fresh quote per leg + `amountOutMinimum`.** The plan may be a few blocks old
  by the time a leg is sent, so each leg is re-quoted immediately before sending
  and `amountOutMinimum` is set from that fresh quote minus `SLIPPAGE_BPS`
  (default 30). This is the only guarantee that actually lives on-chain.
- **Deadline on every leg.** Uniswap's SwapRouter02 has no deadline in
  `ExactInputSingleParams`, so the call is wrapped in
  `multicall(uint256 deadline, bytes[] data)`; Slipstream's router keeps
  `deadline` inside the struct. Both get `DEADLINE_SEC` (default 180).
- **`simulateContract` before `writeContract`.** Every approval and swap is
  simulated against current state; a leg that would revert never gets broadcast,
  and the simulated `amountOut` is printed for comparison with the receipt.
- **Post-trade check.** Realized price is computed from the recipient's actual
  WETH balance delta and compared with the pre-trade expectation.

## Before running this with real funds

1. **Dry run first, and read the route.** No key required; it prints every pool,
   the chosen route, price impact, and the oracle comparison. If the route is a
   pool you do not recognize, stop.
2. **Fork test with the real amount.** This was validated on an anvil fork of
   Base (`anvil --fork-url <base-rpc> --fork-block-number <n>`), funding the test
   account by writing USDC balance slot 9, and executing both router paths.
   Do the same with your amount before your first live clip.
3. **Use the right USDC.** `0x8335…2913` is native Circle USDC. Bridged USDbC
   (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`) is a different, much thinner
   token — sending an order there is a silent 100+ bps mistake.
4. **RPC quality matters more than usual.** Quoting a thin CL pool can cost >20M
   gas in a single `eth_call`; public RPCs that cap `eth_call` gas will return
   "n/a" for those pools (harmless — they are the pools you do not want) but a
   rate-limited RPC will make the quote loop slow enough that the plan goes
   stale. Use a paid endpoint for live execution. `https://mainnet.base.org`
   rate-limits well before this script finishes a 10-slice plan.
5. **Fund gas in ETH on Base**, not WETH: a split route sends one approval plus
   one swap per leg (measured on fork: ~55k gas per approval, 130k–230k per
   swap — cents at Base gas prices, but non-zero).
6. **Approvals.** By default each leg approves exactly what it needs
   (`EXACT_APPROVALS=false` approves the full order once per router instead).
   After a run, confirm no residual allowance to either router; approvals are the
   thing that outlives the trade.
7. **Set `RECIPIENT` deliberately.** WETH is delivered by the router straight to
   `RECIPIENT` (default: the signer). If that is a custody address, make sure it
   can handle ERC-20 WETH — the script does not unwrap to ETH.
8. **Slippage is per leg, not per order.** `SLIPPAGE_BPS` bounds each leg against
   its own fresh quote. If leg 1 fills and leg 2 reverts (deadline, slippage,
   RPC), you are left partially filled: the script stops, reports what filled,
   and leaves the rest in USDC. Re-run for the remainder; do not assume
   all-or-nothing.
9. **MEV on Base.** There is no public mempool in front of the sequencer today,
   so classic sandwiching is not the main risk; price drift between quote and
   inclusion is. That is what `amountOutMinimum` and the short deadline cover.
   Do not broadcast through an untrusted third-party RPC that could hold and
   reorder your transaction, and re-check this assumption if Base's sequencing
   changes.
10. **Work large orders in clips.** Impact is superlinear: on today's book, 250k
    costs ~7 bps against the marginal price and 500k ~15 bps, in the best pool.
    For 7-figure days, run several clips spaced over time (the guards make each
    clip refuse to trade in a dislocated market) rather than one heroic swap, and
    consider CoW/RFQ for the tail.
11. **Key handling.** `PRIVATE_KEY` is read from the environment for
    self-containment. For a treasury, back it with a hardware signer or a Safe +
    relayer and keep the script's role to building and simulating the route.

## Options

All optional; defaults in brackets. CLI: `--execute`, `--amount <human USDC>`.

| Env | Default | Meaning |
| --- | --- | --- |
| `RPC_URL` | `https://mainnet.base.org` | Base mainnet RPC (use a paid one to execute) |
| `PRIVATE_KEY` | — | signer; required only with `--execute` |
| `AMOUNT_USDC` | `1000` | order size in human USDC |
| `RECIPIENT` | signer | who receives the WETH |
| `SLIPPAGE_BPS` | `30` | per-leg tolerance vs the fresh pre-send quote |
| `MAX_PRICE_IMPACT_BPS` | `100` | abort if the route is this much worse than the probe price |
| `MAX_ORACLE_DEVIATION_BPS` | `200` | abort if the route disagrees with Chainlink by this much |
| `MAX_ORACLE_AGE_SEC` | `3600` | abort on a stale ETH/USD round |
| `SPLIT_SLICES` | `10` | allocator granularity |
| `MIN_SPLIT_GAIN_BPS` | `2` | minimum edge required to bother splitting |
| `SHORTLIST_TOLERANCE_BPS` | `500` | how far off the best marginal price a pool may be and still be considered |
| `MAX_VENUES` | `5` | cap on pools the allocator quotes |
| `ONLY_VENUES` | — | whitelist, e.g. `aero-100,uni-500` |
| `MAX_REQUOTE_DRIFT_BPS` | `50` | abort a leg if the market moved this far against the plan |
| `DEADLINE_SEC` | `180` | on-chain deadline per leg |
| `EXACT_APPROVALS` | `true` | approve per leg instead of the full order per router |

## What was actually run

Everything below was executed against an anvil fork of Base mainnet pinned near
block 50,155,400, with the test account funded by writing USDC balance slot 9.

- **Dry run, 500k USDC, live Base RPC** — 9 live pools found, 4 shortlisted,
  routed to `aero-100` at 1916.30 USDC/ETH: 14 bps impact vs probe, 16 bps from
  Chainlink.
- **Execution, 250k USDC on Aerodrome Slipstream (fork)** — approval + swap
  mined, 130.523 WETH received, realized price equal to the quote (0 bps),
  203,750 gas.
- **Execution, 200k USDC split across `uni-3000` + `uni-500` (fork)** — the
  allocator chose 100k/100k for +7 bps over the best single pool; both legs mined
  through `SwapRouter02.multicall(deadline, [exactInputSingle])`, 104.176 WETH
  received, realized price equal to the plan.
- **Guard check** — with `MAX_PRICE_IMPACT_BPS=1` a 300k order aborts before any
  approval, exit code 1.

## Known limitations

- Single-hop USDC → WETH only. No multi-hop routes (USDC → cbBTC → WETH etc.);
  at this pair's depth on Base they rarely win, but an aggregator would check.
- Quotes are sequential `eth_call`s (the quoters are non-view and cannot be
  batched with `multicall3`), so a 10-slice plan over 5 pools is ~60 calls. Lower
  `SPLIT_SLICES` or `MAX_VENUES` on a slow RPC.
- The allocator is greedy at fixed slice granularity — optimal to within one
  slice, not to the last wei.
- Exact-output (`quoteExactOutputSingle` / `exactOutputSingle`) is not wired up;
  the desk's flow here is exact-input.
