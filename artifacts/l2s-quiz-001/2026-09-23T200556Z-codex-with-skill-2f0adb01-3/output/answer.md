# Runbook: sweep CELO from Celo to Ethereum mainnet treasury

## Executive summary

Celo is now an OP Stack Ethereum L2, so moving CELO from Celo to Ethereum mainnet is an L2-to-L1 withdrawal. For the normal monthly sweep, use the native bridge, preferably through the approved Superbridge Celo UI or an internal script using the OP Stack withdrawal flow. This is the lowest-risk path for a high-value treasury movement, but it is not fast.

Expected in-flight time for the native path:

- Celo initiation transaction: minutes, after internal confirmations.
- Time until the withdrawal can be proven on Ethereum: up to about 2 hours.
- Fault challenge period after the proof transaction: 7 days, or 604,800 seconds.
- Ethereum finalization transaction and confirmations: minutes once the 7 days have elapsed.

Operationally, assume the money is in flight for about 7 days plus 2-4 hours, and longer if the operator is late proving or finalizing. If finance literally wants to start on the last business day and receive funds before a normal WD+3 to WD+5 accounting close, the canonical bridge will not meet that calendar. Either start the sweep at least 8 calendar days before the required receipt date, maintain a mainnet treasury buffer, or approve a same-week liquidity route.

## What actually happens

CELO is native gas money on Celo, and it is also ERC-20 compatible. On Ethereum mainnet, CELO is an ERC-20 token. The withdrawal moves value from the Celo L2 representation back to the Ethereum mainnet CELO token balance for the treasury wallet.

The native withdrawal is a three-transaction optimistic rollup flow:

1. Initiate on Celo: the operator submits a withdrawal from the ops wallet on Celo. The withdrawal records a message from Celo to Ethereum and removes the CELO from normal use on Celo.
2. Prove on Ethereum: after the relevant Celo output is available on Ethereum, the operator submits an Ethereum transaction proving that the withdrawal really occurred on Celo.
3. Finalize on Ethereum: after the 7-day fault challenge period, the operator submits an Ethereum transaction finalizing the withdrawal. Once this confirms, the Ethereum treasury wallet receives mainnet CELO.

Important consequence: the 7-day clock starts after the proof is accepted on Ethereum, not merely after the Celo initiation transaction. Prove the withdrawal the same day it is initiated.

The Ethereum proof and finalization transactions can be submitted by an approved relayer/operator wallet; they do not have to be submitted by the destination treasury wallet. The recipient and amount are fixed by the Celo initiation transaction, so the destination must be right before the first signature.

## Systems and addresses to verify before first use

- Source chain: Celo Mainnet, chain ID `42220`.
- Destination chain: Ethereum Mainnet, chain ID `1`.
- Normal UI: `https://superbridge.app/celo`.
- Celo explorer: `https://celoscan.io`.
- Ethereum explorer: Etherscan or the custodian's approved Ethereum explorer.
- Ethereum CELO token: Celo docs list `CeloTokenProxy` on Ethereum mainnet as `0x057898f3C43F129a17517B9056D23851F124b19f`.
- Ethereum Celo portal: Celo docs list `OptimismPortalProxy` as `0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC`.
- Ethereum Celo standard bridge: Celo docs list `L1StandardBridgeProxy` as `0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe`.

Do not trust addresses copied from this runbook forever. At the start of each monthly close, verify the UI URL and contract addresses against the current Celo docs, an internal allowlist, and the custodian's supported asset list.

## Operator prerequisites

Before the close window:

- Confirm the exact Ethereum mainnet treasury address with finance and the custodian. Treat "same 0x address" as insufficient; confirm the destination chain and asset display.
- Confirm the custodian can display and account for mainnet CELO at the Ethereum CELO token address.
- Confirm the ops wallet balance on Celo and choose the amount. For the current sweep, this is approximately `180,000 CELO`; leave enough CELO behind for Celo gas and operating needs.
- Confirm the signing policy for the ops wallet. For a sweep trending toward $2M, use multisig or custodian policy controls, not a single hot key.
- Ensure the Ethereum signer or relayer wallet has enough ETH for the prove and finalize transactions.
- Prepare a ticket with amount, source address, destination address, approved route, expected timing, and approvers.
- For the first production run, or after any tooling change, send a small test withdrawal first and complete the full prove/finalize cycle before sending the main amount.

