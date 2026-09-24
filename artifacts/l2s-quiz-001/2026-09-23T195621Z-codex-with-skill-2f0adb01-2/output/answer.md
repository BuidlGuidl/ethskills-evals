# Runbook: sweep CELO from Celo to the Ethereum treasury

## Summary

Use the Celo native bridge path for the normal monthly sweep. Celo is now an OP Stack Ethereum L2, so a Celo-to-Ethereum transfer is an optimistic-rollup withdrawal: initiate on Celo, prove on Ethereum after the withdrawal is included in an L2 output, wait the 7-day challenge period, then finalize on Ethereum. The CELO is not usable while it is in this withdrawal lifecycle.

For the current 180,000 CELO sweep, and later for a $2M sweep, treat the canonical bridge as the default security path. It is slow but has the least extra counterparty risk. If finance needs same-week arrival, the process must change; the canonical bridge cannot reliably satisfy that requirement.

Sources checked:

- Celo L2 launch: https://forum.celo.org/t/celo-l2-mainnet-is-live-an-l2-for-the-real-world-secured-by-ethereum/10692
- Celo launch details and CELO native-bridge model: https://forum.celo.org/t/returning-home-to-ethereum-the-launch-of-celo-l2-mainnet/10466
- OP Stack withdrawal lifecycle: https://specs.optimism.io/protocol/withdrawals.html
- OP Stack withdrawal guide and timing: https://viem.sh/op-stack/guides/withdrawals
- Celo bridge community guidance toward the native bridge / Superbridge: https://forum.celo.org/t/help-issue-using-the-optics-bridge-from-ethereum-to-celo/10938

## What Actually Happens

The operator starts with CELO in the ops wallet on Celo. The target is the Ethereum mainnet treasury wallet controlled by the custodian.

The bridge withdrawal creates a cross-chain message. On Celo, the ops wallet gives up the CELO. On Ethereum, no CELO arrives yet. Once the Celo withdrawal is included in an L2 output that Ethereum can verify, someone submits a proof transaction on Ethereum. After the 7-day OP Stack challenge period, someone submits a finalization transaction on Ethereum. Finalization releases or mints the corresponding Ethereum-side CELO to the specified recipient, which should be the treasury wallet.

The Celo signer and the Ethereum gas payer do not have to be the same account. The ops wallet must sign the Celo-side withdrawal. The Ethereum prove and finalize transactions can be sent by an operator or relayer wallet with ETH for gas. The custodian treasury wallet does not need to sign unless the custodian requires some internal receipt workflow.

## Expected Timing

Plan on this service level for the canonical bridge:

| Stage | Typical time | Operator action required |
| --- | ---: | --- |
| Preflight and approval | 30-60 minutes | Yes |
| Initiate withdrawal on Celo | Minutes | Yes, Celo signer |
| Wait until proof is available | Usually under 1 hour; monitor bridge UI | No, then yes |
| Prove withdrawal on Ethereum | One Ethereum transaction | Yes, L1 gas payer |
| Challenge period | 7 calendar days | No transaction, monitor only |
| Finalize withdrawal on Ethereum | One Ethereum transaction | Yes, L1 gas payer |
| Custodian visibility / reconciliation | Same block to 30 minutes after finalization | Yes, verify |

Operational SLA: assume the funds are in flight for 7 days plus 1-3 hours. Calendar SLA should be 8 days. For close planning, reserve 10 calendar days so weekends, holidays, high L1 gas, bridge UI issues, or custodian indexing delays do not become close blockers.

If finance means "kick off on the last business day and show in the following month close package by business day 5," the canonical bridge is too slow. If they only need the funds before the following month-end close, the canonical bridge is fine.

## Monthly Runbook

### Preflight, morning of the last business day

1. Confirm the approved route is the Celo native bridge, using an approved interface such as Superbridge for Celo or an internally reviewed script. Do not use old Optics/Wormhole routes for this treasury sweep unless treasury, security, and finance explicitly approve that different risk model.

2. Confirm addresses from the treasury allowlist:
   - Source: Celo ops wallet.
   - Destination: Ethereum mainnet treasury wallet.
   - L1 gas payer: operator wallet or Safe with enough ETH for prove and finalize.
   - Token: CELO, Celo to Ethereum mainnet.

3. Confirm the custodian can display and account for Ethereum mainnet CELO. Do this before the first production sweep with a small test withdrawal. For the 180,000 CELO run, send a small test amount first if the route has not already been tested end to end with this exact treasury wallet.

4. Check balances and gas:
   - Ops wallet has the sweep amount plus enough CELO left behind for Celo gas.
   - L1 gas payer has enough ETH for two Ethereum transactions, with a buffer for high gas.
   - Do not sweep the ops wallet to absolute zero; leave a defined CELO gas reserve.

5. Check bridge and network status:
   - Celo RPC and explorer are healthy.
   - Ethereum mainnet is healthy.
   - The bridge UI shows the Celo to Ethereum route for CELO.
   - No public incident, bridge pause, or custodian deposit issue is open.

6. Capture the accounting snapshot:
   - CELO balance before transfer.
   - Amount to sweep.
   - USD valuation source and timestamp, if finance needs month-end valuation.
   - Expected destination wallet.
   - Operator and approver names.

### Stage 1: initiate withdrawal on Celo

