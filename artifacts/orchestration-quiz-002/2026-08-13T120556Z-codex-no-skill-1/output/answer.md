# Early-withdrawal fee incident plan

## Decision

Ship a **100 USDC UI minimum immediately as a temporary guardrail**, but do not
describe it as the fix or as resolving the incident. It only prevents the
affected path for people using our current frontend. It cannot stop a user (or
an integrator) from calling the Base vault directly, using an older/cached
frontend, or submitting a transaction with a modified client. The deployed
contract still computes the fee incorrectly, so the incident is not resolved
until the on-chain path is corrected (or early withdrawals are disabled on
chain) and affected customers are made whole.

The exact `100 USDC` boundary should be verified against the faulty formula
before release, including 6-decimal USDC units and rounding. If a withdrawal
of exactly 100 USDC is safe, permit it; otherwise set the guard one smallest
USDC unit above the proven-safe threshold. Do not split a withdrawal into
multiple sub-threshold withdrawals.

## What we ship today (containment)

1. **Open an incident and preserve evidence.** Record the vault address,
   deployed implementation/proxy addresses and source commit, the intended and
   observed formulas, when the bug first became live, and the Base block range.
   Assign an incident owner and establish a change approver separate from the
   implementer.

2. **Determine the strongest safe on-chain containment.** Check the verified
   contract and admin configuration for a pause, an early-withdrawal toggle,
   or an upgrade mechanism. If there is an already-authorized, tested switch
   that disables *only early withdrawals*, execute it through the normal
   multisig/timelock procedure and announce it. This is stronger than a UI
   restriction. Do not rush an unreviewed admin transaction or use a broad
   pause unless necessary to stop ongoing overcharges.

3. **Release the frontend guard.** For the early-withdrawal state, block an
   amount below the verified safe threshold before allowance/transaction
   creation, show the threshold and a clear explanation, and disable the submit
   action. Keep normal withdrawals unaffected. Add a persistent withdrawal-page
   notice that early withdrawals below the threshold are temporarily unavailable
   while a contract issue is being remediated. Deploy through the normal
   production path, purge/update cached assets, and verify against Base mainnet
   with a wallet that the UI neither creates nor signs a blocked transaction.

4. **Publish an honest user notice and support path.** State that early
   withdrawals below the threshold may be overcharged, that the UI restriction
   is temporary, and that the team is calculating refunds. Include the vault
   address, incident start time, status page/support channel, and a warning not
   to use alternative interfaces to bypass the guard. Do not ask users for
   approvals, seed phrases, or off-chain signatures to obtain a refund.

5. **Start the reimbursement ledger.** Index every early-withdrawal event from
   deployment (or the proven introduction block) through containment. For each
   transaction, reproduce the fee using the deployed bytecode/formula, compute
   the intended fee using the intended formula and the same rounding rule, and
   store `overcharge = actual - intended` by recipient and transaction hash.
   Have a second person independently reconcile the totals against on-chain
   USDC transfers/events. Preserve a CSV/merkle input and its hash.

6. **Monitor and triage.** Alert on every qualifying early withdrawal/direct
   vault call, daily reconcile new overcharges, and have support proactively
   contact affected wallets where appropriate. Decide and document whether the
   protocol treasury, fee recipient, or insurance reserve funds the refunds.

## What we ship this week (permanent remediation)

1. **Choose the remediation route from the actual deployment architecture.**
   - If the vault is a proxy with a governance-authorized upgrade route, deploy
     a corrected implementation and perform a tightly scoped upgrade.
   - If it is immutable, deploy a replacement vault and a migration adapter or
     a migration flow that preserves user accounting as far as possible.
   - If neither can be safely delivered this week, keep early withdrawals
     disabled (where enforceable) or keep the UI warning/guard while explicitly
     acknowledging the residual direct-call risk. This is a risk acceptance,
     not a resolution.

2. **Implement the fee correction with unit-safe arithmetic.** Write the fee
   in terms of explicit USDC base units (USDC has 6 decimals), use named
   constants for fee precision, and avoid multiplying/dividing in an order that
   changes rounding unexpectedly. Specify the rounding direction and ensure it
   never charges above the intended fee. Add a hard maximum-fee invariant if it
   is compatible with the product terms.

3. **Test against production-like cases.** Add unit and fuzz/property tests for
   amounts below, equal to, and above 100 USDC; 1 base unit; values near all
   fee/lock-period boundaries; partial withdrawals; and multiple withdrawals.
   Assert actual fees equal the specified fee in base units and cannot exceed
   it. Fork Base mainnet at a fixed block, exercise representative existing
   positions, and test the upgrade/migration, authorization, storage layout
   (for a proxy), and emergency/admin paths. Run Foundry tests, static analysis,
   and a focused independent review before signing a production transaction.

4. **Deploy with staged verification.** Publish and verify the corrected
   contract on Base, have a separate reviewer match the deployed bytecode and
   constructor/upgrade calldata to the approved artifact, then execute through
   the multisig/timelock. Test a small real transaction, monitor events and
   balances, and retain a rollback/pause plan where the architecture supports
   it. Do not silently alter the old contract's frontend address until the new
   flow has passed these checks.

5. **Make users whole.** After the ledger reconciliation is signed off, send
   refunds in USDC directly to the withdrawal recipient (or provide a
   permissionless Merkle claim contract if the recipient count/cost warrants
   it). Publish transaction hashes and a privacy-conscious reconciliation
   method. Cover all confirmed historical overcharges, including any that occur
   during containment, then leave a short claim/support window for edge cases.

6. **Close only after verification.** Update the frontend to the corrected
   vault/implementation, remove the temporary minimum only after confirming the
   on-chain calculation, archive the incident report and root cause, and add
   release controls: decimal/unit review checklist, fee-boundary test vectors,
   independent review for economic math, and monitoring for fee rate anomalies.

## Ordered execution checklist

1. Confirm the faulty threshold and rounding in USDC base units from verified
   production code; identify whether an on-chain early-withdrawal pause/upgrade
   exists.
2. Freeze nonessential vault/frontend releases; assign incident and approver
   roles; preserve deployment and event evidence.
3. If safely available, disable early withdrawals on chain; otherwise proceed
   with the frontend restriction while documenting residual direct-call risk.
4. Deploy and verify the UI guard, notice, and telemetry; publish the user
   communication.
5. Begin the historical and ongoing overcharge ledger plus independent
   reconciliation.
6. Implement, test, independently review, and deploy the appropriate
   upgrade/replacement/migration route.
7. Verify on-chain behavior with real, small transactions; route the frontend
   to the permanent solution.
8. Issue and reconcile refunds; publish the completion/update and postmortem.

