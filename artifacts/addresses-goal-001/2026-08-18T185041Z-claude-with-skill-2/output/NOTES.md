# USDC → WETH on Base — desk swap tool

`swap.ts` sells native USDC for WETH on Base mainnet through the **Aerodrome
Slipstream** concentrated-liquidity USDC/WETH pool at `tickSpacing 100`.

```bash
npm install
cp .env.example .env          # set RPC_URL and PRIVATE_KEY

npx tsx swap.ts verify        # identity-check every address against Base
npx tsx swap.ts quote         # price the configured size on every candidate venue
npx tsx swap.ts swap          # DRY_RUN=true by default; DRY_RUN=false to broadcast
```

---

## Venue choice

The decision was made from **quotes at the desk's actual clip size**, not from
reputation or chain-level TVL. Depth for one pair at 500k is the only metric
that decides execution quality here.

Measured on Base mainnet, 2026-08-18, 500,000 USDC → WETH, via each venue's own
quoter (block ~50,145,358):

| Venue | Out (WETH) | vs best |
|---|---|---|
| **Aerodrome Slipstream, ts=100** | **260.902** | **best** |
| Uniswap v3, fee=3000 | 260.162 | −28 bps |
| Uniswap v3, fee=500 | 258.280 | −100 bps |
| Uniswap v3, fee=100 | 85.044 | −6,741 bps |
| Uniswap v4 (best of fee 500/3000) | 64.940 | −7,511 bps |
| Aerodrome **v2 Router** (vAMM) | 230.180 | −1,177 bps |
| Aerodrome **v2 Router** (sAMM) | 2.887 | −9,889 bps |

Slipstream wins because its ts=100 pool runs a **dynamic swap fee** — observed
between 3.2 and 6.0 bps during testing, against Uniswap's static 30 bps and
5 bps tiers — with enough concentrated depth to absorb the clip. Full-size price
impact for a 500k clip is **5–12 bps** depending on the block.

Three traps this table rules out, all of which are live contracts that answer
`symbol()` correctly and do not revert:

- **Aerodrome's v2 Router is not Slipstream's router.** Different deployment,
  different pool type; the v2 `Router` cannot reach CL pools at all. Routing
  500k through it costs ~11.8% — about **$57,000** on this clip. Both addresses
  are genuine Aerodrome, both calls succeed. `swap.ts` prices it every run and
  labels it *not routable*, so the gap is visible rather than assumed.
- **Uniswap v3's 1 bp pool has the best marginal price and almost no depth.**
  It quotes best on 1,000 USDC and loses 68% of a 500k clip. Picking a fee tier
  by quoting small and scaling up is exactly the wrong method at desk size.
- **Uniswap v4 is deployed on Base but thin for this pair.** Deployment ≠ depth.

### Where this stops being true

Slipstream held the lead across every size tested up to 3.2M USDC, by 18–28 bps.
At one block a 3M quote flipped to Uniswap v3 fee=3000 and reverted a block
later — the ranking is block-dependent and can flip transiently.

That is precisely why the route is not treated as settled in code: before every
trade, `swap.ts` re-prices all venues at the real size and **aborts** if any
alternative beats the configured route by more than `CROSS_VENUE_TOLERANCE_BPS`
(default 10). If it aborts, re-run `quote`, and execute on the better venue
deliberately. Uniswap's `SwapRouter02` (`0x2626664c…e481`) is in `swap.ts` as
the documented fallback but is intentionally **not** wired to auto-route — the
desk should not silently change venue mid-order.

### Splitting the order — measured, and it does not help back-to-back

A/B on identical forked state, 500k USDC:

| Execution | Received | Gas |
|---|---|---|
| 1 clip of 500k | 260.8367 WETH | 254,772 |
| 5 clips of 100k, back-to-back | 260.8258 WETH | ~1,246,000 |

Splitting was **worse** (−0.4 bps) and cost 5× the gas. Consecutive clips hit a
pool that has not recovered, and Slipstream's dynamic fee ratchets *up* with
volume (3.19 → 6.03 bps across a test sequence). A grid search over splitting
500k across Slipstream + both Uniswap tiers gained ~1 bp — inside quote noise.

`CLIPS` exists for orders large enough to need working over time. It only helps
if clips are **spaced far enough apart for arbitrage to restore the pool** —
minutes, not blocks. At 500k, use `CLIPS=1`.

---

## Addresses

All verified on Base mainnet (chainId 8453) on 2026-08-18: code present,
identity confirmed by contract calls, and cross-checked against the protocol's
own deployment list.

