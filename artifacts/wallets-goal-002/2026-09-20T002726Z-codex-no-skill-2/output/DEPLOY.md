# Ethereum Mainnet Rebalance Agent Deployment

This runbook is for an unattended WETH/USDC rebalancer that signs mainnet transactions from a hot executor key. Treat the executor key as the treasury unless you add a contract wallet, Safe module, or custody policy in front of it.

## Mainnet Contracts Touched

Verified against Uniswap and Circle public docs on 2026-09-20.

| Purpose | Address |
| --- | --- |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| WETH9 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| Uniswap V3 Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Uniswap SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Permit2, not used by `rebalance.ts` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Universal Router, not used by `rebalance.ts` | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` |

Sources:

- Uniswap Ethereum deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
- Uniswap v3 deployment warning and pool lookup docs: https://developers.uniswap.org/docs/protocols/v3/deployments
- Uniswap `SwapRouter02` interface: https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol
- Uniswap `MulticallExtended` deadline wrapper: https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/base/MulticallExtended.sol
- Uniswap `IQuoterV2` interface: https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/IQuoterV2.sol
- Circle USDC on Ethereum: https://www.circle.com/multi-chain-usdc/ethereum

## What `rebalance.ts` Does

1. Reads a rebalance decision from `--decision=...`, `--decision-file=...`, or `REBALANCE_DECISION_JSON`.
2. Uses `EXECUTOR_PRIVATE_KEY` to derive the EOA that holds/spends the input token.
3. Confirms the RPC is Ethereum mainnet chain ID `1`.
4. Confirms the selected WETH/USDC Uniswap V3 pool exists through the V3 factory.
5. Quotes `exactInputSingle` on QuoterV2.
6. Computes `amountOutMinimum` from the quote and the decision slippage.
7. Enforces local caps for trade notional, slippage, fee cap, and priority fee cap.
8. Approves `SwapRouter02` for the exact input amount if current allowance is too low.
9. Encodes `exactInputSingle` and submits it through `SwapRouter02.multicall(deadline, [swap])`.
10. Waits for the approval and swap receipts and fails the process if either reverts.

`SwapRouter02.exactInputSingle` has no native `deadline` parameter, so the code calls it through `multicall(uint256 deadline, bytes[] data)`. That keeps the transaction expiring on-chain.

## Required Setup

Install runtime dependencies in this directory:

```bash
npm install --save-exact viem tsx typescript @types/node
```

Provision these secrets and settings on the VM, preferably through your secret manager rather than a plaintext shell history:

```bash
export MAINNET_RPC_URL="https://..."
export EXECUTOR_PRIVATE_KEY="0x..."
export LIVE_MAINNET="true"
```

Recommended guardrail environment:

```bash
export UNISWAP_V3_FEE="500"
export MAX_TRADE_USDC="50000"
export MAX_SLIPPAGE_BPS="75"
export MAX_FEE_PER_GAS_GWEI="80"
export MAX_PRIORITY_FEE_PER_GAS_GWEI="3"
export TX_DEADLINE_SECONDS="120"
```

Run a single USDC to WETH rebalance:

```bash
npx tsx rebalance.ts --decision='{"id":"signal-2026-09-20T12:00:00Z","tokenIn":"USDC","tokenOut":"WETH","amountIn":"25000","maxSlippageBps":35,"fee":500}'
```

Run a WETH to USDC rebalance:

```bash
npx tsx rebalance.ts --decision='{"id":"signal-2026-09-20T15:00:00Z","tokenIn":"WETH","tokenOut":"USDC","amountIn":"8.2","maxSlippageBps":35,"fee":500}'
```

## Pre-Flight Checklist Before Funding

- Use a dedicated executor EOA. Do not reuse your personal wallet key.
- Fund the EOA with enough ETH for gas and only the WETH/USDC balance the agent is allowed to put at hot-key risk.
- If the treasury must remain in a Safe, build and audit a Safe module or execution service instead of using this file directly; this file assumes the signer can directly spend the ERC-20 balance.
- Verify every address above from primary sources again on deploy day.
- Decide the pool fee tier deliberately. `500` is the default in code because it is commonly used for WETH/USDC, but your routing policy owns that choice.
- Dry run with a tiny mainnet amount first, then a normal amount, then raise treasury size.
- Use a private transaction RPC or protected orderflow endpoint if your RPC provider supports it. Public mempool swaps are sandwichable.
- Put the VM behind MFA-controlled access, OS auto-updates, disk encryption, outbound firewalling, and process supervision.
- Keep RPC credentials, the executor key, logs, and crash dumps out of backups unless the backup path is encrypted and access-controlled.

## What You Are On The Hook For

- Signal correctness. The code enforces execution caps, not strategy quality.
- Key compromise. A hot key with token balances and approval power can lose funds.
- MEV and adverse selection. `amountOutMinimum` limits worst accepted output, but it does not make public mempool execution fair.
- RPC honesty and liveness. Use at least one monitored primary RPC and one tested failover path.
- Idempotency. The code logs `decision.id`; your scheduler must ensure the same decision is not submitted twice after restarts.
- Daily risk limits. `MAX_TRADE_USDC` caps one trade. You still need persistent daily volume, loss, inventory, and drawdown limits outside this single execution file.
- Monitoring. Alert on failed approvals, failed swaps, missing runs, repeated quote failures, low ETH for gas, unexpectedly high slippage, and balances outside treasury policy.
- Incident response. Have a tested script or manual process to revoke router allowance, rotate the executor key, stop the service, and move funds.
- Accounting and tax records. Persist every decision, quote, transaction hash, receipt, balance snapshot, and signal version.

## Emergency Actions

If something looks wrong:

1. Stop the VM service or scheduler.
2. Revoke the executor allowance to `SwapRouter02` for USDC and WETH.
3. Move remaining WETH/USDC/ETH to cold storage or a Safe.
4. Preserve logs and decision inputs for postmortem.
5. Rotate the executor key before restarting.
