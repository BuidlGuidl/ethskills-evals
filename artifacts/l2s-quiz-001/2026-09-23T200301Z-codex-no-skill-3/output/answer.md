# Celo-to-Ethereum Treasury Sweep Runbook

## Executive Summary

Use the native Celo-to-Ethereum bridge for the normal monthly close. Celo is now an Ethereum L2 built on the OP Stack, so a withdrawal from Celo to Ethereum is not an instant token transfer. It is an optimistic-rollup withdrawal:

1. Initiate the withdrawal on Celo.
2. Wait until the withdrawal can be proven on Ethereum.
3. Prove it on Ethereum.
4. Wait through the challenge period.
5. Finalize it on Ethereum.

For close planning, assume the funds are in flight for about **7 to 8 calendar days** from initiation to final Ethereum receipt, assuming the operator proves and finalizes promptly and Ethereum gas is available. The protocol challenge period is the gating item; no operator can shorten it on the native bridge.

This is acceptable for a monthly sweep if finance can tolerate roughly one week of bridge receivable. It is not a good same-week settlement tool. If finance needs same-week funding, use a pre-funded mainnet buffer, an OTC/custodial settlement path, or convert to native USDC on Celo and move USDC with Circle/CCTP instead of trying to force the native CELO bridge to be faster.

## What Is Moving

Source asset: CELO on Celo mainnet, currently about 180,000 CELO in the ops wallet.

Destination: Ethereum mainnet treasury wallet controlled or observed by the custodian.

Default destination asset: CELO represented on Ethereum mainnet, not CELO still sitting on the Celo network. Before the first production sweep, confirm with the custodian that the Ethereum treasury wallet supports and displays CELO on Ethereum mainnet, and confirm the exact token identifier they expect.

Do not send CELO directly from the Celo ops wallet to the Ethereum treasury address as a normal transfer. Celo and Ethereum can use the same `0x...` address format, but a normal Celo transfer remains on Celo. The custodian watching Ethereum mainnet will not see it there.

## Systems And Accounts Needed

Prepare these before the close window:

- Ops wallet on Celo with the CELO to sweep plus a small CELO gas reserve.
- Ethereum mainnet signing wallet or Safe able to pay L1 gas for the prove and finalize transactions.
- Treasury recipient address on Ethereum mainnet, verified by finance and the custodian.
- Access to the selected bridge UI or direct bridge tooling. For normal operations, use the Celo bridge path exposed through Celo Mondo/Superbridge or an internally reviewed direct integration with the OP Stack standard bridge.
- Block explorers for both chains for evidence capture.
- Internal approval ticket with amount, recipient, route, signer, and expected timeline.

For a sweep that may grow to $2M, run a small production test first, then set a policy limit for single-transaction size. Native bridge contract risk is generally preferable to liquidity bridge risk for large transfers, but operational mistakes become expensive at this size.

## Monthly Close Timeline

Target operating assumption: initiate on the last business day by a fixed cutoff, prove as soon as available, finalize seven days after proof eligibility, and reconcile immediately.

Recommended SLA: treat the funds as available on Ethereum **T+8 calendar days**. If finance closes books before that, either start the sweep earlier or use the same-week approach below.

### T-5 To T-2 Business Days: Preflight

Operator:

1. Confirm the sweep amount from finance. Leave enough CELO in the ops wallet for Celo gas and any product operating minimum.
2. Confirm the destination Ethereum mainnet treasury address from a controlled source, not from chat or copied historical notes.
3. Confirm the custodian can see the destination asset on Ethereum mainnet.
4. Check bridge status and recent incidents. If the bridge UI reports delays, pauses, invalidations, or route changes, escalate before initiating.
5. Confirm the Ethereum signing wallet has enough ETH for two L1 transactions: prove and finalize. Budget conservatively because Ethereum gas can spike.
6. Create the approval ticket with amount, token, source wallet, destination wallet, bridge route, expected initiation time, expected prove time, expected finalization time, and rollback note: after initiation, there is no simple cancellation path.

