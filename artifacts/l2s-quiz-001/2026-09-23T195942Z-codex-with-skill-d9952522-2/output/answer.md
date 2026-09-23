# Runbook: sweeping CELO from Celo to Ethereum mainnet treasury

As of 2026-09-23, Celo is an Ethereum L2 built on the OP Stack. The treasury sweep should use Celo's native bridge to Ethereum, not a third-party wrapped-token bridge, unless finance explicitly accepts faster settlement with extra counterparty/liquidity risk.

The asset that arrives on Ethereum mainnet is the L1 CELO ERC-20, `CeloTokenProxy` at `0x057898f3C43F129a17517B9056D23851F124b19f`. Have the custodian whitelist/display that token before the first close. The Celo-side token is native CELO on chain ID `42220`.

## Expected timing

Plan on the money being in flight for about 7 calendar days after the L1 prove transaction, plus the time until the withdrawal is ready to prove and any operator delay.

Current live portal parameters checked on 2026-09-23:

- `proofMaturityDelaySeconds`: `604800` seconds, or 7 days.
- `disputeGameFinalityDelaySeconds`: `302400` seconds, or 3.5 days.

The 7-day proof maturity gate is the binding one today. The important operational point is that the 7-day clock starts when the operator proves the withdrawal on Ethereum, not when they initiate it on Celo. If the operator initiates on Friday but proves on Monday, finalization moves to the following Monday.

For monthly close, initiate on the last business day and prove as soon as the withdrawal becomes provable. Finalize immediately when the portal reports it is finalizable. This should land in the Ethereum treasury roughly 7-8 calendar days after initiation under normal conditions, which is well before the next month's close.

## Prerequisites

1. Confirm wallet addresses.
   - Source: Celo ops wallet holding the revenue CELO.
   - Destination: Ethereum mainnet treasury wallet controlled/observed by the custodian.
   - Operator: account or multisig able to sign the Celo initiation transaction.
   - Relayer/operator on Ethereum: account with ETH for the prove and finalize gas. This can be the same operator or automation.

2. Confirm custodian support.
   - The custodian must display Ethereum mainnet CELO at `0x057898f3C43F129a17517B9056D23851F124b19f`.
   - Do a small test withdrawal before the first production close, then reconcile both the Ethereum transaction and the custodian UI.

3. Confirm the live bridge route and parameters.
   - Use Celo's native bridge contracts or a native-bridge UI/tooling that calls those contracts.
   - Re-read readiness/finality with tooling at runtime, for example viem OP Stack actions such as `getWithdrawalStatus`, `getTimeToProve`, `proveWithdrawal`, `getTimeToFinalize`, and `finalizeWithdrawal`.
   - Do not hard-code the 7-day value without checking; bridge parameters can change.

4. Size and controls.
   - For the current 180,000 CELO and future roughly $2M sweeps, use the canonical bridge path for the routine monthly sweep. It has no bridge liquidity limit or swap slippage in the way a fast bridge or exchange route does.
   - Leave a small CELO reserve in the ops wallet for Celo gas and operational recovery; do not sweep the absolute full balance.
   - Require the normal treasury approval threshold before initiation. Treat the L2 initiation as the point where funds leave operating control.

## Monthly close procedure

### T-2 to T-1 business days: prepare

1. Finance provides the sweep amount in CELO and the mainnet treasury address.
2. Operator verifies:
   - Celo ops wallet balance.
   - Destination address on Ethereum mainnet.
   - Celo chain ID `42220`.
   - L1 CELO token address `0x057898f3C43F129a17517B9056D23851F124b19f`.
   - Ethereum operator account has enough ETH for prove/finalize.
3. Create the close ticket with:
   - Amount.
   - Source and destination addresses.
   - Required approvers.
   - Expected initiate, prove, and finalize windows.
   - Links to Celo and Ethereum explorers once transactions exist.

### T, last business day: initiate withdrawal on Celo

1. Using the native bridge flow, initiate an L2 to L1 withdrawal of CELO from the ops wallet to the Ethereum treasury wallet.
2. Under the hood, the transaction calls the OP Stack withdrawal path on Celo. For CELO, Celo's native bridge documentation points to `L2ToL1MessagePasser.initiateWithdrawal`; the withdrawal is later proven and finalized through the Ethereum `OptimismPortalProxy`.
3. Save the Celo transaction hash and receipt in the close ticket.
4. Reconcile immediately:
   - The Celo transaction succeeded.
   - The withdrawal event exists in the receipt.
   - The amount and L1 target address match the approval.
   - The ops wallet balance decreased, except for the intended gas reserve.

Status after this step: funds are in flight. They are no longer available for normal Celo ops use, but they are not yet visible in the Ethereum treasury wallet.

### T plus readiness, usually same day or next run window: prove on Ethereum

