# Base vault early-withdrawal fee incident plan

## Decision

The **100 USDC UI minimum is not an incident resolution**. It reduces the chance that users of the current, official web app submit the known bad path, but the fee bug remains live in the deployed contract. Anyone can still call the contract directly, use an old/cached frontend or another integrator, and a minimum amount does not correct an already-executed overcharge. It also does not protect a user whose withdrawal is split into smaller transactions.

Treat the UI limit as a short-lived, client-side mitigation only. The proper resolution is to remove or correct the affected on-chain path (via a verified, safe upgrade only if the vault is genuinely upgradeable) and make affected users whole.

The goal today is to prevent further accidental overcharges on the canonical app and communicate clearly; the goal this week is to make the protocol state correct and remediate every affected withdrawal.

## Ship today: contain, protect, and disclose

1. **Open an incident record and freeze nonessential releases.** Assign an incident owner, engineering owner, and communications owner. Record the affected vault address, deployment block, bug discovery time, intended fee formula, observed formula, and the exact scope that must be queried. Preserve the current frontend build and contract source/verification links.

2. **Determine whether there is an on-chain emergency control.** On a Base mainnet fork, and then through the normal multisig process, check whether the deployed vault has a pause/disable-early-withdrawal control that actually prevents the faulty fee path without trapping normal withdrawals or creating a larger loss-of-access problem.
   - If it exists, is correctly authorized, and fork testing confirms the effect, use it to pause **early withdrawals only** as the strongest immediate containment. Publish the transaction and user impact.
   - Do not invent a pause, use an unreviewed admin action, or perform a live action before the fork test and multisig review. If no safe control exists, proceed with the frontend containment below while acknowledging the contract is still callable.

3. **Release a frontend hotfix immediately.** For the affected vault on Base mainnet:
   - Block early withdrawals below `100 * 10^6` USDC base units at validation and again immediately before transaction submission. Use the token's configured decimals/`parseUnits`, never a floating-point comparison.
   - Make the boundary unambiguous: amounts exactly 100.000000 USDC are permitted only if fork tests prove the erroneous branch is not reached; otherwise require an amount strictly greater than 100 USDC or disable early withdrawals entirely.
   - Prefer a temporary “Early withdrawals are unavailable while we correct a fee-calculation issue” state over inviting users to work around it by changing amount. If product insists on the minimum, display it as a temporary safeguard and show the computed fee and net received before confirmation.
   - Prevent transaction submission while the value is invalid; include a clear explanation and link to the incident notice. Do not silently round a user-entered amount up to 100 USDC.
   - Ensure the normal withdrawal/maturity path is unaffected, distinguish it in the UI, and retain the standard switch-network / approve / execute flow. No approval is needed for a withdrawal-only action.

4. **Test and deploy the hotfix as a production frontend release.** Use a Base fork with the live vault address and USDC to exercise: 99.999999, 100.000000, 100.000001 USDC; decimal input and locale handling; existing connected wallets; direct deep links; mobile; wrong network; and normal/mature withdrawals. Confirm the deployed production build, CDN/cache behavior, public URL, and build/version identifier. Set a short cache lifetime or invalidate the affected route so the safeguard reaches users promptly.

5. **Publish a factual incident notice and support workflow.** State that a fee-calculation defect can overcharge early withdrawals below the threshold; that funds in the vault are not at risk based on current evidence; which action is temporarily restricted; and that affected users will be reimbursed. Avoid saying the UI change fixes the contract. Pin the notice in the app and community channels, give support a response template, and provide a monitored contact method.

6. **Start a reconciliation dataset.** From the deployment block through containment, index every early-withdrawal event/transaction and calculate, for each transaction: user, amount, actual fee, correct fee using the intended formula in USDC base units, and excess charged. Reproduce the calculation independently from event logs, transaction input, and state where necessary. Store the source block range, formula version, and a reviewable CSV/JSON artifact. Do not rely solely on the frontend analytics.

7. **Monitor until the on-chain fix is live.** Watch early-withdrawal calls, reverted UI submissions, support tickets, and any direct calls after the notice. Maintain a public status update cadence. If direct calls continue, escalate from the 100-USDC gate to fully disabling early withdrawals in the official UI and prioritize an on-chain pause/upgrade decision.

## Ship this week: correct the protocol and reimburse users

