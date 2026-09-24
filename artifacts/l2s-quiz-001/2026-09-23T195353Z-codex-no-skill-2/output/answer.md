# CELO Sweep Runbook: Celo to Ethereum Mainnet Treasury

## Recommendation

Use the native Celo-to-Ethereum bridge, exposed through Superbridge, for the normal monthly close. Celo is now an Ethereum L2, and the native exit path is an OP Stack withdrawal from Celo L2 to Ethereum L1. It is the cleanest default for a finance-controlled treasury movement because it does not depend on third-party bridge liquidity.

The tradeoff is timing: a Celo-to-Ethereum withdrawal is a three-transaction flow with a mandatory challenge period. Budget a little over 7 calendar days from kickoff to funds visible in the Ethereum mainnet treasury wallet.

For the current 180,000 CELO balance, run the same process as a production sweep. For a future $2M sweep, do not change the bridge mechanics, but add approvals, dry-run checks, monitoring, and a fallback calendar buffer.

## What Actually Happens

The CELO in the ops wallet is on Celo. CELO on Celo behaves as both the native gas token and an ERC-20-compatible token, so there is no wrap or unwrap step on Celo. On Ethereum mainnet, the treasury receives ERC-20 CELO at the official CeloTokenProxy contract:

`0x057898f3C43F129a17517B9056D23851F124b19f`

The native withdrawal has three stages:

1. Initiate withdrawal on Celo L2.
   The operator submits an L2 transaction from the ops wallet to start the withdrawal to the Ethereum treasury address. After this transaction confirms on Celo, the CELO is no longer available for ordinary spending in the ops wallet, but it is not yet visible to the Ethereum custodian.

2. Prove withdrawal on Ethereum L1.
   Once Celo's L2 output containing the withdrawal has been posted to Ethereum, the operator submits an Ethereum mainnet transaction proving the withdrawal. Celo's developer docs say this wait-to-prove step can take up to about 2 hours.

3. Finalize withdrawal on Ethereum L1.
   After the fault challenge period has passed, the operator submits a final Ethereum transaction. Celo docs state the proof maturity delay / fault challenge period is 604,800 seconds, which is 7 days, on Celo mainnet. Once the finalize transaction confirms, the ERC-20 CELO is in the Ethereum mainnet treasury wallet and should be visible to the custodian if they support that token contract.

## Timing

Expected calendar for a normal close:

| Time | State | Operator action |
| --- | --- | --- |
| T-3 to T-1 business days | Pre-flight | Confirm amount, treasury address, custodian token support, signer availability, Ethereum gas budget, and bridge UI / contract status. |
| Last business day, morning | Initiated | Start the withdrawal from Celo to the Ethereum treasury address. Save transaction hash, amount, source, destination, and screenshots / exports for finance. |
| Same day, usually within 2 hours | Ready to prove | Submit the prove transaction on Ethereum mainnet. Save the Ethereum proof tx hash. |
| T+7 calendar days after proof | Ready to finalize | Submit the finalization transaction on Ethereum mainnet. |
| Immediately after finalization tx confirms | Complete | Verify CELO balance in the treasury wallet using Etherscan / Blockscout and the custodian portal. Notify finance with all three tx hashes. |

Funds are economically in flight from the moment the L2 initiate transaction confirms until the L1 finalize transaction confirms. In practice, plan for 7 days plus up to 2 hours plus Ethereum confirmation time and operator availability. If kickoff is late on the last business day, finalization may land late on the same weekday in the following week, or the next business day if the team only signs during business hours.

This means the monthly-close runbook is workable only if finance accepts that the mainnet treasury wallet will receive the funds roughly one week into the next month. If finance's "next month's books close" means a 3-5 business-day accounting close, the native bridge will miss that SLA unless the sweep is initiated before month-end.

## Monthly Operator Checklist

### Pre-Flight: T-3 to T-1 Business Days

1. Confirm the sweep amount.
   Pull the ops wallet CELO balance on Celo and confirm the amount to sweep with finance. Leave enough CELO behind for normal Celo gas and operational float.

2. Confirm destination.
   Use the allowlisted Ethereum mainnet treasury address from the custodian record. Do not type the address manually. Verify that the custodian can display and custody ERC-20 CELO on Ethereum mainnet, specifically CeloTokenProxy `0x057898f3C43F129a17517B9056D23851F124b19f`.

3. Confirm signer readiness.
   Ensure the ops wallet signers are available for the Celo initiation transaction and the Ethereum signers are available for the prove and finalize transactions. The same person does not need to do every step, but ownership must be assigned before kickoff.

4. Confirm gas.
   The ops wallet needs CELO for the Celo transaction. The Ethereum signing wallet needs enough ETH for the prove and finalize transactions. For large sweeps, pre-fund gas generously so finalization is not delayed by a separate ETH transfer.

5. Confirm bridge route.
   Use Superbridge for the native Celo bridge, or use the internally reviewed script that calls the same native bridge contracts. Confirm the UI shows Celo as source, Ethereum as destination, CELO as asset, and the treasury wallet as recipient.

6. Optional but recommended for the first close and after any tooling change.
   Run a small test withdrawal several weeks before the production close, using the exact same source wallet class, destination wallet class, and approval workflow.

### Stage 1: Initiate on Celo

