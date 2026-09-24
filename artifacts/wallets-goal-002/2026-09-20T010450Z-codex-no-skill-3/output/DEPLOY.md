# Production Deployment Runbook

This repository contains a direct EOA executor for Ethereum mainnet WETH/USDC
rebalancing through Uniswap V3. It is intentionally narrow: it executes one
already-made rebalance decision, not the signal engine that creates decisions.

As of September 20, 2026, the mainnet addresses used in `rebalance.ts` are:

| Contract/account | Address | Why it is touched |
| --- | --- | --- |
| Executor / treasury EOA | `TREASURY_ADDRESS` | Holds WETH/USDC, signs approvals/swaps, pays gas |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | Input or output token |
| USDC | `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | Input or output token |
| Uniswap V3 Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | Checks that the selected pool exists |
| Uniswap V3 SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Executes `exactInputSingle` |
| Uniswap V3 QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` | Pre-trade `eth_call` quote |

Primary references:

- Uniswap V3 Ethereum deployments: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
- Uniswap V3 single-hop swap warning on production `amountOutMinimum`: https://developers.uniswap.org/docs/protocols/v3/guides/swapping/single-hop-swapping
- QuoterV2 interface behavior: https://github.com/Uniswap/v3-periphery/blob/main/contracts/interfaces/IQuoterV2.sol

## Before This Can Hold Real Money

You need all of this in place before `EXECUTE=true` runs against the real
treasury.

1. Runtime dependencies

   ```bash
   npm install viem dotenv
   npm install --save-dev tsx typescript @types/node
   ```

2. Mainnet RPC

   Use a paid Ethereum mainnet RPC with archive-quality reliability, low latency,
   and clear rate limits. Configure at least one failover outside this script or
   in the process supervisor. The script refuses to run unless `eth_chainId` is
   mainnet chain `1`.

3. Executor account

   Create a dedicated executor EOA. `PRIVATE_KEY` must sign for
   `TREASURY_ADDRESS`; the script checks this at startup.

   The simplest design is also the riskiest: the hot key directly owns the WETH
   and USDC. If the VM or secret store is compromised, the treasury can be moved
   or traded away. For $400k, strongly prefer a policy vault or Safe/module setup
   with hard per-trade, per-token, and daily limits, then adapt the signing path
   to that account model.

4. Token balances and gas

   Fund the executor with the inventory it is allowed to trade and enough ETH for
   gas. The default minimum ETH balance is `0.05`.

5. Allowances

   By default, `APPROVAL_POLICY=exact`, so the script approves only the amount
   needed for the current trade. `APPROVAL_POLICY=infinite` saves gas and
   increases blast radius. If you use infinite approvals, monitor and be prepared
   to revoke them immediately.

6. Signal handoff

   The signal engine must hand the executor a concrete decision:

   - `side`: `USDC_TO_WETH` or `WETH_TO_USDC`
   - `amountIn`: decimal input amount in the input token
   - `poolFee`: normally `500` for WETH/USDC, unless your routing policy says
     otherwise
   - `maxSlippageBps`: maximum quote-to-execution slippage
   - optional `minAmountOut`: a stricter output floor from your own pricing model
   - `validForSeconds`: 15 to 300 seconds

7. Price and MEV controls

   The script quotes with Uniswap `QuoterV2`, applies `amountOutMinimum`, sets a
   deadline, simulates the transaction, and caps EIP-1559 fees. That is not a
   complete adversarial trading system. Your signal engine should also reject
   trades when the DEX quote deviates too far from an independent price source.

   Use a private transaction path if your RPC supports it and test that it still
   returns receipts reliably. Public mempool swaps at $10k-50k are sandwichable.

8. Nonce discipline

   Run only one executor instance per signer. If the process can overlap jobs,
   add an external nonce lock. Have an automated stale-transaction playbook:
   replacement transaction, cancellation transaction, or process stop.

9. Monitoring

   Alert on:

   - failed approvals or swaps
   - stuck pending nonce
   - unexpected token balance delta
   - gas cap exceeded
   - RPC chain mismatch
   - quote deviation from independent price
   - daily traded notional above policy
   - host login, deployment, or secret access events

10. Recovery access

    Keep a separate, tested recovery path for moving funds out of the executor.
    Do not keep the only recovery secret on the VM running the bot.

## Environment

Example dry run:

