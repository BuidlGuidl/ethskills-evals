# Staking Vault Early-Withdrawal Fee Fix Plan

## Bottom line

The 100 USDC frontend minimum is a good same-day mitigation, but it does **not** resolve the incident.

It only protects users who withdraw through the current official UI. The buggy fee calculation still exists on Base mainnet, so users can still trigger the overcharge by calling the vault directly, using an old cached frontend, using scripts, using a block explorer, or using any third-party integration. The incident is resolved only when the on-chain withdrawal path can no longer overcharge users, or when the buggy vault is fully removed from active use and affected users are made whole.

## What we ship today

Ship a frontend guard immediately to stop most accidental overcharges:

- Disable early withdrawals below 100 USDC in the official withdrawal form.
- Add a clear inline message: withdrawals under 100 USDC are temporarily unavailable while a fee issue is being fixed.
- Put the threshold behind config so it can be changed or removed without another risky code edit.
- If the app has multiple withdrawal entry points, apply the guard everywhere, including mobile layouts and any quick-action components.
- Add analytics/logging for blocked attempts so we know how many users are affected.

Also ship operational mitigation today:

- Post an incident notice in-app and in the normal support channels.
- Tell users not to withdraw under 100 USDC until the contract fix or migration is live.
- Start a list of affected withdrawal transactions since deployment.
- Decide and announce that users overcharged by the bug will be reimbursed.
- Add monitoring for any on-chain withdrawal below 100 USDC so support can proactively contact affected users.
- If the existing contract has an owner/admin pause, withdrawal minimum, or fee-disable control, evaluate and use the least disruptive safe control. Do not assume this exists.

This is the fastest path to reduce new user harm, but we should describe it publicly as a mitigation, not a fix.

## What we ship this week

Ship an on-chain resolution:

- Correct the early-withdrawal fee calculation at the proper USDC decimals scale.
- Add tests that cover USDC 6-decimal amounts below, at, and above 100 USDC.
- Include regression tests for representative withdrawals such as 1, 10, 99.99, 100, and 1,000 USDC.
- Deploy a fixed vault, or upgrade the current vault if it is upgradeable and that path is already part of the protocol design.
- Provide a migration path for existing stakers that is as low-friction as possible.
- Reimburse users who were overcharged.
- Remove the temporary frontend minimum only after the on-chain path is safe or the buggy vault no longer accepts affected withdrawals.

If the current vault is upgradeable, the preferred weekly fix is an audited implementation upgrade with a clear admin transaction record. If it is not upgradeable, deploy a new vault and migrate users. If migration requires new approvals, we still need to do it; avoiding approvals is not a sufficient reason to leave a known fee bug live.

## Concrete steps in order

1. Freeze the blast radius today.
   - Add the 100 USDC minimum to every official frontend withdrawal flow.
   - Show a temporary incident message.
   - Deploy the frontend change.
   - Verify the deployed UI blocks withdrawals below 100 USDC on desktop and mobile.

2. Communicate immediately.
   - Publish a short incident notice with the exact affected action: early withdrawals below 100 USDC.
   - State that funds are not at risk, but some users may be overcharged.
   - State that affected users will be reimbursed.
   - Avoid saying the issue is fixed until the contract path is fixed.

3. Measure and monitor.
   - Query historical withdrawal events since the vault deployed.
   - Identify withdrawals below 100 USDC and calculate the intended fee versus actual fee.
   - Set up monitoring for new affected withdrawals directly against the contract.
   - Maintain a reimbursement ledger with tx hash, wallet, amount, overcharge, and status.

4. Confirm the contract remediation path.
   - Check whether the vault is upgradeable, pausable, or has configurable fee/minimum parameters.
   - If there is a safe admin control that prevents the bad path, use it after review.
   - If upgradeable, prepare a fixed implementation.
   - If immutable, prepare a new vault deployment and migration plan.

5. Build and test the contract fix.
   - Fix the fee formula so all math uses the correct USDC 6-decimal scale.
   - Add unit tests for small withdrawals and boundary values around 100 USDC.
   - Add invariant or fuzz coverage for fee bounds so future decimal mistakes fail tests.
   - Run a Base mainnet fork test against the deployed vault state where possible.

6. Review before deployment.
   - Have at least two engineers review the fee math and tests.
   - Run the full Foundry test suite.
   - Dry-run the upgrade or deployment script against a fork.
   - Prepare rollback or pause instructions if the deployment behaves unexpectedly.

7. Execute the on-chain fix.
   - For an upgradeable vault: execute the implementation upgrade, verify the implementation, and test a small withdrawal path.
   - For an immutable vault: deploy and verify the new vault, seed/configure it, and open migration.
   - Keep the frontend minimum in place until the old buggy path is no longer practically reachable for affected users.

8. Migrate and reimburse.
   - If a new vault is required, ship frontend migration UX with clear approval and staking steps.
   - For users who cannot migrate immediately, keep warnings visible.
   - Reimburse confirmed overcharges from the ledger.
   - Publish the reimbursement transaction list.

9. Close the incident.
   - Remove the temporary UI minimum only after the contract-level issue is resolved.
   - Publish a postmortem with root cause, impact, affected range, fix, reimbursement status, and prevention steps.
   - Add a release checklist item for token decimal assumptions and fee-boundary tests.

