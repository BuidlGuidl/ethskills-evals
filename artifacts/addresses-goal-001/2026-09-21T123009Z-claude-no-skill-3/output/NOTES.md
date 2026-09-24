# USDC → WETH on Base: treasury swap tool

## TL;DR

```bash
npm install
# dry run: quotes, split plan, oracle check. Sends nothing.
RPC_URL=https://<your-base-rpc> PRIVATE_KEY=0x... AMOUNT_USDC=250000 npm run swap
# live
EXECUTE=1 RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 npm run swap
```

Optional env: `SLIPPAGE_BPS` (default 30), `MAX_ORACLE_DEVIATION_BPS` (100), `SLICES` (20),
`DEADLINE_S` (120), `RECIPIENT` (defaults to signer), `MAX_ORACLE_AGE_S`, `SEQUENCER_GRACE_S`.

## Venue: split across Uniswap v3 and Aerodrome Slipstream

On Base, USDC/WETH liquidity is spread over two venues and several pools per venue.
No single pool is always best. Measured on-chain while building this (Sept 2026, Chainlink ETH ≈ $2,720):

| pool | 1k USDC | 100k USDC | 300k USDC | 1M USDC |
|---|---|---|---|---|
| Uniswap v3 0.05% | 2726.8 | 2732.5 | 2747.9 | 2818.9 |
| Uniswap v3 0.30% | 2733.2 | 2733.4 | 2733.9 | **2735.5** |
| Aerodrome CL ts=100 | **2726.9** | **2727.9** | **2732.8** | 2850.8 |
| Uniswap v3 0.01% | 2728.8 | 3337 | 7591 | 25297 |
| Aerodrome CL ts=1 | 2750.3 | 3480 | 6247 | 20824 |

(USDC paid per WETH, lower is better. The spot price had moved by the time of the fork tests below.)

What this shows:
- The best pool depends on order size. Small orders do best in the low-fee pools; large orders
  do best in the 0.3% pool because most of the liquidity sits there.
- **Thin pools will wreck a large order.** A 300k order sent to the 1bp Uniswap pool pays about 2.8×
  the market price, because it drains the pool's liquidity range. A script with a hardcoded fee tier
  will lose most of the trade if that pool thins out.

So the script:
1. **Quotes every USDC/WETH pool on both venues** with the official on-chain quoters.
2. **Splits the order greedily.** It hands out the order in `SLICES` equal pieces. Each piece goes to
   the pool that gives the most extra WETH for it. Pool output curves flatten as size grows, so this
   gets close to the best split, and thin pools never get anything.
3. **Checks against Chainlink ETH/USD**, and first checks the Base sequencer-uptime feed and that the
   price isn't stale. It aborts if the average execution price is more than `MAX_ORACLE_DEVIATION_BPS`
   worse than the oracle. This catches a broken quote, a manipulated pool, or an order that is simply too big.
4. **Approves exact amounts**, one approval per router (no unlimited approvals), then **re-quotes** so
   the minimum-output limits are based on fresh prices.
5. Builds **one transaction per router**. All Uniswap legs are batched in `multicall(deadline, bytes[])`.
   All Aerodrome legs go in `multicall(bytes[])`, with the deadline set in each leg.
   Each leg has its own `amountOutMinimum = freshQuote × (1 − SLIPPAGE_BPS)`.
6. **Runs `estimateGas` on every transaction before sending any of them.** Then sends them back to back
   with fixed nonces, waits for receipts, and reports the WETH actually received.

Tested on an anvil fork of Base mainnet: 300k USDC split 2 ways, and 700k USDC split 3 ways
(two Uniswap legs in one multicall plus one Aerodrome leg). Both filled completely and matched
the quotes. Execution was 6–23 bps from the (lagging) oracle.

### Why not an aggregator (0x / 1inch / KyberSwap / Odos)?

An aggregator can reach more liquidity (other pools, Uniswap v4 hooks pools, RFQ market makers) and
does a split like this one in a **single atomic transaction**. At desk sizes it is worth comparing
against. It was left out here for three reasons: it needs an API key and trust in a third party's calldata,
it can't be checked fully on-chain, and the task asked for explicit contracts. If you add one, keep
steps 3 (oracle check) and 6 (simulate first) and set your own `minOut`. Never accept theirs as is.