```bash
RPC_URL="https://eth-mainnet.example" \
PRIVATE_KEY="0x..." \
TREASURY_ADDRESS="0xYourExecutorAddress" \
SIDE="USDC_TO_WETH" \
AMOUNT_IN="25000" \
POOL_FEE="500" \
MAX_SLIPPAGE_BPS="30" \
npx tsx rebalance.ts
```

Example live run:

```bash
RPC_URL="https://eth-mainnet.example" \
PRIVATE_KEY="0x..." \
TREASURY_ADDRESS="0xYourExecutorAddress" \
SIDE="WETH_TO_USDC" \
AMOUNT_IN="10.5" \
POOL_FEE="500" \
MAX_SLIPPAGE_BPS="30" \
MAX_ALLOWED_SLIPPAGE_BPS="100" \
MIN_TRADE_USD="10000" \
MAX_TRADE_USD="50000" \
MAX_FEE_PER_GAS_GWEI="80" \
MAX_PRIORITY_FEE_GWEI="3" \
VALID_FOR_SECONDS="90" \
CONFIRMATIONS="2" \
EXECUTE="true" \
npx tsx rebalance.ts
```

Alternative JSON decision:

```bash
REBALANCE_DECISION_JSON='{
  "id": "signal-2026-09-20T12:00:00Z",
  "side": "USDC_TO_WETH",
  "amountIn": "25000",
  "poolFee": 500,
  "maxSlippageBps": 30,
  "validForSeconds": 90,
  "reason": "target drift exceeded threshold"
}'
```

Supported environment variables:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `RPC_URL` | yes | none | Ethereum mainnet RPC |
| `PRIVATE_KEY` | yes | none | Hot executor EOA key |
| `TREASURY_ADDRESS` | yes | none | Must match `PRIVATE_KEY` address |
| `EXECUTE` | no | `false` | Must be `true` to send transactions |
| `SIDE` | yes, unless JSON | none | `USDC_TO_WETH` or `WETH_TO_USDC` |
| `AMOUNT_IN` | yes, unless JSON | none | Decimal amount in input token units |
| `POOL_FEE` | no | `500` | Uniswap V3 fee tier |
| `MAX_SLIPPAGE_BPS` | no | `30` | Per-decision slippage tolerance |
| `MAX_ALLOWED_SLIPPAGE_BPS` | no | `100` | Global slippage hard cap |
| `MIN_AMOUNT_OUT` | no | none | Decimal output-token floor |
| `VALID_FOR_SECONDS` | no | `90` | Swap deadline window |
| `MIN_TRADE_USD` | no | `10000` | Reject smaller trades |
| `MAX_TRADE_USD` | no | `50000` | Reject larger trades |
| `MIN_ETH_BALANCE` | no | `0.05` | Minimum gas ETH balance |
| `MAX_FEE_PER_GAS_GWEI` | no | `80` | EIP-1559 max fee cap |
| `MAX_PRIORITY_FEE_GWEI` | no | `3` | EIP-1559 priority fee cap |
| `APPROVAL_POLICY` | no | `exact` | `exact` or `infinite` |
| `CONFIRMATIONS` | no | `2` | Receipt confirmations to wait for |

## What Happens on Each Run

1. Load and validate the decision.
2. Derive the signer from `PRIVATE_KEY` and verify it equals `TREASURY_ADDRESS`.
3. Verify the RPC is Ethereum mainnet and that expected contracts have bytecode.
4. Check executor ETH balance.
5. Resolve the WETH/USDC pool for the selected fee tier through the factory.
6. Check input token balance and pool liquidity.
7. Quote exact input through `QuoterV2`.
8. Compute `amountOutMinimum` from quote/slippage and optional signal floor.
9. Enforce trade size policy.
10. Approve the router if allowance is too low.
11. Simulate `SwapRouter.exactInputSingle`.
12. If `EXECUTE=true`, sign and submit the approval and swap transactions.
13. Wait for the configured confirmations and emit JSON logs.

## What You Are On The Hook For

You own the losses if any of these fail:

- the signal is wrong
- the key leaks
- the VM is compromised
- the RPC lies, lags, censors, or rate-limits you
- a transaction is sandwiched or included after market conditions change
- gas spikes strand your nonce
- USDC or WETH behavior changes or is restricted
- the chosen Uniswap pool is thin or manipulated
- your process runs twice and races its own nonce
- monitoring does not page you for non-routine failures
- accounting does not reconcile actual balances after each trade

Do at least one full dress rehearsal on a mainnet fork and one tiny live trade
before funding the executor with the full treasury.