1. Open the approved bridge route.
2. Select source chain `Celo`, destination chain `Ethereum mainnet`, token `CELO`.
3. Enter the Ethereum treasury wallet as the recipient. Prefer direct delivery to treasury rather than sending to an operator wallet and forwarding.
4. Enter the approved amount. For the first large run, consider splitting into a small test amount and the main amount. For regular monthly sweeps after successful testing, one transaction is simpler to reconcile.
5. Have a second operator verify chain, token, amount, and recipient before signing.
6. Sign the Celo transaction from the ops wallet or ops Safe.
7. Record:
   - Celo transaction hash.
   - Amount.
   - Recipient.
   - Bridge route.
   - Initiation timestamp.

At this point, the money is in flight. It should no longer be counted as available in the Celo ops wallet, and it is not yet available in the Ethereum treasury.

### Stage 2: prove withdrawal on Ethereum

1. Monitor the bridge UI or script until the withdrawal is ready to prove. For OP Stack withdrawals this is normally after the relevant L2 output is available on Ethereum; budget up to about an hour before escalating.
2. When the bridge shows `Ready to prove`, submit the prove transaction on Ethereum from the L1 gas payer.
3. Record:
   - Ethereum prove transaction hash.
   - Proof timestamp.
   - Earliest finalization time shown by the bridge.

The 7-day challenge period starts after the proof step. Put the earliest finalization time on the treasury close calendar with an owner assigned.

### Stage 3: challenge-period monitoring

No transaction is normally required during the 7-day challenge period.

Daily checks:

1. Confirm the withdrawal remains visible in the bridge UI.
2. Confirm the bridge status has not changed to failed, invalidated, or requiring a re-prove.
3. Confirm the expected finalization time.
4. Keep enough ETH in the L1 gas payer for finalization.
5. Keep finance updated that funds are in-flight, not missing.

If the proof becomes invalid because an output root changed, re-prove the withdrawal and restart the finalization timer shown by the bridge.

### Stage 4: finalize withdrawal on Ethereum

1. At or after the finalization time, open the same bridge withdrawal record.
2. Submit the finalize transaction on Ethereum from the L1 gas payer.
3. Wait for Ethereum confirmation.
4. Confirm an Ethereum mainnet CELO transfer or balance increase in the treasury wallet.
5. Confirm the custodian UI/indexing shows the CELO. If the on-chain transfer is complete but the custodian UI lags, escalate to the custodian with the transaction hash.
6. Record:
   - Ethereum finalize transaction hash.
   - Final received amount.
   - Treasury wallet balance after receipt.
   - Timestamp visible to custodian.

### Reconciliation Evidence

Save these artifacts in the monthly close folder:

- Approval ticket or signer approval record.
- Celo initiation transaction hash.
- Ethereum prove transaction hash.
- Ethereum finalize transaction hash.
- Before and after balances for ops wallet and treasury wallet.
- Bridge UI status screenshot or exported bridge record.
- Custodian receipt screenshot or statement entry.
- FX/market-price support used by finance.

## Controls for Large Sweeps

For $2M/month, add these controls:

1. Maintain a bridge route allowlist approved by security and treasury.
2. Use a two-person verification before every signature.
3. Use exact-amount approvals if the bridge asks for ERC-20 approval; revoke unused allowances after the run.
4. Run a small test withdrawal after any bridge UI change, custodian address change, Safe policy change, or Celo bridge upgrade.
5. Set a maximum single-transaction size. If treasury policy requires tranching, split the sweep into two or more withdrawals and reconcile each separately.
6. Pre-fund the Ethereum gas payer before month-end; do not discover missing ETH during the prove or finalize step.
7. Keep a written escalation path for bridge issues, Celo RPC issues, and custodian indexing issues.

## If Finance Needs Same-Week

Do not promise same-week settlement through the canonical Celo native bridge. The 7-day challenge period is part of the OP Stack security model.

Use one of these changed operating models instead:

1. Custodian or exchange route. Send CELO from the Celo ops wallet to a regulated custodian or exchange that supports Celo-network CELO deposits, then withdraw Ethereum-mainnet CELO to the treasury wallet. This can settle same day to a few business days, but it introduces counterparty, compliance-review, deposit-limit, withdrawal-limit, and operational risks. For $2M, pre-clear limits and run a test well before close.

2. Fast bridge or intent route. Use a fast bridge only if it explicitly supports Celo to Ethereum CELO for the required size, with acceptable fees, liquidity, and security review. These routes can settle in minutes or hours because a liquidity provider fronts the destination funds and later settles the slow bridge in the background. The tradeoff is additional smart-contract, relayer, liquidity, and route risk. For $2M, require treasury/security approval, quote checks, route caps, and tranching.

3. Pre-funded treasury inventory. Keep enough CELO on Ethereum mainnet at the custodian to satisfy close visibility immediately. At month-end, finance books an internal transfer or allocation to the treasury inventory, while ops replenishes that inventory through the canonical bridge over the following week. This is usually the best compromise if finance needs same-week reporting but security wants canonical-bridge settlement.

4. Change the asset only if finance agrees. If finance only needs USD value at the custodian rather than CELO specifically, sell CELO under the treasury execution policy and move the resulting asset through a faster supported rail. That is a different treasury action and needs tax, accounting, and market-risk approval.

Recommended same-week policy: use pre-funded Ethereum CELO inventory for close visibility, then replenish via the canonical bridge. Use the custodian/exchange route only when inventory is insufficient. Treat fast bridges as exceptional for treasury-sized sweeps unless security has approved the specific route and size.