## Monthly native-bridge procedure

### 1. Preflight on the last scheduled sweep day

Timing: morning UTC on the scheduled sweep day. If finance needs receipt by a specific book-close date, this day must be at least 8 calendar days before that receipt deadline.

Operator actions:

- Open the approved bridge route from a clean browser/profile or run the approved internal script.
- Verify source is Celo and destination is Ethereum.
- Verify token is CELO.
- Verify destination is the Ethereum mainnet treasury wallet.
- Check Celo balance in the ops wallet.
- Check ETH balance in the Ethereum relayer/signer wallet.
- Check for Celo bridge or sequencer incidents and Ethereum mainnet congestion.
- Record starting balances for the ticket.

Control point:

- Obtain required approval for the final amount before signing.
- For a $2M sweep, use a test transaction or split as "small test plus main transfer", not many arbitrary chunks. Each chunk creates its own prove/finalize work.

### 2. Initiate withdrawal on Celo

Timing: immediately after approval.

Operator actions:

- In Superbridge or the internal tool, enter the sweep amount and destination treasury address.
- Review the transaction carefully: source chain Celo, destination chain Ethereum, token CELO, amount, recipient.
- Sign the Celo transaction from the ops wallet.
- Wait for the Celo transaction to confirm.
- Save the Celo transaction hash and bridge withdrawal identifier in the ticket.

Status after this step:

- The funds are in flight.
- The CELO should no longer be treated as available operating cash on Celo.
- The Ethereum treasury has not received the CELO yet.

### 3. Wait until the withdrawal can be proven

Timing: usually same day; allow up to about 2 hours.

Operator actions:

- Monitor the bridge UI or script for proof readiness.
- If using code, use the OP Stack helper equivalent of `getTimeToProve` or `waitToProve`.
- Keep the ticket open and set an alert for the expected proof-ready time.

Control point:

- Do not wait until the next day if the proof is available. The 7-day challenge period does not start until the Ethereum proof transaction is mined.

### 4. Prove withdrawal on Ethereum

Timing: as soon as the bridge marks the withdrawal as ready to prove.

Operator actions:

- Switch to Ethereum mainnet in the bridge UI or run the proof step in the internal tool.
- Submit the prove transaction on Ethereum.
- Pay gas in ETH from the approved Ethereum signer/relayer.
- Wait for Ethereum confirmation.
- Save the Ethereum proof transaction hash and timestamp in the ticket.
- Calculate the finalization eligibility time: proof confirmation time plus 7 days.

Status after this step:

- The withdrawal is proven on Ethereum.
- The funds are still not spendable in the treasury wallet.
- The withdrawal is waiting through the 7-day fault challenge period.
- The destination address and amount cannot be changed by the proof operator.

### 5. Wait through the challenge period

Timing: 7 full days after the proof transaction is accepted on Ethereum.

Operator actions:

- Set calendar reminders for 24 hours before, 1 hour before, and at finalization eligibility.
- Monitor the bridge UI or script for finalization readiness.
- Monitor official Celo and Superbridge status channels for any bridge pause or incident.
- Keep enough ETH in the Ethereum signer/relayer for finalization gas.

Status during this period:

- The funds are in flight and cannot be used on either chain.
- CELO market price exposure remains. This bridge operation does not convert CELO into dollars or stablecoins.

### 6. Finalize withdrawal on Ethereum

Timing: immediately after the 7-day challenge period expires, or at the next approved operations window.

Operator actions:

- Open the same withdrawal in the approved bridge UI or run the finalize step in the internal tool.
- Submit the finalize transaction on Ethereum.
- Wait for Ethereum confirmation.
- Confirm the Ethereum treasury wallet's CELO ERC-20 balance increased by the expected amount.
- Confirm the custodian UI sees the balance.
- Save the finalize transaction hash, final balances, gas costs, and completion timestamp.

Status after this step:

- The sweep is complete.
- Finance can account for the CELO in the Ethereum mainnet treasury wallet.
- The finalization operator only relayed the already-proven withdrawal; they did not take custody of the CELO.

### 7. Reconcile and close the ticket

Operator actions:

- Record source and destination balances before and after.
- Record all transaction hashes: Celo initiation, Ethereum proof, Ethereum finalization.
- Record exact CELO amount, Celo gas paid, Ethereum ETH gas paid, and USD valuation methodology required by finance.
- Attach explorer links and custodian confirmation.
- Note any delay between proof readiness and proof submission, and between finalization readiness and finalization.

## Timing example

If the operator initiates at 10:00 UTC on Monday:

- Celo initiation should confirm shortly after 10:00 UTC Monday.
- Proof may become available by about 12:00 UTC Monday.
- If the proof confirms at 12:15 UTC Monday, finalization becomes eligible at approximately 12:15 UTC the following Monday.
- The treasury receives CELO after the finalization transaction confirms on Ethereum.

Therefore, a last-business-day initiation usually lands in the mainnet treasury around the same weekday in the following week. If books close earlier than that, the sweep must start earlier or use an exception route.

## Operational controls for larger sweeps

For the current `180,000 CELO`, and especially before this becomes a `$2M` sweep:

- Use the native bridge as the default route because it avoids third-party bridge liquidity and credit risk.
- Move signing to a multisig, MPC wallet, or custodian workflow with dual approval.
- Maintain an allowlist for the treasury address, Superbridge URL, Ethereum CELO token, portal, and bridge contracts.
- Keep a standing ETH gas buffer on the Ethereum signer.
- Rehearse the full flow on Celo Sepolia or with a very small mainnet amount.
- Do not approve unlimited token allowances unless the route requires it and security has approved it. For Celo-to-Ethereum native CELO withdrawal this should normally be a value withdrawal, not an ERC-20 approval workflow on Celo.
- Decide whether treasury wants CELO exposure. If finance ultimately wants USD, define the swap venue and accounting treatment separately; bridging alone only changes chain custody.

## If finance needs same-week receipt

The native bridge cannot guarantee same-week receipt when "same-week" means initiate and receive within a few business days. The 7-day challenge period is the core security mechanism of the optimistic withdrawal path.

Use one of these changes:

1. Move the calendar earlier.
   - Keep the native bridge.
   - Start the monthly sweep at least 8 calendar days before the required treasury receipt date.
   - This is the best answer if finance can change the close checklist but still wants the lowest bridge risk.

2. Maintain a mainnet treasury buffer.
   - Keep one expected month of CELO, or the finance-approved USD equivalent, already on Ethereum mainnet.
   - Replenish the buffer with the native bridge on a rolling schedule.
   - This gives finance same-week visibility without using a fast bridge for every close.

3. Use an approved fast-liquidity or exchange route as an exception.
   - Examples of bridge/provider categories listed by Celo include Superbridge for native bridging and providers such as Squid, Jumper, LayerZero, Wormhole/Portal, Allbridge, Axelar, and Chainlink CCIP. Availability for CELO, Ethereum mainnet output, size, and fees must be checked at execution time.
   - For a $2M sweep, prefer an institutional RFQ/liquidity provider, approved exchange, or custodian-supported route over a retail bridge UI.
   - Require quotes from at least two providers, explicit fees/spread, max size, estimated settlement, destination asset, destination chain, failure handling, sanctions/KYC review, and legal/security approval.
   - Run a small test first, then tranche the production amount according to provider liquidity and risk limits.
   - Keep the native bridge as the fallback for any remainder.

Same-week route tradeoff:

- Faster settlement comes from someone else fronting liquidity or using a different trust model.
- That adds smart-contract, liquidity, relayer, provider, compliance, and operational risk.
- For high-value treasury movement, document the exception each time unless the route has gone through a formal vendor and security review.

## References

- Celo docs, "Withdrawing CELO to Ethereum": `https://docs.celo.org/home/bridged-tokens/withdrawing-celo-to-ethereum`
- Celo docs, "Bridging to and from Celo": `https://docs.celo.org/home/bridged-tokens/bridges`
- Celo docs, "Bridge Providers": `https://docs.celo.org/tooling/bridges/bridges`
- Celo docs, "L1 Contracts": `https://docs.celo.org/tooling/contracts/l1-contracts`
- Celo docs, "Network Information": `https://docs.celo.org/build-on-celo/network-overview`
- OP Stack spec, "Withdrawals": `https://specs.optimism.io/protocol/withdrawals.html`
