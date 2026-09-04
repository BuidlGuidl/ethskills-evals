# Base vault withdrawal-fee incident plan

## Decision

A **100 USDC minimum in the UI is not an incident resolution**. It may reduce the number of users who encounter the bad fee through the current web app, but the vault is a public Base mainnet contract: anyone can call its withdrawal function directly, use an older/cached frontend, or use another integrator. It also blocks or delays legitimate withdrawals below 100 USDC and creates a misleading impression that the fee is correct. The incorrect on-chain computation remains active.

Treat the UI restriction only as a clearly labelled, temporary harm-reduction measure while the team disables the faulty on-chain route if that capability exists, then ships a corrected on-chain path. Do not present it as a fix.

## Ship today — contain, inform, and make users whole

1. **Open an incident and preserve evidence.** Name an incident owner and an independent transaction/release approver; record the vault address, implementation address (if proxied), deployment commit, fee parameters, affected function selectors, first bad transaction, and current TVL. Freeze routine feature releases and preserve frontend build/release identifiers and RPC logs.

2. **Confirm scope on a Base mainnet fork before changing production UI.** Reproduce early withdrawals below, at, and above 100 USDC with the actual USDC decimal precision and current contract parameters. Calculate expected versus charged fees and identify every affected transaction from deployment through the containment block. Verify whether the vault is a proxy and whether an existing, correctly configured pause/withdrawal/upgrade role can safely stop *early withdrawals specifically*. Do not assume one exists.

3. **Apply the strongest available on-chain containment, under the project’s multisig/timelock process.**
   - If a tested, authorized pause can stop the faulty early-withdraw path without trapping principal, execute it and publish the transaction.
   - If a safe contract-native configuration can set the early-withdraw fee to zero, and fork tests prove it affects only the intended path, use it as the temporary mitigation. This is preferable to silently overcharging.
   - If neither is possible, state publicly that direct early withdrawals remain vulnerable to overcharge; do not claim the UI has secured the contract.
   - Do not use an emergency key, upgrade, or configuration change that has not been fork-tested and independently reviewed.

4. **Deploy a temporary frontend guard after containment decision.** On Base only, block the affected early-withdraw submission for amounts below 100 USDC (or all early withdrawals if the on-chain route cannot be safely contained). Display a prominent explanation: the restriction is temporary, direct contract calls are not protected by it, and users should wait for the corrected withdrawal route. Enforce the comparison in USDC’s 6-decimal base units, not floating-point UI values; validate client-side immediately before transaction construction; disable the action while pending; and use the normal Scaffold hooks and one-button network/approve/execute flow. Do not edit generated `deployedContracts.ts`.

5. **Publish a factual incident notice and support process.** Include affected behavior, the exact contract address, time window, user action requested, mitigation status, support contact, and commitment to reimburse verified excess fees. Avoid saying funds are “safe” without distinguishing principal safety from incorrect charges. Notify any docs, API, or frontend integrators and pin the notice in the app and community channels.

6. **Prepare reimbursement, but do not send until reconciled.** Build a transaction-level ledger: user, withdrawal tx hash, amount, charged fee, fee expected under the intended formula, excess, and claim/payment status. Have two people reconcile it against Base logs and preserve the calculation inputs. Pay excess USDC from a controlled treasury via a reviewed batch or claims process; publish the methodology and tx hashes. Include affected direct calls, not merely frontend analytics.

7. **Operational checks for today.** Monitor withdrawal events, fee recipient balance changes, frontend error reports, and direct calls to the affected selector. Keep an incident log with decision times and transaction hashes. Remove the temporary UI restriction only after the corrected on-chain route is live and verified.

## Ship this week — correct the protocol, migrate safely, and close the incident

