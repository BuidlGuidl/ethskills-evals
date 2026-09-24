# Ethereum Mainnet Rebalance Agent Deployment

This runbook assumes Ethereum mainnet as of 2026-09-20. Contract addresses below are from the official Uniswap v3 Ethereum deployments page. Re-check them before production cutover.

## Execution Model

`rebalance.ts` signs with one dedicated agent EOA and submits transactions to Ethereum mainnet through viem.

Accounts:

- Agent EOA: derived from `AGENT_PRIVATE_KEY`; owns the WETH/USDC that can be traded and pays gas.
- Recipient: `RECIPIENT_ADDRESS`, or the agent EOA if unset; receives swap output.
- Operator: you; owns deployment, key custody, monitoring, incident response, and strategy losses.

Contracts touched:

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap v3 Factory: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- Uniswap v3 QuoterV2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Uniswap SwapRouter02: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`

Default pool fee tier: `500` for the WETH/USDC 0.05% pool. Override with `UNISWAP_V3_FEE` only after confirming pool liquidity.

## Before Real Funds

Install runtime dependencies:

```bash
npm install viem
npm install --save-dev tsx typescript @types/node
```

Create `.gitignore` before putting any secret material near this repo:

```gitignore
.env
.env.*
*.key
*.pem
runtime/
node_modules/
```

Create a dedicated production agent wallet. Do not use your personal wallet or treasury owner key. For this exact file, the agent key must be able to sign unattended from the VM; that means compromise of the VM is compromise of the wallet. The safer production pattern is to keep the full ~$400k in a Safe/vault and feed only a bounded operating balance or use a policy-enforced smart account/KMS signer.

Fund the agent wallet with:

- WETH and/or USDC inventory that the strategy is allowed to trade.
- ETH for gas, above `MIN_AGENT_ETH`.
- No unrelated assets.

Set production limits so one bad signal cannot drain the whole treasury:

- `MAX_TRADE_USDC=50000` or lower.
- `DAILY_VOLUME_LIMIT_USDC` to a value you can tolerate if the signal loops.
- `MAX_SLIPPAGE_BPS`; default is `30` (0.30%).
- One process only. The code uses a local lock file, but you should also prevent multiple schedulers/VMs from running the same wallet.

Test in this order:

1. Run on an Ethereum mainnet fork with copied balances and approvals.
2. Run on mainnet with a tiny funded agent wallet.
3. Run one real tiny WETH -> USDC and one USDC -> WETH trade.
4. Verify the audit log, daily volume state, block receipts, token balances, and monitoring alerts.
5. Increase limits gradually.

## Environment

Required:

```bash
MAINNET_RPC_URL="https://..."
AGENT_PRIVATE_KEY="0x..."       # never commit, paste into chat, or store in shell history
SUBMIT_TXS="false"              # must be exactly true to send live transactions
```

Recommended:

```bash
RECIPIENT_ADDRESS="0x..."       # defaults to agent EOA
UNISWAP_V3_FEE="500"
MAX_TRADE_USDC="50000"
DAILY_VOLUME_LIMIT_USDC="150000"
MAX_SLIPPAGE_BPS="30"
MIN_AGENT_ETH="0.05"
REBALANCE_STATE_FILE="./runtime/rebalance-state.json"
REBALANCE_AUDIT_FILE="./runtime/rebalance-audit.ndjson"
REBALANCE_LOCK_FILE="./runtime/rebalance.lock"
```

For production, inject secrets from your cloud secret manager at process start. Do not bake them into the VM image, systemd unit, Docker image, repo, CI logs, or process supervisor config that other users can read.

## Running

Dry preparation:

```bash
SUBMIT_TXS=false npx tsx rebalance.ts WETH_TO_USDC 3.5 "signal: reduce eth exposure"
SUBMIT_TXS=false npx tsx rebalance.ts USDC_TO_WETH 25000 "signal: increase eth exposure"
```

Live submission:

```bash
SUBMIT_TXS=true npx tsx rebalance.ts WETH_TO_USDC 3.5 "signal: reduce eth exposure"
```

If allowance is missing, the live path first sends an exact-size ERC20 `approve` to `SwapRouter02`, waits for confirmation, then simulates and submits `exactInputSingle`. Routine operation should normally have no leftover allowance because the swap consumes the approved input amount. If approval succeeds and swap fails, revoke the remaining allowance.

With `SUBMIT_TXS=false`, a missing allowance is reported as `approvalNeeded` and swap simulation is skipped because the approval is not actually mined.

## Monitoring

Alert immediately on:

- Any transaction from the agent EOA that is not an ERC20 approval to SwapRouter02 or a SwapRouter02 `exactInputSingle`.
- Any approval larger than the intended trade size.
- Daily volume approaching `DAILY_VOLUME_LIMIT_USDC`.
- Agent ETH below `MIN_AGENT_ETH`.
- RPC failures, replacement transactions, stuck pending transactions, or reorgs affecting submitted swaps.
- WETH/USDC pool liquidity collapsing, abnormal quoted slippage, or oracle/reference price divergence.
- VM login, deploy, dependency, or systemd changes.

Keep `runtime/rebalance-audit.ndjson` and RPC/provider logs. They are your trade blotter. They must never contain the private key.

## Emergency Actions

Have these ready before funding:

- Stop the process or disable the scheduler.
- Revoke WETH and USDC allowances from the agent EOA to `SwapRouter02`.
- Move remaining WETH/USDC/ETH out of the agent EOA to cold storage or Safe.
- Rotate the agent key and redeploy with a new wallet.
- Disable the RPC key if abuse is suspected.

If the private key ever appears in git, chat, logs, shell history, crash dumps, or a cloud console screenshot, assume it is compromised and move funds immediately.

## What You Are On The Hook For

You are accepting unattended execution risk. The code checks chain ID, contract bytecode, pool existence, balances, quoted output, slippage, max trade size, daily volume, and gas ETH balance. It does not prove your signal is sane, detect every market manipulation, protect against VM compromise, guarantee RPC correctness, or prevent losses from adverse price movement after a quote.

You own:

- Strategy losses and bad signals.
- Key custody and cloud VM hardening.
- Dependency and Node.js security updates.
- RPC/provider reliability and correctness.
- MEV/slippage/latency exposure.
- Monitoring, alert routing, and incident response.
- Tax, accounting, and regulatory obligations.

## References

- Uniswap v3 Ethereum deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
- viem wallet client and local account flow: https://viem.sh/docs/clients/wallet