Approver:

1. Verify amount and destination address.
2. Approve the transfer route and signer set.
3. For large sweeps, require a second human to independently verify the bridge URL, token, chain direction, and recipient before signing.

### T0, Last Business Day: Initiate Withdrawal On Celo

Operator:

1. Open the approved bridge interface.
2. Select source chain: Celo.
3. Select destination chain: Ethereum mainnet.
4. Select token: CELO.
5. Enter the approved amount.
6. Enter the Ethereum treasury wallet as the recipient if the bridge UI supports an explicit recipient. If the UI only withdraws to the connected wallet, connect the treasury-controlled wallet or use reviewed tooling that supports the correct recipient.
7. Review the route. It should show the native bridge or OP Stack native bridge path for the monthly process.
8. Confirm the withdrawal transaction on Celo.
9. Record the Celo transaction hash, amount, timestamp, source, destination, and bridge route in the close ticket.

Accounting status after this step: CELO has left normal operating availability on Celo but has not arrived on Ethereum. Treat it as a bridge receivable or in-transit asset.

### T0 + About 1 Hour: Prove Withdrawal On Ethereum

Native OP Stack withdrawals cannot finalize immediately. First the withdrawal must become provable on Ethereum. Bridge UIs usually show this as a `Prove` action once the relevant L2 state/dispute game data is available.

Operator:

1. Monitor the bridge activity page or internal bridge monitor until the withdrawal is ready to prove.
2. Connect the Ethereum mainnet signer with ETH for gas.
3. Click `Prove`, or run the reviewed prove transaction through internal tooling.
4. Confirm the Ethereum transaction.
5. Record the Ethereum prove transaction hash and the displayed challenge-period end time.
6. Set a calendar reminder for finalization at the end of the challenge period plus an operational buffer.

Accounting status after this step: still in transit. The proof is posted, but the funds are not yet claimable on Ethereum.

### T0 + 7 Days + Buffer: Finalize On Ethereum

After the challenge period has elapsed, the withdrawal can be finalized. This is the transaction that causes the Ethereum-side bridge to release or mint the destination representation to the treasury wallet.

Operator:

1. Return to the bridge activity page or internal tooling.
2. Confirm the withdrawal shows `Finalize`, `Claim`, or equivalent.
3. Confirm the recipient and amount one more time.
4. Submit the finalize transaction on Ethereum mainnet.
5. Record the Ethereum finalize transaction hash.
6. Verify the CELO balance increase in the Ethereum treasury wallet using the custodian portal and an Ethereum block explorer.
7. Update the close ticket with final received amount, final timestamp, and all transaction hashes.

Accounting status after this step: no longer in transit. The asset should be visible to the Ethereum mainnet custodian.

## Expected Time In Flight

Normal expected duration:

- Celo initiation: seconds to minutes for confirmation.
- Time until prove is available: often around an hour, but use the bridge UI estimate.
- Challenge period after proof: about 7 calendar days for OP Stack native withdrawals.
- Finalization: one Ethereum transaction after the challenge period.

Operational planning number: **7 to 8 calendar days**.

Planning buffer for monthly close: **10 calendar days** if the accounting deadline is firm, because bridge UIs can see delayed dispute games, Ethereum gas spikes, signer availability issues, bridge pauses, or invalidation events that reset or extend the wait.

The largest scheduling mistake would be assuming "last business day" means "available early next week." If the sweep is initiated on a Friday, the finalization point is usually the following Friday or later, not Monday.

## Controls For A $2M Sweep

Use the native bridge as the default for large monthly sweeps because it avoids relying on third-party fast-bridge liquidity. Add these controls before size grows:

- Run a small test withdrawal through the exact route and recipient.
- Use allowlisted bridge URLs and, ideally, transaction simulation.
- Require two-person verification of chain direction, token, recipient, and amount.
- Cap a first large run below the full amount, then increase after successful reconciliation.
- Keep enough ETH on the Ethereum signer for prove and finalize under high gas.
- Maintain an internal dashboard or checklist showing `initiated`, `proven`, `challenge ends`, `finalized`, and `reconciled`.
- Do not bridge during known Celo or OP Stack upgrade windows unless engineering signs off.
- Define who is on call for finalization if the seven-day mark falls on a weekend or holiday.

