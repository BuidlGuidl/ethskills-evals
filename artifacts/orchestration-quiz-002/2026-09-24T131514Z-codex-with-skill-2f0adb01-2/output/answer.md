# Staking dApp Incident Fix Plan

## Does the UI minimum resolve the incident?

No. A 100 USDC minimum in the official frontend is a useful same-day mitigation, but it does not resolve the incident.

The bug is in the vault contract, so anyone who calls the contract directly, uses an old cached frontend, uses a forked UI, or interacts through an aggregator/script can still withdraw under 100 USDC and be overcharged. The UI also cannot remediate users who were already overcharged. Treat the frontend change as a temporary guardrail to reduce new harm while we ship a contract-level fix and reimburse affected users.

## What We Ship Today

Ship a production frontend hotfix that prevents the official UI from submitting early withdrawals under 100 USDC to the affected vault.

The UI should:

- Block early-withdrawal submissions below `100` USDC in human units, using USDC's `6` decimals via `parseUnits(amount, 6)`.
- Show a clear inline error: "Early withdrawals below 100 USDC are temporarily unavailable while we fix a fee calculation issue."
- Keep normal withdrawals available if the fee does not apply.
- Avoid trapping users silently: if a user's withdrawable balance is below 100 USDC and they are in the early-withdrawal window, show a support/status link and explain that the protocol team is preparing a fix/refund path.
- Disable or hide new deposits into the affected vault if those deposits could create more users with sub-100 USDC positions before the contract fix ships.
- Add client-side tests for `99.99`, `100`, and `100.01` USDC, plus the exact smallest-unit boundary around `100_000_000`.
- Deploy the frontend hotfix to the current production channel and purge CDN/IPFS gateway caches where applicable.
- Publish a short incident notice: no principal is at risk, early withdrawals under 100 USDC are temporarily blocked in the official UI, and overcharged users will be made whole.

This reduces new overcharges through our main user path today, but we should continue to consider the contract vulnerable until the onchain fee calculation is fixed or the affected vault is retired.

## What We Ship This Week

Ship a contract-level fix and a user remediation plan.

If the vault is upgradeable, ship an audited implementation upgrade that corrects the fee scale. If it is immutable, deploy `VaultV2`, route all new deposits there, and migrate or unwind existing positions from the old vault with the least-friction path available.

The contract fix should:

- Calculate the early-withdrawal fee in the same decimals as the withdrawn asset, especially USDC's `6` decimals.
- Include regression tests for withdrawals below 100 USDC, exactly 100 USDC, above 100 USDC, and representative large values.
- Include invariant or fuzz coverage that the fee never exceeds the configured fee rate after decimal normalization.
- Preserve existing accounting, reward accrual, and access controls.
- Be verified on Base mainnet immediately after deployment or upgrade.

The remediation plan should:

- Index historical withdrawals since launch from Base logs.
- Identify every address overcharged by the decimal bug.
- Compute the intended fee, actual fee, and refund delta in USDC smallest units.
- Publish the methodology and refund transaction hashes.
- Reimburse users directly or via a Merkle claim contract, depending on the number of affected users and gas/ops tradeoffs.

## Concrete Steps In Order

1. Freeze the blast radius.
   - Put the team in incident mode.
   - Stop any marketing or deposit-growth pushes.
   - Decide whether to also disable new deposits into the affected vault in the UI.

2. Ship the frontend mitigation today.
   - Add a shared `MIN_EARLY_WITHDRAW_USDC = parseUnits("100", 6)` constant.
   - Validate the withdrawal amount in base units before enabling the withdraw transaction button.
   - Apply the check only to withdrawals that would incur the early-withdrawal fee.
   - Add user-facing copy for the temporary block and support/status route.
   - Test the boundary cases locally against Base-fork state and then against the live contract with a local UI.
   - Deploy the frontend hotfix and verify the production URL.

3. Communicate clearly.
   - Post a status update the same day.
   - Say plainly that the official UI now blocks the affected withdrawal path, but the contract issue still needs an onchain fix.
   - Commit to reimbursing overcharged users.

4. Patch and test the contract.
   - Write a minimal failing test that reproduces the 10x overcharge for a sub-100 USDC withdrawal.
   - Fix the fee calculation by normalizing to the asset decimals.
   - Add regression and fuzz tests around decimals, fee bps, rounding, and threshold behavior.
   - Run the full Foundry test suite and coverage.
   - Get focused review on the fee math, migration/upgrade path, and storage layout if upgradeable.

5. Choose the deployment path.
   - If upgradeable: prepare the implementation upgrade, storage-layout check, multisig proposal, simulation, and Base mainnet execution.
   - If immutable: deploy and verify `VaultV2`, update the SE2 frontend contract references through the normal generated deployment flow, and route all new deposits/withdrawals to the fixed vault where applicable.

6. Handle existing stakers.
   - If positions can be migrated without user approvals, provide a migration transaction or admin migration only if the contract permissions already allow it safely.
   - If user approvals are required, make the migration UI explicit and simple: switch network, approve exact amount, migrate.
   - Keep the old vault UI in withdraw-only mode, with the sub-100 early-withdrawal warning still active until no affected positions remain.

7. Reimburse affected users.
   - Produce the overcharge report from onchain events.
   - Have finance/engineering independently review the computed refund deltas.
   - Send refunds or deploy a claim flow.
   - Publish the refund list or enough transaction evidence for users to verify they were made whole.

8. Close the incident.
   - Remove the temporary UI minimum only after the contract path users are interacting with has correct fee math.
   - Publish a postmortem covering root cause, impact, fix, refunds, and tests added.
   - Add monitoring for fee-rate deviations so future withdrawals alert if charged fees exceed the configured rate.
