# Staking Vault Withdrawal-Fee Incident Plan

## Bottom line

Ship the UI minimum today as an emergency containment measure, but do not treat it as the incident fix.

A 100 USDC frontend minimum reduces the number of normal users who hit the bad fee path, because most withdrawals come through the app. It does not resolve the incident because the live Base mainnet vault contract still computes the early-withdrawal fee at the wrong decimal scale. Users, scripts, integrations, cached frontends, and block explorer writes can still call the withdrawal function directly with amounts under 100 USDC. The invariant is broken onchain until the contract logic is fixed or the affected path is otherwise disabled at the contract level.

## What we ship today

1. Add a production frontend guard that blocks early withdrawals below 100 USDC.
   - Use USDC's 6-decimal units, so the threshold is `100_000_000`.
   - Apply the guard before transaction simulation and before enabling the withdraw button.
   - Show a plain message: withdrawals under 100 USDC are temporarily unavailable because of a fee-calculation issue.
   - Keep normal withdrawals of 100 USDC or more available.

2. Add the same guard anywhere a withdrawal can be initiated.
   - Main withdrawal form.
   - Mobile form/state.
   - Any quick-action component.
   - Any custom hook or helper that builds the withdraw transaction from user input.

3. Add client-side tests for the temporary rule.
   - `< 100 USDC` disables or blocks the transaction.
   - `100 USDC` is allowed.
   - `> 100 USDC` is allowed.
   - Decimal input such as `99.999999` is blocked and `100.000000` is allowed.

4. Run a targeted QA pass against Base mainnet contracts with a local UI.
   - Connect a real wallet on Base.
   - Confirm the UI blocks under-100 withdrawals before wallet confirmation.
   - Confirm 100+ USDC withdrawals still reach the normal transaction flow.
   - Confirm network switching, loading states, and error copy still work.

5. Deploy the frontend immediately after QA.
   - Publish through the current production frontend pipeline.
   - Purge CDN/cache if applicable.
   - Verify the public URL serves the patched bundle.

6. Communicate the temporary restriction.
   - Add a short in-app notice near the withdrawal form.
   - Post in Discord/Twitter/status page if those are normal support channels.
   - Tell support exactly what happened: some early withdrawals under 100 USDC were overcharged, funds are not otherwise at risk, and a contract fix/refund process is being prepared.

7. Start impact accounting today.
   - Query withdrawal events since deployment.
   - Identify early withdrawals under 100 USDC.
   - Compute intended fee, actual fee, and overcharge per transaction.
   - Prepare a refund CSV with tx hash, user address, amount, intended fee, actual fee, and refund amount.

## What we ship this week

Ship an onchain remediation, plus refunds for confirmed overcharges.

The exact path depends on whether the vault is upgradeable:

1. If the vault is upgradeable, deploy an implementation with the corrected fee calculation and upgrade the proxy after tests and review.
2. If the vault is not upgradeable, deploy a corrected vault and a migration path. The migration may be a new staking vault, a helper migrator, or an operator-assisted migration, depending on the current contract permissions and token custody model.
3. If neither upgrade nor migration can be completed safely this week, use the strongest available contract-level mitigation, such as pausing early withdrawals under the affected condition if the contract already has that control. Do not add new trust assumptions unless they are reviewed and communicated.

Refund users who were overcharged. The UI guard prevents more normal-app cases, but users already affected need make-whole handling.

## Concrete steps in order

1. Freeze risky production changes unrelated to this incident.

2. Confirm the exact bug with a minimal reproduction.
   - Use a Base mainnet fork.
   - Reproduce an early withdrawal below 100 USDC.
   - Reproduce an early withdrawal at or above 100 USDC.
   - Write down the expected fee formula and the observed wrong formula.

3. Patch the frontend containment.
   - Add a shared constant for the temporary minimum in USDC base units.
   - Validate parsed USDC amounts, not display strings.
   - Disable or block submission before wallet confirmation.
   - Add clear temporary incident copy.
   - Add focused tests for the threshold.

4. QA and deploy the frontend containment.
   - Test locally against Base mainnet contracts.
   - Deploy production frontend.
   - Verify the public app blocks under-100 withdrawals.
   - Announce the temporary restriction.

5. Build the impact report.
   - Pull all relevant withdrawal events from deployment date through the frontend patch time.
   - Filter early withdrawals under 100 USDC.
   - Recalculate the intended fee using the corrected formula.
   - Produce the refund list and have engineering plus finance/support review it.

6. Implement the contract fix on a fork.
   - Correct the decimal scaling in the fee calculation.
   - Add regression tests around USDC 6-decimal amounts, especially values below 100 USDC.
   - Include boundary tests: 0, 1 USDC, 99.999999 USDC, 100 USDC, and a larger withdrawal.
   - Run the full Foundry test suite.

7. Review the remediation path.
   - Check whether the current vault is proxy upgradeable and who controls the admin.
   - If upgradeable, prepare and review the upgrade transaction.
   - If not upgradeable, prepare the new vault deployment, verification, frontend contract config update, and migration instructions.
   - Have at least one engineer not involved in the patch review the fee math and deployment steps.

8. Execute onchain remediation.
   - For an upgrade: deploy implementation, verify it, execute the proxy upgrade, and run post-upgrade checks.
   - For a replacement: deploy the fixed vault, verify it, update the frontend to the new contract, and publish migration instructions.
   - Test with small real amounts on Base after execution.

9. Process refunds.
   - Send refunds for confirmed overcharges.
   - Publish the refund methodology and transaction hashes.
   - Keep support ready for edge cases.

10. Remove or revise the temporary UI minimum only after onchain remediation is live.
    - If the corrected contract safely supports under-100 USDC withdrawals, remove the temporary block.
    - If the product still wants a business minimum, keep it as a product rule, not as the incident fix.

11. Close the incident.
    - Write a short postmortem.
    - Add permanent tests for token-decimal fee math.
    - Add a release checklist item for decimal-scale assumptions on every ERC20 integration.
    - Add monitoring for abnormal fee percentages on future withdrawals.

## Decision for the PM

The fastest responsible path is: ship the UI minimum today, then ship the contract-level fix this week.

Skipping the redeploy or upgrade leaves the bug live onchain and leaves the team relying on the frontend as a security boundary. That is not sufficient for a mainnet contract with real TVL, even if the current loss mode is only an overcharge and not principal loss.