## Failure And Delay Handling

If the prove button is not available after the bridge estimate:

1. Check the bridge activity page and explorer status.
2. Confirm the initiation transaction succeeded on Celo.
3. Check for known bridge, dispute-game, or network incidents.
4. Escalate to engineering if the transaction remains unprovable beyond the published estimate.

If the challenge period completes but finalize is unavailable:

1. Confirm the prove transaction succeeded on Ethereum.
2. Confirm the challenge-period end timestamp.
3. Check whether the withdrawal was affected by an invalidation or upgrade event.
4. Escalate to engineering and the bridge support channel with both transaction hashes.

If Ethereum gas is too high:

1. The funds remain in transit until finalization.
2. Finance should decide whether to pay the gas to meet close or wait for lower gas.
3. For close-critical sweeps, pay gas and document the variance.

## If Finance Needs Same-Week Settlement

The native bridge is the wrong primitive for same-week settlement if same-week means less than seven calendar days from kickoff to Ethereum receipt. Keep the native bridge for safety, but change the treasury process.

Preferred same-week design: maintain a pre-funded Ethereum mainnet buffer. Treasury keeps enough CELO, ETH, or USDC on Ethereum to satisfy the close deadline. On close day, finance books the mainnet transfer from the buffer immediately. The Celo CELO sweep still runs through the native bridge in the background and replenishes the buffer a week later. This preserves native-bridge security while meeting finance's timing requirement.

If finance is willing to receive USD exposure rather than CELO exposure, use a stablecoin route. Swap CELO to native USDC on Celo using an approved DEX, RFQ, or OTC desk, then move native USDC from Celo to Ethereum using Circle/CCTP or Circle Mint where supported by the company's setup. This can settle in minutes to hours rather than a week, but it introduces execution price, slippage, liquidity, and tax/accounting considerations because CELO is being sold.

If finance requires CELO on Ethereum mainnet same week and there is no buffer, use an OTC desk, market maker, exchange, or custodian that can receive CELO on Celo and deliver CELO or the agreed treasury asset on Ethereum. For $2M, get an RFQ, settlement instructions, counterparty approval, and compliance signoff before sending funds. Treat this as counterparty settlement, not as a trust-minimized bridge withdrawal.

Fast bridges or aggregators may be useful for small or urgent transfers, but do not assume they can handle $2M of CELO with acceptable slippage, limits, or risk. Before using one, the operator must capture a live quote, route, fees, liquidity limit, estimated arrival time, bridge contract/provider, and failure policy, then get finance and risk approval.

## Recommended Policy

For normal monthly close, initiate the native Celo-to-Ethereum withdrawal no later than the last business day only if the books close at least eight calendar days later. If the books close earlier, move the operational deadline earlier or fund the Ethereum treasury from a buffer.

For same-week requirements, do not promise native-bridge timing. Use a pre-funded mainnet buffer as the standing process, with OTC/Circle/CCTP as approved contingency routes depending on whether finance wants CELO or USD exposure.

## References Checked

- Celo L2 specification: https://specs.celo.org/
- Celo L2 mainnet announcement: https://forum.celo.org/t/returning-home-to-ethereum-the-launch-of-celo-l2-mainnet/10466
- OP Stack withdrawal specification: https://specs.optimism.io/protocol/withdrawals.html
- OP Stack bridge/predeploy specification: https://specs.optimism.io/protocol/predeploys.html
- Superbridge withdrawal guide: https://help.superbridge.app/en/articles/9748050-how-to-bridge-off-a-rollup-to-the-settlement-chain-withdraw
- Superbridge Celo supported-chain page: https://docs.superbridge.app/overview/supported-chains/celo
- Circle USDC on Celo: https://www.circle.com/multi-chain-usdc/celo
