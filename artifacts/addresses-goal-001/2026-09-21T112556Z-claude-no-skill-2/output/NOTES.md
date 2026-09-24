# USDC → WETH on Base — notes

## Run

```bash
npm install
# dry run: quotes + split plan + oracle check, sends nothing
RPC_URL=https://<paid-base-rpc> AMOUNT_USDC=250000 npx tsx swap.ts
# real
RPC_URL=... PRIVATE_KEY=0x... AMOUNT_USDC=250000 EXECUTE=true npx tsx swap.ts
```

| env | default | meaning |
|---|---|---|
| `AMOUNT_USDC` | — | amount to sell, whole USDC (`250000` = 250k) |
| `MAX_SLIPPAGE_BPS` | 30 | per leg: `minOut = plannedQuote × (1 − 0.30%)` |
| `MAX_ORACLE_DEVIATION_BPS` | 75 | abort if total quote is worse than Chainlink ETH/USD by more than this (fees + price impact) |
| `SPLITS` | 20 | slice count for the venue split (5% steps) |
| `DEADLINE_SECS` | 120 | tx deadline |
| `ORACLE_MAX_AGE_SECS` | 3600 | reject a stale Chainlink price |
| `RECIPIENT` | signer | who receives the WETH |
| `EXECUTE` | false | must be `true` to send transactions |

## Approach

1. **Safety checks.** Chain id must be 8453. Every hardcoded address must have contract code. The Chainlink Base sequencer-uptime feed must say "up" and the sequencer must have been up for more than 1h.
2. **Quote every USDC/WETH pool** on the two venues that hold most of Base's USDC/WETH liquidity. All quotes go through Multicall3 in one RPC round trip:
   - Uniswap v3, fee tiers 0.01 / 0.05 / 0.3 / 1% (quoted with QuoterV2)
   - Aerodrome Slipstream (concentrated liquidity), tick spacings 1 / 10 / 50 / 100 / 200 (quoted with Slipstream QuoterV2)
   - Aerodrome classic volatile pool (quoted with `Router.getAmountsOut`)
3. **Greedy split.** The order is cut into `SPLITS` slices. Each slice goes to the pool whose output grows the most by taking it (the best *marginal* price). Price impact grows with size, so for large orders this lands close to the best possible split across pools. Pools that can't fill even one slice at a price within 2% of the best are dropped.
4. **Oracle guard.** The total planned output is compared with what Chainlink ETH/USD says the USDC is worth. If execution would cost more than `MAX_ORACLE_DEVIATION_BPS`, nothing is sent. This catches a manipulated or drained pool, a bad quote, or an order too big for current liquidity.
5. **Execution.** For each router the script approves the **exact** amount it needs (never unlimited). Then it sends one swap tx per leg, largest leg first. Each leg's calldata is simulated with `eth_call` and gas-estimated before sending. Each tx has `amountOutMinimum` and a deadline, and the script waits for its receipt. At the end it prints the WETH actually received, measured as the recipient's balance change.

### Contracts and calls used

