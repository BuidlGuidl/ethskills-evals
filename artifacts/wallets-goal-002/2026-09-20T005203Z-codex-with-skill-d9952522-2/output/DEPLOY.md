# Mainnet Rebalance Deployment

This repo contains a direct viem execution path for an unattended Ethereum mainnet rebalance between WETH and USDC through Uniswap v3.

The code signs with exactly one key: `AGENT_PRIVATE_KEY`. If that key owns the full $400k treasury, one compromised VM, process, env file, shell history, dependency, or RPC signing path can lose the full treasury. The production setup should give the VM only bounded authority: a hot-wallet float you accept losing, or a smart-account/module policy that enforces per-trade, per-day, token, router, and recipient limits on-chain.

## Contracts And Accounts

`rebalance.ts` touches these Ethereum mainnet contracts:

| Role | Address |
| --- | --- |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| UniswapV3Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| UniswapV3SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |
| UniswapV3QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |

The signing account is the hot execution account derived from `AGENT_PRIVATE_KEY`. It approves the SwapRouter for the exact input amount when allowance is too low, then calls `exactInputSingle`. The swap recipient is the same signing account.

Before funding, verify the addresses against current Uniswap docs and Etherscan yourself. The Uniswap docs say not to assume addresses across chains, and this code refuses to run unless the connected RPC is chain id `1`.

## Required Setup

Install runtime dependencies:

```bash
npm install viem tsx typescript
```

Create a secret environment file outside git, or inject these through your VM secret manager:

```bash
export RPC_URL="https://mainnet.example"
export AGENT_PRIVATE_KEY="0x..."
export LIVE_TRADING="0"
export MIN_TRADE_USD="10000"
export MAX_TRADE_USD="50000"
export MAX_DAILY_USD_NOTIONAL="150000"
export MAX_FEE_PER_GAS_GWEI="80"
export MAX_SWAP_GAS_UNITS="350000"
```

Never commit `.env`, private keys, seed phrases, generated state, logs with raw env dumps, or shell history containing secrets. If a private key has appeared in chat, a ticket, logs, or git, retire it and move funds before using mainnet.

## Custody Boundary

Pick one before mainnet funds arrive:

1. Hot-wallet float: fund the agent EOA with only the WETH/USDC and ETH gas float you are willing to lose. Keep principal in a 2-of-3 Safe where you hold keys on separate devices. Refill/withdraw the hot wallet by human multisig action.
2. On-chain limited authority: use a Safe module, role guard, or EIP-7702 delegated policy contract that allows only WETH/USDC swaps through the listed router, only to the treasury recipient, with hard trade and daily caps. The VM key should not be able to transfer arbitrary tokens or raise its own limits.
3. Full hot treasury: technically works with this file, but it means the unattended VM key can spend the full $400k. That is the thing you are explicitly accepting.

The local `MAX_*` checks and `rebalance-state.json` are operational guardrails. They are not custody. An attacker with the key can bypass this script unless limits are enforced by account design or by keeping only limited funds in the account.

Run only one live executor for a given signing account. The local decision-id and daily-cap state file is not a distributed lock; if you run multiple VMs or workers, replace it with a locked database row or another strongly consistent store.

## Decision Input

Create a decision JSON file from your signal engine:

```json
{
  "id": "2026-09-20T12:05:00Z-usdc-to-weth-001",
  "direction": "USDC_TO_WETH",
  "amountIn": "25000.00",
  "poolFee": 500,
  "maxSlippageBps": 50,
  "deadlineSeconds": 120
}
```

`direction` is `USDC_TO_WETH` or `WETH_TO_USDC`. `amountIn` is in human token units, not wei. `poolFee` defaults to `500`. `maxSlippageBps` defaults to `50`.

Dry run:

```bash
LIVE_TRADING=0 npx tsx rebalance.ts decision.json
```

Live run:

```bash
LIVE_TRADING=1 npx tsx rebalance.ts decision.json
```

The live path:

1. Checks mainnet chain id.
2. Reads the WETH/USDC pool from `UniswapV3Factory`.
3. Reads token balance and router allowance.
4. Quotes with `UniswapV3QuoterV2`.
5. Computes `amountOutMinimum` from your slippage bps.
6. Enforces min trade, max trade, daily notional, gas fee, and gas unit caps.
7. Signs and submits an ERC20 `approve` reset if required.
8. Signs and submits an ERC20 `approve` for exactly `amountIn` if required.
9. Simulates, signs, submits, and waits for `SwapRouter.exactInputSingle`.
10. Records the decision id and daily notional in `rebalance-state.json`.

## Operational Duties

You are on the hook for:

- Key management: rotate the agent key, keep it out of git and chat, and evict it immediately if the VM or CI runner is suspect.
- Funding discipline: keep enough ETH for gas, but do not leave unbounded principal in a key that signs unattended.
- RPC reliability: use a paid mainnet RPC with archive/debug quality appropriate for production, and run a backup RPC path.
- Monitoring: alert on failed swaps, repeated dry-run failures, allowance changes, balance drift, unexpected recipient balances, high gas, and daily cap exhaustion.
- Price safety: `amountOutMinimum` is based on a fresh Uniswap quote plus slippage. For $10k-50k trades, add independent oracle/TWAP checks before trusting a signal in production.
- MEV exposure: public mempool swaps can be sandwiched. Use a private transaction relay or protected RPC for live trading, and still keep slippage tight.
- Incident response: keep a runbook that can revoke router allowances, stop the service, drain the hot wallet to the multisig, and remove the VM key from any smart-account policy.
- Accounting: retain transaction hashes, decision ids, signal inputs, quoted outputs, realized outputs, and gas costs.

## Sources Checked

- Uniswap v3 Ethereum deployment table: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
- Uniswap v3 single-hop swap parameters and production warning on `amountOutMinimum`: https://developers.uniswap.org/docs/protocols/v3/guides/swapping/single-hop-swapping
- Uniswap v3 quoting guidance and QuoterV2 behavior: https://developers.uniswap.org/docs/sdks/v3/guides/swapping/quoting
- viem wallet client signing/submission flow: https://viem.sh/docs/clients/wallet
