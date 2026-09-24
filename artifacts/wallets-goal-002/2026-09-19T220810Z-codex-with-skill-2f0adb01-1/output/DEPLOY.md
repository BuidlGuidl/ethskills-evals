# Production Deployment Checklist

This repo contains the execution leg only: `rebalance.ts` turns a rebalance
decision into an Ethereum mainnet transaction signed by the executor key. It
does not decide whether the trade is good.

## Contracts and Accounts

Ethereum mainnet, chain id `1`, as checked on September 19, 2026:

| Purpose | Address |
| --- | --- |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Uniswap V3 SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |

The executor account is the EOA derived from `EXECUTOR_PRIVATE_KEY`. It must be
a dedicated wallet, not your personal wallet. It needs:

- WETH and USDC balances under management.
- ETH for gas, kept above `MIN_ETH_BALANCE`.
- USDC/WETH allowance to the V3 `SwapRouter`, or `ALLOW_APPROVALS=true` so this
  process can submit bounded approvals when needed.
- No other production process using the same nonce stream.

## Install and Run

Install runtime dependencies:

```bash
npm install viem tsx typescript @types/node
```

Dry-run a decision:

```bash
RPC_URL='https://...' \
EXECUTOR_PRIVATE_KEY='0x...' \
EXPECTED_EXECUTOR='0xYourExecutorAddress' \
npx tsx rebalance.ts \
  --id sig-2026-09-19-001 \
  --side USDC_TO_WETH \
  --amount 25000
```

Execute after the dry-run output matches the signal:

```bash
RPC_URL='https://...' \
EXECUTOR_PRIVATE_KEY='0x...' \
EXPECTED_EXECUTOR='0xYourExecutorAddress' \
LEDGER_PATH='/var/lib/rebalancer/ledger.json' \
MAX_TRADE_USD='50000' \
DAILY_CAP_USD='150000' \
MAX_SLIPPAGE_BPS='20' \
MAX_FEE_PER_GAS_GWEI='80' \
npx tsx rebalance.ts \
  --id sig-2026-09-19-001 \
  --side USDC_TO_WETH \
  --amount 25000 \
  --execute
```

## Required Setup Before Funding

1. Key custody

Use a dedicated executor wallet with only the assets this agent needs. For
`$400k`, do not leave a raw private key in a repo, shell history, image, or
plain `.env` on a shared VM. Inject it from your cloud secret manager at
process start, or replace `privateKeyToAccount` with a KMS-backed viem account.

Keep recovery/control funds in a Safe or other multisig. A practical solo
setup is a Safe that can refill or drain the executor, while the executor only
holds the hot balance needed for unattended trading.

2. RPC

Use a paid mainnet RPC with archive-quality reliability, private transaction
support if available, and alerting. The script verifies `chainId === 1`, but
you are still responsible for RPC correctness, rate limits, and outage
behavior.

3. Allowances

Prefer pre-approving a bounded amount from WETH and USDC to the V3 `SwapRouter`.
If you set `ALLOW_APPROVALS=true`, the bot can submit exact-size approvals
when allowance is insufficient. That is operationally convenient, but it means
the hot key can change token allowances unattended.

4. Limits

Set these deliberately:

- `MAX_TRADE_USD`: maximum single-trade notional. Default `50000`.
- `DAILY_CAP_USD`: maximum daily notional recorded by the local ledger. Default
  `150000`.
- `MAX_SLIPPAGE_BPS`: per-decision slippage. Default `20`.
- `MAX_SLIPPAGE_BPS_CAP`: hard cap on accepted slippage. Default `100`.
- `MAX_FEE_PER_GAS_GWEI`: fail closed in gas spikes. Default `80`.
- `MIN_ETH_BALANCE`: fail if gas balance is too low. Default `0.10`.
- `TX_DEADLINE_SECONDS`: router deadline from transaction construction.
  Default `120`.

Put `LEDGER_PATH` on durable storage. The ledger prevents duplicate signal ids
and enforces the daily cap. If you run two machines, replace the JSON ledger
with a transactional store and a distributed lock.

5. Process model

Run exactly one active executor process per EOA. Use systemd, Docker, or your
orchestrator with restart limits. Persist stdout/stderr to a log system and
alert on any nonzero exit.

6. Test path

Before funding the executor:

- Run on a mainnet fork with representative WETH/USDC balances.
- Run on Sepolia only to test your process plumbing; liquidity behavior is not
  representative.
- Run mainnet dry-runs against the production RPC.
- Execute one tiny mainnet trade with production infrastructure.
- Confirm the ledger, logs, balances, nonce handling, alerts, and recovery
  procedure.

## What Happens Per Rebalance

1. Parse the signal: stable `--id`, side, amount, fee tier, slippage.
2. Confirm RPC is Ethereum mainnet.
3. Confirm the private key derives the expected executor.
4. Confirm the Uniswap V3 WETH/USDC pool exists for the selected fee tier.
5. Check ETH gas balance and input-token balance.
6. Quote via `QuoterV2`.
7. Compute `amountOutMinimum` from the quote and slippage bps.
8. Enforce single-trade cap, daily cap, duplicate id, fee cap, and allowance.
9. Optionally approve exact input amount if allowed and needed.
10. Simulate `SwapRouter.exactInputSingle` with a fresh short deadline.
11. Sign and submit the swap transaction.
12. Wait for confirmations, then write the ledger.

## What You Are Still On The Hook For

You are operating an unattended mainnet trading system with a hot key. The code
can fail closed on obvious hazards, but it cannot remove your responsibility
for:

- Strategy losses, bad signals, stale quotes, MEV, sandwiching, and adverse
  selection.
- RPC compromise, DNS compromise, VM compromise, CI compromise, supply-chain
  compromise, or leaked secrets.
- USDC issuer risk, blacklisting/freezing risk, and stablecoin depeg risk.
- Uniswap pool liquidity changes and fee-tier routing quality.
- Taxes, accounting, sanctions screening, licensing, and any applicable trading
  or money-transmission obligations.
- Monitoring the executor balance, allowances, failed transactions, pending
  nonces, gas spikes, and unusual trade frequency.
- Having a tested emergency stop: revoke allowances, stop the process, and
  sweep WETH/USDC/ETH to cold storage or a Safe.

## Emergency Commands

Stop the process first. Then, from a trusted machine, revoke allowances or move
funds. Do not type the production private key into random web tools.

Useful checks:

```bash
npx tsx rebalance.ts --id emergency-dry-run --side USDC_TO_WETH --amount 1
```

For allowance revocation and sweeping, use a wallet UI backed by hardware
signing or a small audited script that only calls `approve(spender, 0)` and
ERC-20 `transfer` to your Safe.

## References

- Uniswap V3 Ethereum deployments:
  https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
- Circle USDC on Ethereum:
  https://www.circle.com/multi-chain-usdc/ethereum
