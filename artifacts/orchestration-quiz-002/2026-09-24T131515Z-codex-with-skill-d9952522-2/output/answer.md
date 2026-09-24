# Live Vault Fee Bug Fix Plan

## Does the UI minimum resolve the incident?

No. A 100 USDC minimum in the frontend is a good same-day mitigation, but it is not the fix.

The deployed Base mainnet vault bytecode is still wrong. Users can call the withdrawal function directly through the Base explorer, scripts, wallets, aggregators, old frontend builds, cached clients, or any third-party integration. A frontend-only guard reduces how many users hit the bad path through our primary UI, but it does not change the public contract behavior and it does not make already-overcharged users whole.

Treat the UI change as incident containment. The incident is resolved only when the faulty withdrawal-fee logic is corrected onchain, the frontend points users at the corrected path, existing stakers have a clear migration or upgrade path, and affected users are reimbursed or otherwise handled.

## What We Ship Today

1. Add a frontend withdrawal guard that blocks early withdrawals below 100 USDC.
   - Disable the withdraw submit action when the requested amount is below 100 USDC and the early-withdrawal fee path applies.
   - Show plain in-product copy explaining that small early withdrawals are temporarily unavailable while a fee calculation issue is being fixed.
   - Keep normal withdrawals and withdrawals at or above 100 USDC available if they are not affected by the bad decimal-scale path.

2. Add monitoring and support handling.
   - Log or track blocked withdrawal attempts so we can estimate user impact.
   - Add a support path for users who need urgent access to less than 100 USDC.
   - Pull historical events/transactions since deployment to identify addresses overcharged by the bug.

3. Publish incident communication.
   - State that funds are not at risk, but early withdrawals under 100 USDC can be overcharged.
   - Tell users not to perform sub-100 USDC early withdrawals directly against the contract.
   - Say a contract-level correction and remediation plan are coming this week.

4. Start the contract fix immediately.
   - Reproduce the bug locally with Base mainnet USDC decimals and representative withdrawal amounts.
   - Write the failing regression test before changing the fee code.

## What We Ship This Week

1. A corrected vault implementation or replacement vault.
   - If the vault is upgradeable behind a proxy, deploy and execute an implementation upgrade after rehearsal.
   - If it is not upgradeable, deploy a corrected vault and migrate state/users to it.

2. Regression tests around fee scaling.
   - Cover USDC's 6 decimals explicitly.
   - Include withdrawals below 100 USDC, exactly 100 USDC, above 100 USDC, and non-early withdrawals.
   - Assert the exact intended fee in token units, not just an approximate percentage.

3. A Base fork rehearsal.
   - Run the deploy or upgrade flow against a fork of Base mainnet.
   - Use real deployed token addresses and current vault state where possible.
   - Verify withdrawal behavior with realistic balances before touching mainnet.

4. Frontend update for the corrected contract path.
   - If the address changes, update deployed contract addresses and target Base mainnet configuration.
   - If upgraded in place, still test the public frontend against the live upgraded contract.
   - Remove or relax the temporary 100 USDC block only after the live contract behavior is confirmed fixed.

5. User remediation.
   - Finalize the list of overcharged users from event and transaction analysis.
   - Reimburse the excess fee or credit users according to the product/legal decision.
   - Publish a short post-incident note with the root cause, fix, and reimbursement status.

## Concrete Steps In Order

1. Freeze the risky path in the primary frontend today.
   - Add the 100 USDC minimum only for affected early withdrawals.
   - Include clear temporary-state copy.
   - Deploy the frontend patch and verify it on the public URL with a wallet.

2. Announce the mitigation.
   - Update Discord/Twitter/app banner/docs as appropriate.
   - Tell users the frontend has a temporary block, but the contract itself is still being fixed.

3. Build the incident ledger.
   - Query vault withdrawal events from deployment block through today.
   - Recompute intended fees offchain using the correct USDC decimal scale.
   - Produce a reviewable list of affected transactions, overcharge amounts, and recipient addresses.

4. Reproduce the contract bug locally.
   - Check out the repo in a clean environment.
   - Run the current test suite.
   - Add a failing test for sub-100 USDC early withdrawal fee calculation.
   - Confirm the failure matches the Base mainnet behavior.

5. Implement the Solidity fix.
   - Correct the decimal scaling in the early-withdrawal fee calculation.
   - Keep the change narrowly scoped to fee math unless tests reveal a related issue.
   - Add boundary tests for 99.99 USDC, 100 USDC, and larger withdrawals.

6. Rehearse on a Base fork.
   - Start a Base fork using the Scaffold-ETH 2 foundry flow, for example `yarn fork --network base`.
   - Confirm the fork contains Base USDC and the live vault state expected.
   - Run the upgrade or replacement deploy script against the fork.
   - Execute representative withdrawals and verify exact fee amounts.

7. Decide upgrade versus migration.
   - If the existing vault is proxy-upgradeable and the upgrade authority is available, prefer an in-place upgrade to avoid moving user positions and approvals.
   - If the vault is immutable, deploy a new vault and ship a migration flow. Keep the old vault guarded in the UI and clearly mark it as legacy.

8. Execute the mainnet fix.
   - Run the deploy or upgrade from the audited deployer/multisig process.
   - Verify the new implementation or replacement contract on Base immediately.
   - Record transaction hashes and deployed addresses.

9. Repoint and verify the frontend.
   - Update the Scaffold-ETH deployed contract config if the address changed.
   - Keep `targetNetworks` on Base mainnet for the production build.
   - Deploy the frontend and perform a real small-value end-to-end withdrawal test against the live corrected path.

10. Resolve user impact.
    - Send reimbursements or credits for confirmed overcharges.
    - Publish final incident notes.
    - Remove the temporary UI minimum only after production testing confirms the onchain fix.

## Decision Summary

Ship the UI minimum today because it quickly reduces harm through the main app. Do not accept it as the incident resolution. The real fix must be onchain because the contract is the source of truth and remains callable without our frontend.
