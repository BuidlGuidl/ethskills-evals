# Staking Vault Early-Withdrawal Fee Incident Plan

## Incident Position

The 100 USDC frontend minimum is useful as an emergency mitigation, but it does **not** resolve the incident.

It only protects users who withdraw through our current hosted frontend. The bug is in the Base mainnet vault contract, so users can still trigger the overcharge by calling the contract directly, using a block explorer, using an old cached frontend, using scripts, or through any third-party integration. Because the deployed contract computes the fee at the wrong decimal scale, the authoritative system remains incorrect until the contract path is fixed or safely replaced.

The UI change should ship today to reduce immediate harm, but the incident remains open until the contract-level behavior is corrected and affected users are handled.

## What We Ship Today

1. Add a temporary frontend guard that blocks early withdrawals under 100 USDC.
2. Add clear withdrawal-form copy explaining that withdrawals below 100 USDC are temporarily disabled while a fee calculation issue is being fixed.
3. Add client-side validation and disabled submit state for affected withdrawals.
4. Add a final transaction-preflight check before submitting, so a stale form state cannot bypass the guard.
5. Add monitoring for attempted blocked withdrawals and successful withdrawals under 100 USDC from the contract.
6. Publish an incident notice with plain language: funds are not at risk, some early withdrawals below 100 USDC may be overcharged, the UI now blocks the risky path, and a contract-level fix is in progress.
7. Start identifying affected users and calculating reimbursement amounts from on-chain events.

This should be treated as a containment release, not the final fix.

## What We Ship This Week

1. A corrected vault contract or migration path that fixes the fee calculation at the contract level.
2. Tests that prove early-withdrawal fees are correct across USDC decimal boundaries, especially below 100 USDC.
3. A migration or replacement plan for existing stakers.
4. A reimbursement plan for users who were overcharged.
5. Updated frontend support for the fixed contract path.
6. Public closure communication once the contract-level fix is live and affected users are reimbursed or queued for reimbursement.

If the current vault is upgradeable, the preferred path is a reviewed implementation upgrade with storage-layout checks and a guarded execution plan. If it is not upgradeable, deploy a corrected vault and provide a migration flow. The migration cost is real, but leaving the broken contract as the only on-chain path is not acceptable for a live protocol with TVL.

## Concrete Steps In Order

1. Freeze the risky frontend path today.
   - Add `minWithdrawal = 100 USDC` only for withdrawals that would use the buggy early-withdrawal fee path.
   - Use USDC base units, not floating-point JavaScript numbers.
   - Keep normal withdrawals unaffected if they do not hit the buggy fee calculation.

2. Add user-facing copy.
   - Explain that small early withdrawals are temporarily unavailable.
   - Do not imply the protocol is fully fixed.
   - Link to an incident note or status page if available.

3. Add frontend tests.
   - Confirm early withdrawals below 100 USDC cannot submit.
   - Confirm exactly 100 USDC and above behave as intended.
   - Confirm non-early withdrawals are not accidentally blocked.

4. Deploy the frontend patch.
   - Clear CDN/cache if applicable.
   - Verify production against Base mainnet config.
   - Manually test connected-wallet behavior with a small account or forked/simulated transaction path.

5. Monitor the contract directly.
   - Watch for withdrawals under 100 USDC despite the UI guard.
   - Alert if any occur.
   - Keep a running list of affected addresses and transaction hashes.

6. Reproduce and patch the contract bug.
   - Write a failing Foundry test for an early withdrawal below 100 USDC.
   - Confirm the fee scale uses USDC's 6 decimals consistently.
   - Add boundary tests around 1 USDC, 99.999999 USDC, 100 USDC, and larger withdrawals.

7. Decide the contract remediation path.
   - If upgradeable: prepare the implementation fix, run storage-layout checks, simulate the upgrade, and execute through the proper admin/multisig process.
   - If not upgradeable: deploy a new verified vault, pause or discourage new deposits into the old vault if supported, and ship a migration flow for stakers.

8. Review and verify.
   - Run the full contract test suite.
   - Run fork tests against Base mainnet state.
   - Have at least one engineer not involved in the patch review the fee math.
   - Re-verify the deployed source.

9. Ship frontend support for the fixed path.
   - Point new deposits and withdrawals at the corrected contract or upgraded implementation.
   - Remove the temporary 100 USDC block only after the on-chain path is fixed.
   - Keep a warning for users still interacting with the old vault if a migration is required.

10. Reimburse affected users.
    - Compute intended fee vs. actual charged fee from on-chain data.
    - Publish the calculation method.
    - Send refunds or make claims available.
    - Record transaction hashes for auditability.

11. Close the incident.
    - Publish a short postmortem.
    - Include root cause, impact window, affected transaction count, reimbursement status, and prevention work.
    - Add regression tests so this fee-scale bug cannot reappear.

## Bottom Line

Ship the UI minimum today because it reduces immediate user harm through the main interface. Do not call it a fix. The real fix is contract-level: correct the fee calculation through an upgrade or a new vault migration, then reimburse any overcharged users.
