# Staking Vault Fee Bug Fix Plan

## Position

The `100 USDC` frontend minimum is a useful same-day mitigation, but it does **not** resolve the incident.

It only protects users who withdraw through our current hosted frontend after the change ships. The Base mainnet vault bytecode still computes the early-withdrawal fee at the wrong decimals scale, and anyone can still call the withdrawal function directly, use an old cached frontend build, use a block explorer, script against the contract, or come through an integrator. Since the bug is in the deployed contract, the incident is not fixed until the contract-level behavior is corrected or the affected withdrawal path is otherwise made unreachable onchain.

## Ship Today

1. Add the `100 USDC` minimum to the withdrawal form as an emergency guard.
   - Block early withdrawals below `100 USDC` in the UI.
   - Use token units correctly: `100 * 10 ** 6` for USDC, not `100 ether`.
   - Make the validation apply before transaction submission and anywhere the amount can be changed.

2. Add user-facing incident communication.
   - Banner or notice: early withdrawals below `100 USDC` are temporarily disabled in the app while we deploy a contract fix.
   - Link to a short status note.
   - Do not describe this as the fix.

3. Identify and notify affected users.
   - Query Base logs for early withdrawals under `100 USDC` since launch.
   - Calculate intended fee vs. actual fee.
   - Prepare reimbursement amounts for the overcharge delta.

4. Add monitoring immediately.
   - Alert on any early-withdrawal transaction below `100 USDC` that still reaches the vault.
   - Watch the public contract, not just frontend analytics.

5. Decide whether emergency onchain containment is available.
   - If the contract has `pause`, pause withdrawals or the affected early-withdrawal path until the fix is ready.
   - If it has configurable fee parameters that can safely neutralize the overcharge, temporarily set the fee to a safe value.
   - If neither exists, document that today’s UI change is containment only.

## Ship This Week

1. Reproduce the bug locally against a Base fork.
   - Use a Base fork so USDC decimals and live contract assumptions match production.
   - Reproduce withdrawals below and above `100 USDC`.
   - Confirm the current contract charges roughly `10x` the intended fee for sub-`100 USDC` early withdrawals.

2. Fix the contract source.
   - Correct the fee calculation to consistently use USDC’s `6` decimal scale or the token’s `decimals()` value.
   - Avoid mixed `1e18` and `1e6` math unless the conversion is explicit and tested.

3. Add regression tests.
   - Test early withdrawals below `100 USDC`, exactly `100 USDC`, and above `100 USDC`.
   - Assert the fee amount, user received amount, vault accounting, and any emitted events.
   - Include edge cases around rounding and minimum nonzero withdrawal amounts.

4. Rehearse the production fix on a Base fork.
   - If the vault is upgradeable, run the upgrade script against the fork and verify storage layout compatibility.
   - If it is not upgradeable, deploy a new vault on the fork, migrate representative staking positions, and test withdrawals end to end.
   - Run the frontend locally against the forked/fixed deployment before touching production.

5. Execute the production remediation.
   - If upgradeable: upgrade the implementation, verify the new implementation on Basescan, and run a small real-money withdrawal test.
   - If not upgradeable: deploy and verify the new vault, move rewards/configuration, provide a migration path for stakers, and update the frontend contract address.
   - If users must approve a new vault, make that clear in the migration UI and status post.

6. Reimburse affected users.
   - Publish the calculation method.
   - Send the overcharged fee deltas or provide a claim mechanism.
   - Keep transaction hashes for auditability.

7. Remove or relax the temporary UI minimum only after the fixed contract path is live.
   - Keep a sane product-level minimum if desired, but it should no longer be relied on as a bug workaround.

## Concrete Order

1. Today: ship the UI `100 USDC` guard and incident notice.
2. Today: start onchain monitoring for sub-`100 USDC` early withdrawals.
3. Today: query historical affected withdrawals and estimate reimbursement exposure.
4. Today: check whether the deployed vault has pause, fee admin controls, or upgradeability.
5. Today/tomorrow: reproduce the fee bug on a Base fork.
6. Tomorrow: patch the contract math and add regression tests.
7. Tomorrow: rehearse upgrade or migration on the Base fork.
8. This week: deploy the contract-level fix, or deploy a replacement vault and migration flow if the original vault is immutable.
9. This week: verify contracts on Basescan immediately after deployment or upgrade.
10. This week: update the frontend to the fixed address/ABI if the address changed.
11. This week: run a real wallet smoke test on Base mainnet through the public frontend.
12. This week: reimburse affected users and publish the postmortem.

## Bottom Line

Ship the UI minimum today because it reduces harm quickly. But treat it as a circuit breaker, not the repair. The real fix is contract-level: reproduce, patch, test, rehearse on a Base fork, deploy or upgrade, verify, update the frontend if needed, and compensate users who were overcharged.
