# Base vault fee-decimal incident plan

## Decision

The proposed **100 USDC UI minimum is useful short-term containment for the
official withdrawal form, but it does not resolve the incident.** The fee is
computed in the onchain vault, and anyone can call that withdrawal function
directly (or through another frontend, script, contract, or integration).
It also does not correct fees already charged, nor make the protocol behaviour
match its published terms. Treat the UI limit as a temporary safety rail, never
as the fix.

The immediate objective is to stop the official UI from steering people into
the known-bad range, disclose the limitation, establish the exact scope, and
ship an onchain correction with a safe upgrade/migration and restitution plan.
Do not silently add the threshold: users must understand why a withdrawal is
unavailable and what their alternatives are.

## Ship today — containment and incident operations

1. **Declare the incident and freeze risky changes.** Assign an incident
   owner, engineering owner, communications owner, and a timestamped decision
   log. Preserve the deployed address, implementation address (if proxied),
   deployment commit, verified source, and relevant transaction logs. Do not
   alter fee parameters or deploy an unreviewed patch as an emergency reaction.

2. **Confirm scope from the verified Base deployment.** Independently reproduce
   representative early withdrawals below and at/above 100 USDC on a fork of
   Base, using Base USDC's actual decimals and the current vault state. Calculate
   intended fee, charged fee, and user net amount for boundary values (for
   example 99.99, 100.00, and 100.01 USDC) and determine whether the condition
   is strictly `< 100` or has rounding/`<=` behaviour. Query historical
   withdrawal events/transactions to identify every affected withdrawal,
   overcharge, wallet, time range, and aggregate liability. Have a second
   engineer review the calculation.

3. **Check whether there is a genuine onchain emergency control.** From the
   verified code and admin configuration, establish whether the vault is a
   proxy, whether a tested pause can block early withdrawals, or whether a
   bounded fee setting can be safely corrected without a code upgrade. Use an
   existing, audited control only; do not assume one exists and do not invent a
   new emergency-admin path. If a pause is available and the operational/legal
   decision is to protect *all* callers, use the documented multisig procedure
   after a fork rehearsal and public notice. A UI restriction cannot provide
   this protocol-wide protection.

4. **Deploy official-UI containment.** Release a frontend configuration change
   that prevents submission of an early withdrawal in the confirmed affected
   range, with the comparison performed in USDC base units (not floating point)
   and revalidated immediately before transaction construction. For the stated
   condition this is a minimum of exactly 100.00 USDC only if fork testing
   confirms 100.00 is safe; otherwise set the first demonstrably safe base-unit
   amount or disable early withdrawals in the UI. Keep normal matured
   withdrawals available if they do not use the faulty path. Show an inline,
   persistent notice explaining the temporary restriction and linking to the
   status/remediation page. Do not disguise it as a generic validation error.

5. **Add a direct-call warning and support route.** Publish an incident/status
   notice saying that early withdrawals below the confirmed threshold can be
   overcharged when submitted to the current vault, including by direct contract
   calls; advise users not to use that path until the onchain fix is announced.
   Include the contract address, affected window, contact route, and a promise
   of reimbursement methodology after reconciliation. Notify known integrators
   and update any docs/SDK examples. Do not claim the contract has been fixed.

6. **Verify the public UI change.** Against Base mainnet, run the full official
   flow with a controlled wallet: affected amount is blocked before wallet
   signing; boundary-safe amount behaves as intended; mature withdrawal remains
   correct; the production URL shows the notice. Record frontend release hash,
   URL, tests, and reviewer. Monitor attempted blocked submissions, early
   withdrawal events, support contacts, and public/direct contract activity.

7. **Prepare restitution without waiting for the code release.** Lock the
   reconciliation snapshot and have finance/security independently verify the
   per-wallet overcharge formula. Define a claimless, reviewable payout method
   (for example, USDC transfers from the treasury multisig) and a ledger with
   transaction hashes. Obtain the required treasury/multisig approvals; do not
   send payments until the figures and recipient addresses are checked.

## Ship this week — permanent remediation

1. **Choose the only valid technical path from actual architecture.** If the
   verified vault is an upgradeable proxy, plan a controlled implementation
   upgrade; if it is immutable, deploy a corrected successor vault and migrate.
   Confirm all roles, timelocks, proxy admin ownership, upgrade compatibility,
   and whether deposits/withdrawals can be paused. The decision must be based
   on deployed code and governance controls, not on the preference to avoid
   migration.

2. **Implement and review the fixed fee math.** Use named constants and units;
   normalize USDC/base units exactly once; avoid floating point and ambiguous
   percent/fee-denominator scaling. Add regression tests for the reported
   sub-100 cases, exact boundary, just-above-boundary, minimum unit/rounding,
   zero, full-balance, fees/caps, and both early and mature withdrawal paths.
   Include invariant/property tests that fee amounts are correctly scaled and
   cannot exceed the documented bound. Get an independent smart-contract review
   focused on storage layout (if upgrading), access control, rounding, and
   migration accounting.

3. **Rehearse against a Base fork before any mainnet transaction.** Fork Base
   using the deployed addresses and state; execute the proposed upgrade or
   migration with the real roles/timelock sequence. Exercise real USDC approvals
   and balances, a representative staker, fee recipient accounting, and rollback
   / abort criteria. The go/no-go condition is that all regression tests pass
   and the complete deployment script succeeds on this fork with correct
   balances and event output.

4. **Publish the release and migration runbook.** Specify exact addresses,
   calldata/proposal IDs, multisig signers, timelock delays, expected events,
   monitoring, owner for each action, and stop conditions. For a new vault,
   make migration opt-in and non-custodial where feasible: snapshot/verify each
   position, preserve accrued rights and lock/early-withdrawal semantics, and
   clearly state whether users must approve USDC again. Do not pressure users
   into a rapid approval; retain a safe exit path from the old vault.

5. **Execute the onchain fix and verify immediately.** Perform the approved
   upgrade or deploy successor according to the runbook, then verify source on
   Base Explorer in the same release window. Update the frontend only after its
   contract address/ABI/configuration is checked. The go/no-go condition before
   making it public is a controlled real-wallet mainnet journey ($1–10 where
   applicable) showing correct fee calculation, correct event/accounting, and
   correct network/address.

6. **Remove temporary controls only after validation.** Publish the new
   contract/implementation address and effective block, upgrade the UI to the
   fixed path, and keep the incident banner until users have clear migration and
   reimbursement instructions. Re-test the public production URL and one real
   transaction after release. Keep the old UI threshold in place for all old
   vault withdrawal paths unless the old contract has been globally and safely
   paused.

7. **Pay restitution and close transparently.** Send verified USDC repayments,
   publish a privacy-conscious aggregate accounting and payout transaction
   hashes, and provide a support escalation path for reconciliation errors.
   Monitor the corrected contract and old vault for at least the agreed period.
   Finish with a blameless postmortem covering the decimal-unit failure, why
   pre-release tests did not catch it, monitoring/alert additions, and changes
   to deployment and fee-math review checklists.

## Recommended communication today

“We identified an early-withdrawal fee calculation issue in the current Base
vault that can overcharge withdrawals below the confirmed threshold. The
official app is temporarily preventing those submissions while we deploy a
permanent onchain correction. The existing contract remains callable directly,
so please do not submit early withdrawals in that range. We are reconciling
affected withdrawals and will reimburse confirmed excess fees. Updates and
contract addresses: [status link].”