1. Monitor the withdrawal until it is ready to prove. Use tooling that reads the Celo/OP Stack bridge state rather than a calendar guess.
2. When ready, submit the L1 prove transaction to Celo's `OptimismPortalProxy` on Ethereum mainnet: `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC`.
3. Save the Ethereum prove transaction hash in the close ticket.
4. Record the exact finalization ETA returned by tooling such as `getTimeToFinalize`.

Status after this step: the proof is recorded on Ethereum and the 7-day maturity clock is running. Nothing arrives in the treasury yet.

### T plus about 7 days after prove: finalize on Ethereum

1. When the bridge reports the withdrawal is finalizable, submit the L1 finalize transaction to the same `OptimismPortalProxy`.
2. Confirm the finalize transaction succeeded.
3. Reconcile on Ethereum:
   - Treasury wallet received the expected CELO amount.
   - Token is `0x057898f3C43F129a17517B9056D23851F124b19f`.
   - No unexpected token wrapper or third-party representation was received.
4. Ask finance/custodian to confirm the balance is visible in the mainnet treasury account.
5. Close the ticket with all transaction hashes and timestamps.

Status after this step: the sweep is complete and custodian-visible on Ethereum mainnet.

## Operator schedule

For each monthly close:

- Last business day, morning UTC: final approval and parameter check.
- Last business day, same day: initiate the Celo withdrawal.
- Same day and then every few hours until ready: check proof readiness.
- As soon as ready: prove on Ethereum. Do not defer to the next business day unless policy requires it, because every delay pushes final receipt.
- Seven days after prove: finalize as soon as tooling reports finalizable. If that lands on a weekend or holiday, use treasury on-call coverage or automation.
- Same day as finalization: reconcile and notify finance.

## Failure and delay handling

- If initiation fails, no withdrawal exists; fix the issue and restart after re-approval if amount/destination changes.
- If prove is attempted too early, it should revert or fail simulation; wait for bridge status to show prove-ready.
- If finalization is attempted too early, it should revert or fail simulation; wait for finalizable status.
- If Ethereum gas spikes, the funds remain in flight until finalized. Finance should decide whether to pay the gas premium or wait.
- If Celo bridge contracts are paused by the guardian, stop and escalate. Do not route a production treasury sweep through an unapproved bridge just to keep the calendar.
- If the custodian cannot see the token after finalization, verify the Ethereum token contract and transaction first; this is often a custodian asset-display/whitelist issue, not a failed bridge.

## If finance needs same-week settlement

The canonical Celo to Ethereum withdrawal cannot reliably satisfy a same-week requirement if "same-week" means fewer than 7 calendar days from kickoff to custodian-visible funds. That waiting period is part of the optimistic-rollup security model.

Use one of these operating models instead:

1. Pre-funded mainnet buffer.
   - Keep at least one expected sweep amount of CELO, or the desired treasury asset, in the Ethereum mainnet treasury.
   - Finance recognizes the same-week close against the pre-funded mainnet balance.
   - The Celo canonical withdrawal runs in the background to replenish the buffer.
   - This keeps the canonical bridge trust model and avoids fast-bridge liquidity risk, but ties up working capital.

2. OTC or market-maker settlement.
   - Contract with a counterparty that receives CELO on Celo and delivers CELO on Ethereum mainnet, or delivers the treasury's preferred mainnet asset.
   - For a $2M sweep, pre-negotiate size, spread, settlement deadline, failed-settlement remedies, and exact token contract.
   - This buys speed by accepting counterparty credit, operational, and pricing risk.

3. Exchange/custodian route.
   - Deposit CELO from Celo to a venue that supports Celo deposits, then withdraw mainnet CELO or another mainnet treasury asset.
   - This may be same-day or next-day once limits and compliance checks are in place.
   - Risks are venue custody, withdrawal limits, network support mismatches, and possible token conversion/tax/accounting consequences.

4. Fast bridge or intent route, only after treasury approval.
   - A fast bridge fronts liquidity on Ethereum and later waits out the canonical bridge itself.
   - For CELO at $2M size, check actual route depth and quote quality before relying on it. Long-tail gas tokens are exactly where relayer inventory can be thin.
   - The runbook must name the added trust assumption: the company is relying on the bridge/solver/liquidity provider to pay out correctly before canonical finality.

Recommended same-week answer: use a pre-funded mainnet buffer for the close process, and continue using the canonical Celo bridge monthly to replenish it. Use OTC/exchange/fast bridge only as an exception path with treasury sign-off.

## Sources checked

- Celo Native Bridge documentation: https://docs.celo.org/operate/specification/native-bridge
- Celo L1 contract addresses: https://docs.celo.org/tooling/contracts/l1-contracts
- Celo deployment/network parameters: https://docs.celo.org/operate/specification/deployments
- OP Stack withdrawal specification: https://specs.optimism.io/protocol/withdrawals.html
- viem OP Stack withdrawal actions: https://viem.sh/op-stack/guides/withdrawals