1. **Classify the deployed vault before choosing remediation.** Verify proxy/implementation addresses, admin and timelock owners, upgrade authority, storage layout, pause controls, withdrawal accounting, and whether any external contracts integrate the vault. This is a go/no-go review, not an assumption based on the stack.
   - **If safely upgradeable:** prepare a minimal implementation upgrade that changes only the fee-scale calculation. Include a storage-layout diff, initializer/reinitializer analysis, access-control test, fork simulation against live state, multisig/timelock execution plan, and source verification of the new implementation. A proxy upgrade can preserve vault balances and token allowances, but only after these checks prove it is safe.
   - **If immutable or upgrade safety is not proven:** deploy a new, audited vault and a migration path. Keep the old vault in the safest available state (pause faulty early withdrawals if possible). The migration plan must specify how positions, lock times, rewards, and accounting move; whether users must approve the new vault; and how the old vault is retired. Do not claim that a frontend guard eliminates the need for redeployment.

2. **Implement the fixed formula with a regression suite.** Add tests for the precise failing values and fee boundaries, including sub-100-USDC values, 99.999999/100/100.000001 USDC, minimum nonzero token units, maximum practical amounts, fee caps, rounding direction, zero fee cases, partial withdrawals, repeated withdrawals, and invariant checks that the user receives the expected net amount. Use explicit USDC decimal constants and `mulDiv`-style integer arithmetic; no floats. Run Foundry unit, fuzz, and invariant tests, plus a Base-fork integration test against the live token and vault state.

3. **Perform focused independent review.** Have a reviewer who did not author the patch inspect the formula, units, rounding, upgrade/migration code, access controls, and all funds-flow changes. Reconcile the intended economic specification with the code, not merely with the old tests. Obtain the required multisig sign-offs and document the exact calldata and expected state changes.

4. **Execute the on-chain remediation under change control.** Announce the maintenance window, run the final fork rehearsal using the exact production calldata, execute through the authorized multisig/timelock, verify the new contract/implementation on BaseScan immediately, and publish transaction links and the deployed bytecode/version. For a migration, deploy only after the same test/review gates and make the migration UI explicit about each approval and transaction; never use infinite approvals.

5. **Deploy the matching frontend and validate live.** Update contract configuration through the normal Scaffold-ETH deployment artifacts/configuration rather than manually editing auto-generated `deployedContracts.ts`. Use Scaffold contract hooks, display human-readable USDC values with `formatUnits` and submit with `parseUnits`. On mainnet, use a controlled small-value test wallet to confirm correct fee, net amount, transaction status, and event/accounting results. Check both the replacement path and all normal withdrawal paths.

6. **Reimburse the excess fees.** Freeze the reconciliation at a published cutoff after the permanent fix. Independently review totals and addresses, then distribute exactly the excess USDC from a controlled multisig (or publish a Merkle claim contract only if its added complexity has been reviewed and is warranted). Publish the methodology, affected transaction IDs, per-address amount, total, cutoff, and payment transaction IDs. Do not require an affected user to pay gas or complete a migration merely to receive reimbursement.

7. **Close only after verification.** Confirm no faulty fee calls can occur through the corrected supported contract path, reconcile vault/token balances and reimbursement totals, monitor for 48–72 hours, and issue a post-incident report. Include root cause, timeline, affected count/amount, remediation, testing gaps, and preventive controls (unit-aware fee library, boundary tests, release checklist, independent economic-parameter review, and on-chain circuit-breaker runbook).

## Ordered execution summary

1. Declare incident; preserve evidence and establish owners.
2. Fork-test any existing pause/early-withdrawal disable control; execute it via multisig only if safe.
3. Deploy the official-UI containment: preferably disable early withdrawals; at minimum, hard-block the affected sub-100-USDC inputs with correct six-decimal handling and explicit warnings.
4. Test the deployed frontend and invalidate caches; publish the incident notice.
5. Begin event-based reconciliation and active monitoring.
6. Determine upgradeability and select either a minimal audited upgrade or a migration.
7. Build the fixed formula, regression/fuzz/invariant tests, and Base-fork rehearsal; obtain independent review and required approvals.
8. Execute, verify, and live-test the on-chain remediation; update the frontend configuration.
9. Reimburse all historical overcharges from the reviewed reconciliation.
10. Monitor, reconcile, and publish the post-incident report.

## Success criteria

Today’s frontend minimum is successful only as a temporary reduction in accidental exposure on the official site. The incident is resolved only when the faulty on-chain behavior is no longer reachable for supported users (by a proven-safe upgrade, replacement/migration, or a durable pause), affected users have been made whole, and the remediation has been independently tested and verified on Base.
