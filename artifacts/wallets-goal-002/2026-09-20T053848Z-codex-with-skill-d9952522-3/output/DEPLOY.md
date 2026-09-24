# Mainnet Rebalance Agent Deployment

This agent signs unattended. Treat the signing key as hot production authority, not as a wallet convenience.

## Contracts and Accounts Touched

`rebalance.ts` is hard-coded for Ethereum mainnet chain id `1`.

Contracts:

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 Factory: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- Uniswap V3 QuoterV2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Uniswap SwapRouter02: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- WETH/USDC pool: resolved at runtime with `UniswapV3Factory.getPool(WETH, USDC, poolFee)`, default fee tier `500`.

Accounts:

- `AGENT_PRIVATE_KEY`: the unattended signer. It sends `approve` when needed and `SwapRouter02.exactInputSingle`.
- The agent address is also the token holder and swap recipient in this implementation.
- Do not put the full ~$400k principal in this hot account. Keep principal in a Safe or equivalent threshold custody and refill only the bounded operating float you are willing to lose.

The Uniswap deployment addresses above are from Uniswap's Ethereum deployment docs: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments

## Required Custody Setup

Before this runs with real money:

1. Create a principal treasury as a Safe with a threshold you can satisfy from separate devices, for example `2-of-3`. Solo builder does not mean single key.
2. Create a separate agent EOA for unattended trading. It must be new, dedicated, and never pasted into chat, tickets, CI logs, shell history, or the repo.
3. Fund the agent only with an operating float, for example one day of expected volume plus buffers, not the entire treasury.
4. Refill the agent from the Safe manually or through a separately scoped module with a daily cap.
5. Keep enough ETH in the agent for approvals and swaps. `rebalance.ts` defaults to requiring at least `0.05 ETH` via `MIN_AGENT_ETH`.
6. Revoke old token approvals from the agent before launch. The script grants exact approval for the next swap amount, but it will not save you from old unlimited approvals.
7. Define who can pause the VM, drain the hot wallet back to the Safe, revoke approvals, rotate the key, and change trade caps.

If you insist on letting an unattended signer operate directly from the full treasury, the signer can lose the full treasury. KMS, encrypted env vars, or disk encryption do not change that authority.

## Runtime Prerequisites

Install dependencies:

```sh
npm install viem tsx typescript @types/node
```

Create `.env` outside git or inject secrets through your VM secret manager:

```sh
RPC_URL=https://your-mainnet-rpc.example
AGENT_PRIVATE_KEY=0x...
DECISION_PATH=./decision.json
STATE_PATH=./.rebalance-state.json
MAX_TRADE_USD=50000
MIN_TRADE_USD=1000
MAX_DAILY_USD=100000
MAX_SLIPPAGE_BPS=50
MIN_AGENT_ETH=0.05
DEADLINE_SECONDS=120
DRY_RUN=true
```

Never commit `.env`, private keys, decision logs with secrets, or cloud instance metadata. Add them to `.gitignore` before the first push.

Example decision file:

```json
{
  "signalId": "2026-09-20T12:00:00Z:model-a",
  "targetWethBps": 4500,
  "poolFee": 500,
  "maxTradeUsd": "50000",
  "minTradeUsd": "1000",
  "maxSlippageBps": 50,
  "deadlineSeconds": 120,
  "dryRun": true
}
```

Run a dry simulation first:

```sh
set -a
. ./.env
set +a
DRY_RUN=true npm run rebalance
```

Run live only after dry runs, alerts, and funding limits are in place:

```sh
set -a
. ./.env
set +a
DRY_RUN=false npm run rebalance
```

## What The Script Does

1. Verifies the RPC is Ethereum mainnet chain id `1`.
2. Verifies bytecode exists at WETH, USDC, Uniswap V3 Factory, QuoterV2, and SwapRouter02.
3. Resolves the WETH/USDC pool for the configured fee tier and checks nonzero liquidity.
4. Reads the agent's WETH and USDC balances.
5. Quotes WETH in USDC through QuoterV2.
6. Computes the trade required to move toward `targetWethBps`, capped by `MAX_TRADE_USD`.
7. Enforces `MIN_TRADE_USD`, `MAX_DAILY_USD`, `MAX_SLIPPAGE_BPS`, balance checks, gas balance checks, and stale allowance checks.
8. If needed, signs and submits an exact-size ERC20 `approve` to SwapRouter02.
9. Simulates, signs, and submits `SwapRouter02.exactInputSingle`.
10. Waits for confirmation and records the submitted notional in `STATE_PATH`.

The daily cap file is an operational guardrail only. It is local state on the VM, so it is not a cryptographic or on-chain spending limit.

## Production Responsibilities

You are on the hook for:

- Key authority: the hot key must be able to lose only the operating float.
- RPC integrity and availability: use a reputable mainnet RPC, monitor failures, and consider a secondary RPC for read-only checks.
- Signal sanity: bad target weights produce real trades. Put independent bounds around model outputs before writing `decision.json`.
- MEV and slippage: public mempool swaps can be sandwiched. For $10k-50k trades, evaluate private transaction submission or a trusted execution path.
- Allowances: monitor and revoke approvals; never leave unlimited approvals from the agent.
- Gas: keep ETH topped up and alert before `MIN_AGENT_ETH` trips.
- Monitoring: alert on every submitted tx, failed tx, trade over expected notional, repeated dry-run failures, RPC chain mismatch, VM restart, and state-file reset.
- Incident response: have a rehearsed runbook to stop the service, revoke approvals, move agent balances back to the Safe, rotate the agent key, and invalidate pending automation credentials.
- Accounting and tax records: persist signal id, balances, quotes, tx hashes, gas, and receipts somewhere durable.
- Contract/address drift: re-check official deployment sources before upgrades. This file uses Uniswap V3 SwapRouter02 deliberately, although Uniswap now lists Universal Router as the preferred general entrypoint.

## Launch Checklist

- Principal Safe created and tested.
- Agent EOA created from a clean machine or managed signer.
- `.gitignore` covers `.env`, key files, state files, logs, and decision artifacts.
- Agent funded only with bounded WETH/USDC float and gas ETH.
- Old agent approvals revoked.
- Mainnet RPC configured and chain id check passes.
- `DRY_RUN=true` succeeds with live balances.
- First live trade uses a tiny cap, for example `MAX_TRADE_USD=100`.
- Alerts fire for approval tx, swap tx, success, failure, and no-op.
- Emergency revoke and sweep procedure tested with a small balance.