1. **Choose the remediation from verified architecture facts.**
   - **Upgradeable proxy:** implement the minimal corrected implementation and upgrade only through the existing governance/multisig/timelock. Storage-layout compatibility, initializer behavior, role preservation, and implementation verification are release gates.
   - **Immutable vault:** deploy a new corrected vault and a purpose-built migration/withdrawal path; an off-chain UI-only “migration” does not repair users who can still invoke the old vault. If old-vault withdrawal cannot be safely paused, retain an explicit warning and support policy until balances leave it.
   - If an already-authorized parameter change can permanently correct the decimal scale, treat it like an on-chain contract change: fork-test, review, multisig execute, and verify its effects across all fee cases.

2. **Implement the smallest auditable fix in Foundry.** Make token decimals explicit and keep all fee arithmetic in integer base units. Define rounding behavior and bounds for zero, dust, 1 USDC, 99.999999 USDC, 100 USDC, large withdrawals, elapsed-time boundaries, and maximum fee. Use `mulDiv`-style arithmetic where needed to avoid overflow/precision loss. Add a regression test that proves the historical bad case and then proves the corrected fee, plus invariant/fuzz tests that fee never exceeds the configured maximum and cannot overcharge due to scale.

3. **Test against the real state on a Base fork.** Fork at the containment block, impersonate representative stakers and required roles, exercise early and mature withdrawals, deposits, claims/rewards, pausing, upgrades or migration, and fee collection. For a migration, test partial migration, zero balance, repeated migration, approvals/permits, failure recovery, and accounting conservation. The plan must not require fresh USDC approvals where a permit, token transfer authorization, or contract-native migration can safely avoid them; if new approval is unavoidable, disclose it plainly.

4. **Conduct independent review before mainnet execution.** Review the fee formula, decimal assumptions, access controls, proxy storage (if applicable), migration accounting, reentrancy/token-transfer behavior, and every deploy/upgrade calldata value. Obtain a focused external/security review proportionate to the $40k TVL and incident severity. Record sign-off from both technical and operational owners.

5. **Release on Base mainnet with a runbook.** Pre-build and peer-review the exact transactions; use the project multisig/timelock, not a personal deployer. Execute during a published maintenance window, verify the implementation/source immediately, and publish contract addresses, upgrade/migration transactions, and the code commit. Never place private keys, RPC credentials, or API keys in config, scripts, or logs.

6. **Release the production frontend only after on-chain verification.** Point the app to the corrected proxy/vault or migration contract using the normal Scaffold contract configuration generation flow (do not hand-edit generated deployment artifacts). Use a live-wallet smoke test with a small amount on Base: connect/switch network, any required approval, withdraw/migrate, confirmation, balances, event history, and mobile behavior. Then deploy the frontend and confirm the public build serves the expected chain ID and addresses.

7. **Close out transparently.** Remove temporary guards only when the old bad path is no longer usable or is clearly isolated. Complete reimbursements, give users a migration deadline and support route, maintain monitoring through the period, and publish a postmortem: cause, affected time range/count/value, reimbursement total, containment timeline, and preventive controls (decimal test matrix, fork release gate, two-person review for fee changes, and monitoring alert for fee/withdrawal ratio anomalies).

## Concrete release order and go/no-go gates

1. Reproduce and quantify on a Base fork; identify proxy/admin/pause capabilities.
2. Fork-test and independently review the exact on-chain containment transaction, if one exists.
3. Execute and verify containment on Base; otherwise escalate the public warning to block all affected early withdrawals in the official app.
4. Deploy the temporary frontend guard and incident banner; notify users/integrators.
5. Reconcile affected fees and approve the reimbursement ledger.
6. Build the minimal contract correction/migration and its Foundry regression, boundary, fuzz, and fork tests.
7. Independent security/operations review; approve exact multisig/timelock calldata and rollback/abort criteria.
8. Execute mainnet upgrade or corrected-vault deployment/migration activation; verify source and live behavior with a small controlled transaction.
9. Release the frontend pointed at the corrected on-chain route; complete production QA.
10. Reimburse, monitor, deprecate/isolate the legacy vault, publish postmortem, and close only after reconciliation.

**Go/no-go:** do not move past step 3 without evidence that the active user path is contained or that users have been clearly warned it is not. Do not move past step 8 without passing fork tests and independent review. A UI minimum alone never satisfies either gate.
