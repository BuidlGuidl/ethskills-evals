# Fix Plan: Early-Withdrawal Fee Decimal Bug

## Does a 100 USDC UI minimum resolve the incident?

No. A frontend minimum is a useful same-day mitigation, but it does not resolve the incident.

The bug is in the deployed vault contract. Even if our main withdrawal form blocks early withdrawals under 100 USDC, users can still call the contract directly through BaseScan, scripts, wallets, old cached frontends, forks of the UI, or any integration that talks to the contract. The contract will continue to calculate the fee incorrectly until the on-chain logic is fixed or the affected path is made unreachable on-chain.

The UI minimum should ship today to reduce additional overcharges through our official app, but we should treat the incident as open until the contract-level issue is fixed and affected users are remediated.

## Ship Today

1. Add an official frontend guard for early withdrawals under 100 USDC.
   - Disable submission when the user is in the early-withdrawal path and the requested amount is less than 100 USDC.
   - Show a clear message: early withdrawals under 100 USDC are temporarily unavailable while we fix a fee calculation issue.
   - Make sure "max", "withdraw all", partial-withdrawal presets, mobile UI, and any alternate withdrawal components use the same validation.
   - Do not block non-early withdrawals if those are unaffected.

2. Add an explicit fee preview before withdrawal.
   - Display the estimated early-withdrawal fee and net amount.
   - If the previewed fee exceeds the intended fee by the known bad threshold, block the transaction.
   - This gives us a second frontend safety check in case the amount threshold is not the only risky condition.

3. Publish a user-facing notice.
   - State that early withdrawals under 100 USDC may be overcharged because of a contract fee-scaling bug.
   - State that principal funds are not at risk, but affected users may have paid too much fee.
   - Ask users not to directly call early withdrawals under 100 USDC until the contract fix is live.
   - Commit to identifying and refunding affected overcharges.

4. Start incident monitoring.
   - Query historical withdrawals since launch and identify affected transactions.
   - Set up a live watcher for new early withdrawals under 100 USDC.
   - Track address, transaction hash, withdrawn amount, actual fee charged, intended fee, and refund owed.

5. Check available on-chain controls.
   - If the current vault has a pause, per-function pause, fee disable switch, contract-level minimum, or emergency admin setting, use the least disruptive control that prevents the buggy path on-chain.
   - If there is no contract-level control, document that the UI guard is only a mitigation and the vulnerable path remains callable directly.

## Ship This Week

1. Fix the contract-level fee calculation.
   - Add a failing Foundry test that reproduces the bad fee for early withdrawals below 100 USDC.
   - Correct the decimal scaling so USDC's 6 decimals are handled consistently.
   - Add boundary tests for amounts below, at, and above 100 USDC.
   - Add tests across representative stake sizes, fee rates, and token decimals if the vault is meant to support more than USDC.

2. Get a focused review before mainnet changes.
   - Have at least one engineer who did not write the patch review the math and tests.
   - Run the full Foundry test suite.
   - Run a Base mainnet fork test against the deployed vault state.
   - If practical, get an external or security reviewer to do a narrow review of the withdrawal and fee path.

3. Deploy the durable fix.
   - If the vault is upgradeable: upgrade the implementation, verify it on BaseScan, and run post-upgrade smoke tests.
   - If the vault is not upgradeable: deploy and verify `VaultV2`, update the frontend to use it for new stakes, and provide a migration flow for existing stakers.
   - If approvals must be redone, make the migration UI explicit: approve, withdraw or migrate, stake into `VaultV2`, then confirm final position.
   - Keep the old vault visible as legacy until all users can exit or migrate safely.

4. Remediate affected users.
   - Finalize the affected-user report from on-chain events.
   - Calculate refunds as `actual fee charged - intended fee`.
   - Publish the methodology.
   - Send refunds or create a claim flow, depending on gas cost and address count.
   - Include users who were overcharged before the UI guard shipped and any who bypassed the UI afterward.

5. Close the incident.
   - Remove or relax the temporary UI minimum only after the contract-level fix is live and verified.
   - Keep fee previews in the UI permanently.
   - Publish a short postmortem with root cause, impact, affected period, remediation, and prevention steps.

## Concrete Order of Operations

1. Declare the incident internally and assign owners for frontend mitigation, contract fix, monitoring, communications, and user remediation.
2. Confirm the exact bad formula, intended formula, affected function, affected date range, and whether only early withdrawals under 100 USDC are impacted.
3. Ship the frontend block for early withdrawals under 100 USDC from the official app.
4. Add fee preview and client-side sanity checks so the UI blocks obviously excessive fees.
5. Publish the user notice and support response.
6. Start the historical affected-user query and live monitoring.
7. Inspect current vault admin controls; if an on-chain pause or minimum can safely block only the buggy path, enable it.
8. Write the Foundry reproduction test for the decimal bug.
9. Patch the fee calculation and add boundary tests.
10. Run local tests, full Foundry suite, and Base mainnet fork tests.
11. Complete focused engineering/security review.
12. Deploy the fix using the safest available path: upgrade existing vault if upgradeable, otherwise deploy verified `VaultV2`.
13. Update the frontend contract addresses and migration/withdrawal flow.
14. Smoke test on Base mainnet with small amounts and verify emitted events, balances, and displayed fees.
15. Process refunds or open the claim flow for overcharged users.
16. Remove temporary frontend restrictions only when direct contract calls can no longer hit the bad calculation.
17. Publish the postmortem and add regression tests to the release checklist.

## Product Recommendation

Ship the 100 USDC frontend minimum today, but do not frame it as the fix. It is a harm-reduction measure that lowers the number of users hitting the bug through our app. The incident is only resolved once the contract behavior is corrected or blocked on-chain, affected users are made whole, and the team can prove direct calls no longer trigger the incorrect fee.