1. Open Superbridge or the approved bridge script.
2. Select source chain Celo and destination chain Ethereum mainnet.
3. Select CELO.
4. Enter the approved treasury recipient address.
5. Enter the approved sweep amount.
6. Have the reviewer verify chain, asset, amount, source, and destination.
7. Submit the Celo transaction from the ops wallet.
8. Record the Celo transaction hash and Celo block timestamp in the close ticket.

At this point, tell finance: "Sweep initiated; funds are in native bridge withdrawal flow and are not yet available in mainnet custody."

### Stage 2: Prove on Ethereum

1. Monitor the withdrawal until it is ready to prove. The docs describe this as potentially taking up to 2 hours.
2. When ready, submit the prove transaction on Ethereum mainnet.
3. Record the Ethereum proof transaction hash.
4. Calculate the earliest finalization time as proof confirmation time plus 7 calendar days.
5. Put that finalization time on the treasury operations calendar with an owner and backup owner.

At this point, tell finance: "Withdrawal proved on Ethereum; mandatory 7-day challenge period is running."

### Stage 3: Finalize on Ethereum

1. At or after the earliest finalization time, return to Superbridge or the approved bridge script.
2. Submit the finalization transaction on Ethereum mainnet.
3. Wait for Ethereum confirmation.
4. Verify the treasury address received ERC-20 CELO on Ethereum mainnet.
5. Confirm the custodian portal sees the token balance. If the custodian does not auto-display CELO, provide the contract address and finalization tx hash to custodian support.
6. Notify finance with the amount, final received balance, and all transaction hashes.

Only mark the sweep complete after the Ethereum treasury wallet balance has increased and the custodian can see or reconcile the token.

## Controls For Larger Sweeps

For a $2M sweep, keep the native bridge path but add these controls:

1. Require written approval from finance and treasury before Stage 1.
2. Require a second operator to verify the destination address, chain direction, and token contract.
3. Use a close ticket that stores the source wallet, destination wallet, amount, expected receive token, Celo initiate tx, Ethereum prove tx, Ethereum finalize tx, and timestamps.
4. Consider splitting operationally into two or more tranches only if internal policy requires it. Splitting reduces single-transaction operational risk, but every tranche still has the same 7-day challenge period and creates more transactions to track.
5. Set gas alerts for Ethereum before the proof and finalization windows.
6. Do not rely on a custodian display alone as proof of receipt. Verify on-chain balance for the treasury address and reconcile that to the custodian portal.

## Failure And Escalation Notes

If the initiate transaction fails, no withdrawal has started. Fix gas, approvals, wallet policy, or UI issues and retry.

If the withdrawal is initiated but not yet ready to prove, monitor the bridge status and Celo / Ethereum network status. The funds are in flight; do not attempt a second full-size withdrawal unless treasury explicitly approves the duplicate liquidity risk.

If proving fails, confirm the output is ready, the Ethereum wallet has enough ETH, and the operator is using the correct withdrawal. Retry the prove transaction after the issue is resolved.

If finalization is attempted before maturity, wait until the 7-day challenge period has fully elapsed and retry.

If the finalization transaction succeeds but the custodian does not show the balance, verify the ERC-20 transfer on Ethereum first, then open a custodian support ticket with the token contract and finalization transaction hash.

## If Finance Needs Same-Week Settlement

The native bridge should not be represented as same-week. Its 7-day challenge period is the core security model, so same-week settlement requires changing the operating model, not just asking the operator to move faster.

The viable options are:

1. Start earlier.
   If finance only needs month-end visibility but can estimate the amount, initiate the sweep at least 8 calendar days before the reporting deadline, then true-up residual CELO in the next cycle.

2. Use a reviewed fast bridge or liquidity router.
   Celo docs list third-party bridge / routing options such as Layerswap, Squid, Jumper, Wormhole / Portal, Axelar, Chainlink CCIP, and others. These can be faster because they use external liquidity or messaging networks, but they introduce provider, liquidity, smart-contract, fee, slippage, and route-risk considerations. For $2M, this needs treasury / risk approval, route testing, limits, and probably tranche sizing.

3. Use a centralized venue or custodian-supported Celo deposit.
   If the custodian or an exchange supports deposits from Celo and withdrawals of ERC-20 CELO on Ethereum, send CELO from the ops wallet to that venue and withdraw to the Ethereum treasury. This can be same-day or same-week, but it changes the risk from native bridge risk to counterparty, compliance, withdrawal-limit, and operational risk.

4. Maintain an Ethereum mainnet CELO buffer.
   Keep enough CELO in the Ethereum treasury to satisfy close reporting, then replenish it through the native bridge on the normal 7-day cycle. This gives finance same-week visibility without taking third-party bridge risk every month, but it ties up liquidity on mainnet.

For same-week $2M sweeps, the recommended path is either a pre-funded Ethereum buffer plus native bridge replenishment, or a formally approved OTC / custodian / exchange route. A random fast bridge route should not become the default treasury process without risk review and a tested incident plan.

## Sources To Recheck Quarterly

- Celo "Withdrawing CELO to Ethereum" docs: https://docs.celo.org/home/bridged-tokens/withdrawing-celo-to-ethereum
- Celo bridge overview / Superbridge link: https://docs.celo.org/home/bridged-tokens/bridges
- Celo bridge provider list: https://docs.celo.org/tooling/bridges/bridges
- Celo L1 contract addresses, including CeloTokenProxy and OptimismPortalProxy: https://docs.celo.org/tooling/contracts/l1-contracts
- CELO token duality: https://docs.celo.org/home/protocol/celo-token
