# Celo-to-Ethereum CELO Sweep Runbook

## Decision

For the regular monthly close, use the Celo native bridge to withdraw CELO from Celo to the Ethereum mainnet treasury wallet. This is the most appropriate route for 180,000 CELO today and for a likely $2M sweep because it uses Celo's canonical OP Stack bridge instead of a liquidity bridge or market maker.

Celo is now an Ethereum L2. CELO on Celo is the L2 native asset; withdrawing through the native bridge releases the Ethereum L1 ERC20 CELO token to the recipient. The Celo docs list the Ethereum L1 CELO token as `CeloTokenProxy` at `0x057898f3C43F129a17517B9056D23851F124b19f`.

## Timing

Plan on about 7 days plus operator latency.

The withdrawal has three transactions:

1. Initiate the withdrawal on Celo.
2. Prove the withdrawal on Ethereum once the withdrawal is provable. The Celo guide notes this can take up to about 2 hours.
3. Finalize the withdrawal on Ethereum after the fault challenge period. Celo mainnet uses `604800` seconds, or 7 days.

Operational SLA: start no later than 09:00 UTC on the last business day, prove the same day when ready, and schedule finalization for 7 days after the proof. The funds are not visible to the Ethereum custodian until the finalization transaction confirms on Ethereum. During the 7-day period, finance should track the amount as "bridge withdrawal pending" with the initiate/prove transaction hashes attached.

## Before Each Monthly Sweep

1. Confirm the treasury receiving address on Ethereum mainnet with the custodian. Confirm they support Ethereum mainnet ERC20 CELO at `0x057898f3C43F129a17517B9056D23851F124b19f`.
2. Confirm the ops wallet balance on Celo and leave a small CELO buffer for Celo gas. Do not sweep the exact full balance.
3. Confirm the operator wallet that will prove/finalize has enough ETH on Ethereum mainnet for two L1 transactions. The L1 signer may be the same wallet or a separate authorized operations wallet, depending on custody policy.
4. Check the bridge status page/UI for paused routes, delayed dispute games, or known incidents. If the native bridge or Celo is paused, do not start the sweep; escalate to treasury, finance, and security.
5. For $2M-sized sweeps, run a small test withdrawal after any wallet, custodian, bridge UI, or automation change. Keep the test amount large enough for the custodian to display but immaterial to finance.

## Monthly Native Bridge Procedure

### T-0: Initiate on Celo

Operator action:

1. Open the approved bridge interface, normally Superbridge Celo Mainnet, or run the approved `viem` OP Stack script.
2. Select origin `Celo`, destination `Ethereum Mainnet`, token `CELO`.
3. Enter the sweep amount.
4. Set the recipient to the Ethereum mainnet treasury wallet, not the operator wallet, unless treasury has explicitly approved an intermediate wallet.
5. Have the required signers review:
   - origin chain: Celo, chain ID `42220`
   - destination chain: Ethereum mainnet
   - token: CELO
   - amount
   - recipient
6. Sign and broadcast the Celo transaction.

Expected result:

The CELO is removed from the ops wallet balance on Celo and the withdrawal message is created. Record the Celo transaction hash, amount, recipient, and timestamp in the close checklist.

### T+0 to T+2 Hours: Prove on Ethereum

Operator action:

1. Monitor the withdrawal until the bridge says it is ready to prove. If using automation, use the OP Stack wait-to-prove/get-time-to-prove flow.
2. Switch to Ethereum mainnet.
3. Submit the prove transaction.
4. Wait for Ethereum confirmation.

Expected result:

The withdrawal proof is posted to Ethereum. Record the Ethereum prove transaction hash and the expected finalization time. This starts the 7-day challenge/finality clock for the withdrawal.

### T+7 Days: Finalize on Ethereum

Operator action:

1. At or after the finalization time, check that the withdrawal is ready to finalize.
2. Submit the finalization transaction on Ethereum mainnet.
3. Wait for confirmation.
4. Confirm the treasury wallet received ERC20 CELO on Ethereum mainnet.
5. Ask the custodian/finance view owner to verify visibility in their system.

Expected result:

The Ethereum mainnet treasury wallet receives CELO. Record the finalization transaction hash and ending treasury balance.

## Reconciliation Artifacts

For each sweep, save:

- close period and approval ticket
- Celo starting balance
- sweep amount
- Celo initiate transaction hash
- Ethereum prove transaction hash
- Ethereum finalize transaction hash
- Ethereum mainnet treasury address
- pre-sweep and post-sweep treasury CELO balances
- any deviation from the target schedule

## Failure Handling

If the withdrawal is not ready to prove after the expected window, check bridge status and Celo/OP Stack incident channels. Superbridge notes that dispute game posting and resolution can be delayed.

If the withdrawal was proven but is not finalizable after 7 days, do not retry blindly with changed parameters. Check whether the withdrawal was invalidated by an upgrade or incident; invalidations can reset the wait period.

If the finalization transaction fails, preserve the revert/error, transaction hash, and bridge UI state, then escalate to engineering/security. The funds should still be represented by the pending withdrawal until it is successfully finalized or explicitly invalidated.

## Accounting Note

The month-end initiation date is not the same as Ethereum treasury receipt date. Native bridge withdrawal creates an in-flight asset for about a week. For finance reporting, treat it as CELO pending bridge settlement from the Celo ops wallet to the Ethereum treasury, supported by the bridge transaction hashes. The custodian will only see it after the Ethereum finalization transaction.

## If Finance Needs Same-Week Settlement

Do not try to make the native Celo-to-Ethereum withdrawal faster; the 7-day challenge period is protocol design, not an operator delay.

Change the process instead:

1. Preferred operational change: sweep on a rolling schedule. Start the bridge 7-10 days before the date finance needs custodian visibility. For month end, sweep weekly or maintain a target mainnet treasury buffer so the close is not waiting on a fresh withdrawal.
2. If funds must arrive on Ethereum in under a week, use a pre-approved fast route only after treasury/security approval. Options include a liquidity bridge/aggregator route, an OTC or market-maker exchange of Celo-side CELO for Ethereum-side CELO, or a regulated exchange/custodian route that accepts Celo deposits and withdraws Ethereum mainnet CELO.
3. For $2M, do not assume a retail bridge route has enough CELO liquidity. Request firm quotes or route simulations, split execution only if treasury approves it, set max fee/slippage limits, and verify counterparty, smart contract, and sanctions/compliance risk.
4. If using a fast bridge or aggregator, record the extra trust assumption: the treasury receives funds from bridge liquidity before the canonical bridge settles in the background. This is faster but less conservative than the native bridge.

Same-week policy recommendation: native bridge remains the default for monthly close; same-week settlement should be an exception path with written approval, a liquidity check, and a maximum acceptable fee/slippage threshold.

## Sources Checked

- Celo docs, "Withdrawing CELO to Ethereum": https://docs.celo.org/home/bridged-tokens/withdrawing-celo-to-ethereum
- Celo docs, "Native Bridge": https://docs.celo.org/operate/specification/native-bridge
- Celo docs, "L1 Contracts": https://docs.celo.org/tooling/contracts/l1-contracts.md
- Celo docs, "Deployments": https://docs.celo.org/operate/specification/deployments
- OP Stack withdrawal specification: https://specs.optimism.io/protocol/withdrawals.html
- Superbridge help on challenge periods and delayed dispute games: https://help.superbridge.app/en/articles/9748424-why-do-i-have-to-wait-multiple-days-to-bridge-to-the-settlement-chain and https://docs.superbridge.app/api-reference/troubleshooting
