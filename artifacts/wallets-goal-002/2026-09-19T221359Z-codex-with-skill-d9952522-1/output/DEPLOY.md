# Mainnet Rebalance Deployment

This bot is intentionally built as a hot-wallet executor, not as the whole
treasury. A cloud VM key that can transfer the full $400k can lose the full
$400k. Keep principal in a multisig or custody account and fund this signer only
with the float you are willing to lose before you notice and revoke it.

## Contracts and Accounts

Ethereum mainnet only, chain ID `1`.

Contracts this code touches:

- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Uniswap V3 Factory: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- Uniswap V3 QuoterV2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- Uniswap V3 SwapRouter02: `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`

Accounts:

- `TREASURY_SAFE`: the real treasury. Use a Safe or equivalent threshold wallet.
  A solo builder can still use a threshold with hardware keys on separate
  devices. This account holds the $400k principal.
- `HOT_EXECUTOR`: the unattended signer used by `rebalance.ts`. It holds bounded
  WETH/USDC float and ETH for gas. It is the swap recipient. It must not be the
  only key controlling treasury principal.
- `OPERATOR`: you, using hardware-backed keys to refill, drain, rotate, or
  revoke the hot executor.

Address sources checked on 2026-09-19: Uniswap v3 deployments
<https://developers.uniswap.org/docs/protocols/v3/deployments> and the Uniswap
governance deployment list
<https://gov.uniswap.org/t/official-uniswap-v3-deployments-list/24323>, Circle's
USDC Ethereum page <https://www.circle.com/multi-chain-usdc/ethereum>, and WETH
address reference <https://weth.io/>.

## What Must Exist First

1. A threshold treasury wallet exists and is funded.
   - Recommended minimum for solo custody: `2-of-3` or `2-of-4` hardware keys
     stored separately.
   - The VM key is not an owner that can meet the threshold.
   - Refilling the hot executor, raising its cap, changing owners, and draining
     principal all require treasury signatures.

2. A hot executor account exists.
   - It is new and has never had its key pasted into chat, tickets, logs, shell
     history, CI output, or a repo.
   - It is funded with only the operating float, for example `$75k-$100k` if the
     largest routine trade is `$50k`.
   - It has enough ETH for gas, initially at least `0.05 ETH`.
   - It has no approvals except the exact approvals this script creates to
     `SwapRouter02`.

3. The VM can sign, but the key is not in git.
   - Best: use KMS/HSM/Vault and adapt the viem account layer to that signer.
   - Acceptable for an early hot-wallet deployment only if you accept the risk:
     inject `PRIVATE_KEY` as a runtime secret owned by the service user.
   - `.env`, private keys, logs, and process dumps are excluded from backups and
     source control.

4. RPC and transaction path are production-grade.
   - Use a paid Ethereum mainnet RPC with archive-quality reliability.
   - Use a private transaction endpoint or relay when possible; public mempool
     swaps of `$10k-$50k` can be sandwiched.
   - Alert on stuck nonces, reverted transactions, high gas, and unexpected
     balance changes.

5. The signal process emits a narrow decision.
   - Decision schema:

     ```json
     {
       "id": "2026-09-19T22:30:00Z-001",
       "side": "usdc_to_weth",
       "amount": "25000",
       "maxSlippageBps": 30,
       "reason": "target allocation drift"
     }
     ```

   - `amount` is in the input token's human units: WETH for `weth_to_usdc`, USDC
     for `usdc_to_weth`.
   - The signal must be idempotent outside this script. Do not emit the same
     decision repeatedly after a timeout unless you have reconciled the nonce and
     balances.

## Install and Dry Run

```bash
npm install

export MAINNET_RPC_URL="https://..."
export QUOTE_ONLY_ADDRESS="0xYourHotExecutorAddress"
export REBALANCE_DECISION='{"side":"usdc_to_weth","amount":"1000","maxSlippageBps":30}'

npm run rebalance
```

Dry run behavior:

- Verifies chain ID `1`.
- Finds live WETH/USDC Uniswap V3 pools at fee tiers `0.05%`, `0.30%`, and `1%`.
- Quotes through `QuoterV2`.
- Selects the route with the highest output.
- Checks notional against `MAX_TRADE_USDC`, default `50000`.
- Checks hot wallet exposure against `MAX_HOT_WALLET_USDC`, default `75000`, when
  a signer or quote-only address is available.
- Prints the exact router, token addresses, selected pool, quote, slippage floor,
  and gas fee environment.

## Live Run

Set these for execution:

```bash
export MAINNET_RPC_URL="https://..."
export PRIVATE_KEY="0x..." # hot executor only
export EXPECTED_SIGNER="0xYourHotExecutorAddress"
export EXECUTE_MAINNET="true"
export AUTONOMOUS_MAINNET_ACK="I_ACCEPT_LOSS_OF_HOT_WALLET_FUNDS"
export MAX_TRADE_USDC="50000"
export MAX_HOT_WALLET_USDC="75000"
export MAX_SLIPPAGE_BPS="30"
export MAX_FEE_PER_GAS_GWEI="80"
export MIN_ETH_FOR_GAS="0.05"
export REQUIRED_CONFIRMATIONS="2"
export REBALANCE_DECISION='{"id":"run-001","side":"usdc_to_weth","amount":"25000","maxSlippageBps":30}'

npm run rebalance
```

Execution path:

1. Load the decision.
2. Validate mainnet chain ID and signer address.
3. Quote WETH/USDC across Uniswap V3 fee tiers.
4. Enforce per-trade and hot-wallet caps.
5. Refuse to run if gas exceeds `MAX_FEE_PER_GAS_GWEI`.
6. Approve exactly `amountIn` from the input token to `SwapRouter02`, clearing an
   old allowance first if needed.
7. Simulate `SwapRouter02.exactInputSingle`.
8. Sign and submit the approval transaction if needed.
9. Sign and submit the swap transaction.
10. Wait for confirmations and print the receipt.

The swap recipient is always the hot executor. This avoids accidentally routing
proceeds to an arbitrary address supplied by the signal layer.

## Runtime Responsibilities

You are on the hook for:

- Choosing the hot-wallet loss budget. If you set `MAX_HOT_WALLET_USDC=400000`
  and fund the VM signer with the whole treasury, compromise of that signer can
  take the whole treasury.
- Monitoring every tx hash, receipt status, and balance delta.
- Watching token approvals. Any nonzero approval that was not created by this
  script should be treated as an incident.
- Managing nonces. One process should own the hot executor nonce, or you need a
  nonce manager with persistent locking.
- MEV risk. Slippage protection limits bad fills but does not prevent failed
  transactions, information leakage, or sandwich attempts.
- RPC correctness and availability. A bad or delayed RPC can cause stale quotes
  and stuck operation.
- Stablecoin and protocol risk. USDC can freeze addresses; WETH, Uniswap V3, and
  Ethereum mainnet have smart-contract and market risks.
- Legal, tax, accounting, and compliance obligations from autonomous trading.
- Incident response. You need a practiced path to drain the hot executor, revoke
  allowances, rotate the key, stop the service, and reconcile balances.

## Incident Runbook

Immediate response:

1. Stop the VM service.
2. From the treasury hardware keys, do not refill the hot executor.
3. From a clean machine, transfer remaining WETH/USDC/ETH out of the hot
   executor if the key is still trusted enough to act.
4. Revoke WETH and USDC allowances from the hot executor to `SwapRouter02`.
5. Rotate the hot executor key and update `EXPECTED_SIGNER`.
6. Reconcile every transaction since the last known-good balance.

Treat the key as burned if it appears in a prompt, support ticket, log, git
commit, shell history, monitoring payload, crash dump, or shared terminal.

## Production Hardening

Before increasing size:

- Run with `$1k` decisions for at least several days.
- Confirm approval behavior leaves no stale unlimited allowance.
- Add durable decision IDs and persistent nonce/receipt storage.
- Add price sanity checks from an independent oracle or exchange feed.
- Add private transaction submission.
- Add alerts for no trade when expected, trade when not expected, high slippage,
  unexpected fee tier, quote failure, receipt failure, hot-wallet cap breach, and
  balance drift.
- Add a daily manual treasury reconciliation.