| Role | Address | Confirmed by |
|---|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `symbol()`=USDC, `decimals()`=6 |
| WETH | `0x4200000000000000000000000000000000000006` | `symbol()`=WETH, `decimals()`=18 |
| Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `factory()`→CLFactory, `WETH9()`→WETH; `aerodrome-finance/docs`, `content/security.mdx` |
| Slipstream Quoter | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | `factory()`→CLFactory; `aerodrome-finance/slipstream`, `DeployCL-Base.json` |
| Slipstream PoolFactory | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` | `DeployCL-Base.json` (`PoolFactory`) |
| USDC/WETH CL pool, ts=100 | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | resolved via `CLFactory.getPool(WETH, USDC, 100)` |
| Uniswap v3 QuoterV2 (cross-check) | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `factory()`→`0x33128a8f…FDfD` |
| Uniswap SwapRouter02 (fallback, unused) | `0x2626664c2603336E57B271c5C0b26F421741e481` | `factory()`→`0x33128a8f…FDfD`, `WETH9()`→WETH |
| Aerodrome v2 Router (**do not route**) | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | `defaultFactory()`→`0x420DD381…40Da` |

**USDC is the Circle-native token, not bridged USDbC** (`0xd9aAEc86…b6CA`,
`symbol()`=USDbC). Different address, different liquidity, and most UIs show
both as "USDC". `swap.ts` carries the USDbC address purely as a named negative
so nobody "corrects" the constant into it.

These addresses are **Base only**. Do not copy them to another chain — Aerodrome
does not exist outside Base (Velodrome is the Optimism deployment, at different
addresses), and Uniswap's non-v3 deployments differ per chain.

---

## Before you run this with real funds

The tool re-verifies what it can, but these are on you:

1. **Re-check the addresses yourself.** The table above is dated. Run
   `npx tsx swap.ts verify` — it checks chainId, code presence, token
   symbol/decimals, that router and quoter share the Slipstream factory, and
   that the pool comes from that factory with the right pair and tickSpacing.
   It aborts on any mismatch, before any approval. Then settle the router and
   quoter against Aerodrome's current published list; a deprecated deployment
   stays live and keeps answering correctly.
2. **Use a dedicated RPC.** The default `https://mainnet.base.org` rate-limits
   hard. A throttled read during verification is not a verified address, and a
   throttled quote right before a 500k trade is worse. Point `RPC_URL` at a
   paid endpoint.
3. **Set `MAX_SLIPPAGE_BPS` deliberately.** Default 30. It sets
   `amountOutMinimum`, the only thing standing between you and a bad fill — the
   swap reverts rather than filling below it. Too tight reverts on normal drift;
   too loose is an open invitation. At 500k, 30 bps ≈ 0.78 WETH of tolerance.
4. **`DRY_RUN` defaults to `true`.** It must be explicitly `false` to broadcast.
   Run `quote` and a dry `swap` first and read the impact line.
5. **Fund gas and know the account.** The signer needs ETH on Base. The script
   approves the **exact** clip total (never unlimited) and revokes any residual
   allowance afterwards.
6. **`PRIVATE_KEY` in an env var is the weakest link here.** It is fine for a
   test wallet and wrong for a treasury. For real desk size, move signing behind
   a hardware wallet or a Safe — `swap.ts` builds the calldata; swap
   `walletClient.writeContract` for proposing the transaction to your signer.
7. **MEV.** Base runs a single sequencer with no public mempool today, so
   sandwiching is far less likely than on L1 — but that is an operational
   property of the sequencer, not a guarantee. `amountOutMinimum` and the
   120-second `deadline` are the actual protection.
8. **The quoters are not views.** Both Slipstream's and Uniswap's
   `quoteExactInputSingle` mutate state and revert to return data; `swap.ts`
   calls them via `simulateContract`. Never wire them as `view` reads.
9. **Confirm the size is still in range for one clip.** If `quote` shows impact
   near `MAX_IMPACT_BPS` (default 60) the script aborts rather than trading.
   That is the signal to work the order, not to raise the limit.

## Verification performed

- Every address above: `getCode` + identity call on Base mainnet.
- Slipstream router `exactInputSingle` selector (`0xa026383e`, the `tickSpacing`
  variant — **not** Uniswap's `fee` variant) confirmed present in the deployed
  bytecode before writing code against it.
- Quotes reproduced identically across three independent RPC providers.
- Full path executed on a Base mainnet fork with a funded account: 500,000 USDC
  → **260.739 WETH**, matching the quote exactly, 256,457 gas. Approval,
  simulate, send, receipt, balance-delta accounting, and allowance revocation
  all exercised. The multi-clip path and both abort guards were triggered
  deliberately and behaved correctly.