## Addresses (Base mainnet, chainId 8453)

All were checked on-chain: contract code exists, each router and quoter's `factory()` / `WETH9()` match,
and the token `decimals()` are as listed.

| what | address |
|---|---|
| USDC (native Circle, 6 dp) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH (OP-stack predeploy, 18 dp) | `0x4200000000000000000000000000000000000006` |
| Uniswap v3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| Uniswap v3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| Uniswap v3 Factory (reference) | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` |
| Aerodrome Slipstream Quoter | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` |
| Aerodrome Slipstream Factory (reference) | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |
| Chainlink L2 sequencer uptime | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` |

Contract calls used: `QuoterV2.quoteExactInputSingle`, `SlipstreamQuoter.quoteExactInputSingle`
(both through `eth_call`), `SwapRouter02.multicall(uint256,bytes[])` → `exactInputSingle`,
`SlipstreamRouter.multicall(bytes[])` → `exactInputSingle`, `USDC.approve/allowance/balanceOf`,
`Aggregator.latestRoundData`.

## What the developer must get right before using real funds

1. **Use the right USDC.** Use `0x8335…2913` (native USDC). Do not use USDbC (`0xd9aA…6CA`, the old
   bridged version), which is a different token with its own pools. Check the desk wallet actually holds native USDC.
2. **Protect the key.** A raw `PRIVATE_KEY` in an env var is fine for a fork test. It is not acceptable
   for a treasury wallet. Swap `privateKeyToAccount` for a hardware wallet, KMS/HSM, or a Safe
   (send the same calldata as Safe transactions). The code only needs a viem `Account`.
3. **Use a private, reliable RPC.** Public endpoints rate-limit quoting (`mainnet.base.org` failed during
   development) and may serve stale state. Use a paid provider. The quotes, the oracle read, and the send
   should all go through the same node.
4. **Always dry-run first.** Check the split, the average price, and the oracle deviation. Then set `EXECUTE=1`.
   Better still, run the exact size on an anvil fork first:
   `anvil --fork-url $RPC_URL`, give yourself USDC (set storage slot 9 of the USDC contract), and run against `http://127.0.0.1:8545`.
5. **Set slippage and deviation on purpose.**
   - `SLIPPAGE_BPS` protects each leg against price moves *after* the quote. 30 bps is fairly tight.
     Base blocks come every 2s (with Flashblocks, ~200ms), so a bad fill turns into a revert rather than
     a loss. If legs revert often, raise it a little. Don't raise it to 100+ "just to make it go through".
   - `MAX_ORACLE_DEVIATION_BPS` caps the total cost versus a price nobody can manipulate. Chainlink moves
     only after a ~0.15% price change or its heartbeat, so it can lag spot by ~20–40 bps (we saw ~35 bps).
     Don't set it below ~50 bps.
6. **Size is the biggest lever.** Up to ~300k clears within about 10 bps of oracle. At about 1M, price
   impact climbs quickly. For large tickets, **split over time** (e.g. 5 × 200k a few minutes apart, so
   arbitrageurs refill the pools). If the oracle check trips, it is telling you to do this.
7. **The two router transactions are not atomic.** Each leg is protected by its own `minOut`, so a bad
   price means a revert, not a loss. But one router can fill while the other reverts. The script then
   reports a partial fill and exits with code 1. Re-run it for the remainder: it re-plans from fresh
   quotes and your USDC balance. If you need all-or-nothing, use an aggregator or a small executor contract.
8. **Approvals.** The script approves exactly the amount each router needs. If a run dies after
   approving, the leftover allowance stays. It is limited to that run's amount, but check and revoke
   stale allowances on the treasury wallet.
9. **Recipient.** `RECIPIENT` defaults to the signer. If you set it, check it twice: every leg pays it directly.
10. **Pools change.** The pool list covers every USDC/WETH fee tier and tick spacing that exists today
    on both venues. Missing or empty pools are handled (quote → 0 → never used). If liquidity moves to a
    new venue (e.g. Uniswap v4), this script won't see it. Compare against an aggregator quote now and then.
11. **Gas.** Base gas is cheap. Gas is estimated after approvals, with a 20% buffer. The signer needs a little ETH.
