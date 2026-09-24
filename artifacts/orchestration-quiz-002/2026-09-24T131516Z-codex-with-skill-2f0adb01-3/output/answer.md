# Staking Vault Fee Incident Plan

## Bottom line

Adding a `100 USDC` minimum to the official withdrawal UI is a same-day mitigation, not a resolution.

It prevents most users from accidentally triggering the bad path through our frontend, but it does not change the Base mainnet vault contract. Users can still call the contract directly, use an old cached frontend, use a forked frontend, or interact through block explorers and scripts. The incident is only resolved when the contract behavior is fixed, replaced, or made unreachable for the affected path, and affected users are handled.

## Ship today

Ship a frontend hotfix that blocks the risky official-UI flow immediately:

- For early withdrawals, block withdrawal amounts below `100 USDC`.
- Use USDC's `6` decimals everywhere: `parseUnits("100", 6)` and `formatUnits(amount, 6)`.
- Do not use floating point math for token amounts.
- Show a clear inline message: early withdrawals below `100 USDC` are temporarily unavailable because of a fee calculation issue.
- If the user has less than `100 USDC` staked and is still inside the early-withdrawal window, do not let the UI submit the transaction. Provide a support path instead of letting them overpay.
- Keep normal withdrawals available when the early-withdrawal fee no longer applies, assuming that path is unaffected.
- Disable new deposits or position changes that would create fresh sub-`100 USDC` early-withdrawal exposure until the contract fix is live.
- Add frontend tests around `99.999999`, `100.000000`, `100.000001`, full-balance withdrawals under `100`, and non-early withdrawals.
- Deploy the frontend hotfix to production today.
- Publish an incident notice that says this is a mitigation while a contract-level fix is being prepared.

Also today:

- Identify all historical affected withdrawals since deployment.
- Calculate intended fee, actual fee, and overcharge per transaction.
- Prepare refunds or credits for users already overcharged.
- Begin monitoring contract events for any new direct-to-contract sub-`100 USDC` early withdrawals so we can reimburse and contact users.

## Ship this week

Ship the contract-level correction.

If the vault is upgradeable:

- Write the fixed fee calculation in a new implementation.
- Add a regression test proving early-withdrawal fees are correct for USDC `6` decimals, especially amounts below and above `100 USDC`.
- Test the upgrade on a Base mainnet fork using real deployed state.
- Run the full withdraw/deposit/claim flow against the fork.
- Upgrade the proxy.
- Verify the implementation.
- Re-enable the affected UI path after production QA.

If the vault is not upgradeable:

- Deploy a corrected `VaultV2`.
- Deploy a migration helper if it materially reduces user steps.
- Pause or disable new deposits into the old vault if the current contract supports it.
- Update the frontend so all new deposits go to `VaultV2`.
- Keep old-vault withdrawals available only through guarded flows that prevent or clearly warn about the affected early-withdrawal case.
- Create a migration page that shows old position, new position, approvals needed, and exact transaction sequence.
- Verify contracts and run production QA with small real Base mainnet amounts.

In both cases:

- Complete reimbursements for confirmed overcharges.
- Publish a short postmortem with root cause, affected range, remediation, and refund process.
- Keep the UI guard in place until the contract fix is live and verified.

## Concrete order of operations

1. Freeze the risky official frontend path: block early withdrawals below `100 USDC`.
2. Deploy the frontend hotfix and incident banner.
3. Announce that the UI change is a mitigation, not the final fix.
4. Query Base mainnet events and build the affected-user ledger.
5. Add contract regression tests for USDC decimal scaling and sub-`100 USDC` withdrawals.
6. Implement the contract fix or `VaultV2`, depending on upgradeability.
7. Test on a Base mainnet fork with current vault state.
8. Run security review focused on fee math, migration, pausing, and withdrawal edge cases.
9. Deploy or upgrade on Base mainnet.
10. Verify contracts on the block explorer.
11. Test production with small real amounts.
12. Re-enable safe UI withdrawals once the corrected contract path is confirmed.
13. Refund overcharged users.
14. Publish the postmortem and close the incident.

## Recommendation

Take the PM's UI-minimum suggestion as the immediate containment step, but do not treat it as the fix. With `~$40k` TVL and users already noticing, the responsible fastest path is: frontend guard today, contract-level remediation this week, and refunds for any overcharge.
