# Ethereum mainnet rebalance bot deployment

This repo contains an execution path for an unattended hot-wallet rebalance between WETH and USDC on Uniswap V3.

It touches these mainnet contracts:

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 Factory: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- Uniswap V3 QuoterV2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Uniswap SwapRouter02: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`

The Uniswap addresses above are from the current Uniswap Ethereum deployment page. Circle lists native Ethereum USDC at `0xA0b...eB48`.

## What must exist first

- A dedicated Ethereum mainnet execution account. This code signs as that account and sends directly to `SwapRouter02`.
- The execution account must hold the rebalance inventory: WETH, USDC, and enough ETH for gas.
- A mainnet RPC endpoint with reliable `eth_call`, `eth_sendRawTransaction`, and receipt polling.
- Node.js, npm, and dependencies installed with `npm install`.
- A signal process that writes a bounded rebalance decision into `REBALANCE_DECISION_JSON`.
- Monitoring that pages you only for non-routine conditions: failed tx, repeated dry-run rejection, low ETH, missing balances, stuck nonce, bad RPC, abnormal slippage, or unexpected portfolio drift.

## Environment

Required:

```bash
export MAINNET_RPC_URL="https://..."
export PRIVATE_KEY="0x..." # dedicated hot execution key
export TREASURY_ADDRESS="0x..." # optional guard; must match PRIVATE_KEY
export REBALANCE_DECISION_JSON='{"side":"USDC_TO_WETH","amount":"25000","id":"signal-123","reason":"target rebalance"}'
```

Recommended production guards:

```bash
export EXECUTE=false                # default; set true only after dry-run output is sane
export UNISWAP_FEE_TIER=500         # WETH/USDC 0.05% pool
export MAX_TRADE_USDC=50000
export MAX_SLIPPAGE_BPS=30
export MAX_PRICE_IMPACT_BPS=100
export MIN_ETH_BALANCE=0.05
export TX_CONFIRMATIONS=2
export TX_RECEIPT_TIMEOUT_MS=900000
export LOCKFILE=/tmp/rebalance-mainnet.lock
```

Run:

```bash
npm install
npm run rebalance
EXECUTE=true npm run rebalance
```

## Decision format

`side` is one of:

- `USDC_TO_WETH`: `amount` is USDC units, for example `"25000"`.
- `WETH_TO_USDC`: `amount` is WETH units, for example `"10.5"`.

Optional fields:

- `feeTier`: `100`, `500`, `3000`, or `10000`; defaults to `UNISWAP_FEE_TIER` or `500`.
- `maxSlippageBps`: cannot exceed `MAX_SLIPPAGE_BPS`.
- `maxPriceImpactBps`: cannot exceed `MAX_PRICE_IMPACT_BPS`.
- `id` and `reason`: logged for audit only.

## Production responsibilities

The hot key is the central risk. If this VM or key is compromised, an attacker can approve and trade the account's WETH/USDC without waking you up. Keep only the funds this unattended system is allowed to risk in this account, use a dedicated key, restrict server access, ship logs off-box, and maintain a tested kill procedure that can revoke allowances and move funds.

Before funding with the full treasury:

- Run against a mainnet fork with the real addresses.
- Run a dry-run against mainnet RPC and inspect the quoted route, pool, minimum output, and account.
- Send one tiny mainnet trade in each direction.
- Confirm allowance behavior. This bot approves only the needed amount and resets nonzero insufficient allowance to zero first.
- Confirm the signal process cannot emit trades above your caps.
- Revoke stale token approvals from any old router or test account.

Once running, you are on the hook for:

- Nonce management. Only one process should use this key.
- Gas funding and replacement policy if transactions get stuck.
- RPC correctness and censorship/failure handling.
- MEV and sandwich exposure. `amountOutMinimum` limits realized loss, but public mempool submission still leaks intent.
- USDC issuer and blacklist/freeze risk.
- WETH/USDC pool liquidity changes, fee-tier choice, and oracle sanity outside this executor.
- Accounting, tax records, and compliance for autonomous trading.
- Incident response: pause the scheduler, revoke router allowance, move funds, rotate keys, and rebuild the VM from clean infrastructure.

For a $400k treasury, the safer architecture is not a plain EOA private key on a VM. Use an account design with on-chain limits or session keys if you can tolerate the integration work. If you keep this EOA design, treat compromise of the VM as compromise of the treasury.