| what | address | call |
|---|---|---|
| USDC (native Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `balanceOf`, `allowance`, `approve` |
| WETH | `0x4200000000000000000000000000000000000006` | `balanceOf` |
| Uniswap v3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | `multicall(deadline, [exactInputSingle(...)])` |
| Uniswap v3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | `quoteExactInputSingle` |
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | `exactInputSingle(... tickSpacing, deadline ...)` |
| Aerodrome Slipstream QuoterV2 | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` | `quoteExactInputSingle` |
| Aerodrome Router (classic) | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | `getAmountsOut`, `swapExactTokensForTokens` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | used in the route struct |
| Chainlink ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | `latestRoundData`, `decimals` |
| Chainlink sequencer uptime | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` | `latestRoundData` |

How these were checked on Base mainnet: the Uniswap addresses match `@uniswap/sdk-core`. Each router/quoter's `factory()` points to the expected factory, and each has `WETH9() == 0x4200…0006`. The pools exist in both factories. Token symbols and decimals were read from chain.

## Why these venues

For USDC/WETH on Base, the deep liquidity is in **Aerodrome Slipstream** and **Uniswap v3**. Snapshot from 2026-09-21, selling 250k USDC:

| pool | WETH out |
|---|---|
| Aero CL ts=100 | 91.742 |
| Uni v3 0.3% | 91.718 |
| Uni v3 0.05% | 91.238 |
| Aero classic | 86.95 (~5% worse) |

The whole 250k cost about **9–13 bps vs Chainlink**, fees included. Which pool is best changes block by block. That is why the script quotes all of them on every run instead of hardcoding one; on some runs it split across 3 pools. Talking directly to the contracts gives the desk full, auditable control of calldata and `minOut`, with no API key or third-party contract in the approval path.

**What this doesn't cover (read before scaling up):**
- **Uniswap v4** (native-ETH/USDC pools) and smaller venues (PancakeSwap v3, SushiSwap, Balancer, etc.) are not quoted. Sometimes they have meaningful depth.
- **Aggregators** (0x, 1inch, Odos, KyberSwap, CoW) route across all of the above, often atomically in a single tx. At seven-figure sizes they will usually beat this script by a few bps. The natural upgrade: get an aggregator quote and run it through the same oracle and `minOut` checks, then keep this script as the direct-to-pool fallback and a benchmark.
- **Above roughly $1M per clip**, on-chain liquidity on Base gets thin. Split the order **over time** (run several smaller swaps minutes apart so arbitrage refills the pools), or use RFQ/OTC (e.g. Coinbase Prime) instead.

## What the developer must get right before real funds

1. **The right USDC.** Use native USDC `0x8335…2913`. Do *not* use bridged USDbC (`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`). Check that the account holds the native one.
2. **Key handling.** `PRIVATE_KEY` in an env var is fine for a test wallet, not for treasury. For real size, use a hardware signer or KMS (viem supports custom accounts). If funds sit in a Safe, don't use the EOA path: take the calldata from `buildSwapTx` and approvals, and propose them to the Safe.
3. **A paid, reliable RPC.** Each run makes about 20 multicall rounds. Public Base endpoints rate-limit hard, and a failed quote inside the multicall is read as "no liquidity". Also point `RPC_URL` at a provider you trust: the txs are visible to it before inclusion.
4. **Tune the limits for size.** 30 bps per-leg slippage and a 75 bps oracle bound were fine for 250k at today's depth. For larger orders, run a dry run first and look at "cost vs oracle". If it's high, split the order over time rather than widening the limits. Chainlink itself can be off from spot by roughly its deviation threshold (check data.chain.link for the Base ETH/USD feed), so don't set the oracle bound below about 20 bps.
5. **Legs are not atomic.** Each leg is its own tx. If leg 2 reverts (price moved past `minOut`, deadline passed), leg 1 has already executed. The script stops at the first failure. Check the balances, then re-run with the remaining USDC. Don't blindly retry with a wider slippage.
6. **MEV / ordering.** Base has no public mempool; the sequencer orders by priority fee. Classic mempool sandwiching is much harder than on L1, but not zero risk. Prices also move within the ~2s block time. The only hard protection is `amountOutMinimum`, so keep it tight. Never set it to 0.
7. **Approvals.** The script approves exact amounts per router. If a run aborts after approving, a leftover allowance stays on that router. Revoke it, or let the next run reuse it.
8. **Gas.** The account needs a little ETH on Base (a few dollars covers approvals + 3–4 swaps).
9. **Rehearse.** Run a dry run, then a small real swap (e.g. 100 USDC), then check the txs on basescan, *before* the full size. Ideally also run a full `EXECUTE=true` rehearsal on an anvil fork (`anvil --fork-url <rpc>` plus a USDC balance set via `anvil_setStorageAt`, slot = `keccak(addr, 9)`).
10. **Re-verify addresses** if any protocol announces a migration. The script refuses to run if an address has no code, but it can't tell whether a contract has been superseded.

## What was tested

- `tsc` strict: passes.
- Dry run against a Base mainnet fork: 250k USDC plan and oracle check work (outputs above).
- For every router path (Uni 0.05%, Uni 0.3%, Aero CL, Aero classic): the calldata from `buildSwapTx` was `eth_call`ed on live Base with a USDC balance/allowance state override. All four swap successfully and return amounts matching the quote. All four **revert** when `minOut` is set 1% above the quote.
- **Not run end-to-end:** the full `EXECUTE=true` path (approve → send → receipt) on a fork. Free RPCs rate-limited and refused the archive reads anvil needed. Do step 9 before using real funds.
