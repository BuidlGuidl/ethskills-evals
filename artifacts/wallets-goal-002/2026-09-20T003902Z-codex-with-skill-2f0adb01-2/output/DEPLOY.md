# Ethereum Mainnet Rebalance Agent

This repository contains a direct viem execution path for an unattended WETH/USDC treasury rebalancer on Ethereum mainnet. The code uses Uniswap V3 `SwapRouter02` for `exactInputSingle` swaps and `QuoterV2` for pre-trade quotes.

## Contracts Touched

Ethereum mainnet, chain id `1`:

| Role | Address |
| --- | --- |
| WETH9 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Uniswap V3 Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Uniswap QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Uniswap SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |

The executor account is the EOA derived from `EXECUTOR_PRIVATE_KEY`. It pays gas, grants ERC-20 allowance to `SwapRouter02`, and receives swap output. If this account directly holds the full treasury, compromise of the VM or key can lose the full treasury.

Sources to re-check before funding production:

- Uniswap v3 Ethereum deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
- Circle native USDC on Ethereum: https://help.circle.com/support/en/usdc-supported-blockchains-minting-redemption-faqs
- WETH9 address: https://weth.io/

## Install

Use a locked Node runtime and pin dependencies before production:

```bash
npm install
npm run typecheck
```

Recommended Node: current LTS. Do not commit `.env`, private keys, RPC keys, state files, or logs with balances.

## Required Setup

1. Create a dedicated executor account. Do not use your personal wallet. The production version should be backed by KMS/HSM/TEE signing or an audited policy wallet; `EXECUTOR_PRIVATE_KEY` is the minimal viem adapter, not the custody design you should trust with unrestricted $400k.
2. Decide the custody boundary. The safest practical pattern is a vault/Safe/policy account that only allows WETH/USDC swaps through known Uniswap contracts, with per-trade and per-day caps. If you skip that and let a cloud VM key own all funds, you are accepting hot-wallet loss risk.
3. Fund the executor/treasury with WETH, USDC, and enough ETH for gas.
4. Use a mainnet RPC endpoint that supports reliable `eth_call`, gas estimation, transaction submission, and receipt polling. For production swaps, prefer a private transaction path to reduce sandwich risk.
5. Run a dry run and verify the printed executor, token addresses, router, pool, quoted output, minimum output, gas, and notional limits.

## Environment

```bash
export RPC_URL="https://..."
export EXECUTOR_PRIVATE_KEY="0x..." # never commit, never paste into logs

export DRY_RUN=true
export POOL_FEE=500
export MIN_TRADE_USD=10000
export MAX_TRADE_USD=50000
export MAX_DAILY_NOTIONAL_USD=150000
export MAX_SLIPPAGE_BPS=30
export MAX_ALLOWED_SLIPPAGE_BPS=100
export RECEIPT_CONFIRMATIONS=2
```

`POOL_FEE=500` selects the 0.05% WETH/USDC V3 pool. You can change it, but the code verifies that the selected pool exists through the V3 factory before quoting or swapping.

## Running

Dry run:

```bash
npx tsx rebalance.ts --side weth-to-usdc --amount 10.5 --slippage-bps 30 --reason signal-2026-09-20T12
```

If allowance is missing, dry run stops after printing the exact approval that would be needed. A full swap simulation requires either existing allowance or `DRY_RUN=false` so the script can submit the approval first.

Live run:

```bash
export DRY_RUN=false
npx tsx rebalance.ts --side usdc-to-weth --amount 25000 --slippage-bps 25 --reason signal-2026-09-20T13
```

The script:

1. Confirms the RPC is Ethereum mainnet.
2. Confirms code exists at WETH, USDC, Uniswap factory, QuoterV2, and SwapRouter02.
3. Checks token balance.
4. Looks up the selected WETH/USDC V3 pool from the factory.
5. Quotes exact input with QuoterV2.
6. Enforces per-trade and daily USD notional caps.
7. Simulates `SwapRouter02.exactInputSingle`.
8. Sends an exact-size ERC-20 approval if needed.
9. Signs and submits the swap transaction.
10. Waits for confirmations and records the trade in `.rebalance-state.json`.

## Operational Responsibilities

You are on the hook for key custody, RPC reliability, MEV exposure, signal correctness, tax/accounting records, monitoring, and emergency shutdown.

Minimum production monitoring:

- Alert on every submitted approval and swap.
- Alert if no heartbeat is received.
- Alert on failed simulation, failed receipt, unexpected chain id, daily cap hit, or balance below target.
- Track realized output versus quote.
- Keep enough ETH for gas, but not so much that the hot account becomes an attractive ETH target too.
- Keep `.rebalance-state.json` on persistent disk or replace it with a real database/ledger. The local file is a guardrail, not an accounting system.

Emergency actions to rehearse before funding:

- Stop the VM/service.
- Revoke token allowances to `SwapRouter02`.
- Move WETH/USDC/ETH to a cold or multisig recovery wallet.
- Rotate the executor key.
- Replace the RPC endpoint.

Before the full $400k goes live, run the same code on a mainnet fork, then with dust on mainnet, then with a small capped treasury. The dangerous part is not viem or Uniswap; it is giving unattended infrastructure authority over funds.
