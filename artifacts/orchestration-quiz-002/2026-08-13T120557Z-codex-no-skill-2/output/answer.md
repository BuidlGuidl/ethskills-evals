# Early-withdrawal fee incident plan

## Decision

Ship the UI guard today, but do **not** call it a resolution. It is a
temporary harm-reduction measure for users of our official frontend: if the
reported boundary is exact, preventing early withdrawals below 100 USDC
avoids the known overcharge in that interface. It does not change the
Base-mainnet contract. Anyone can still call the vault directly (or through
another UI), and it can prevent a user with a sub-100-USDC position from
withdrawing through our app. The erroneous fee calculation and any past
overcharges remain.

The incident is resolved only when the on-chain path no longer applies the
wrong scale (or a contract-level control prevents the affected withdrawals),
and affected users have been made whole.

## What we ship today

1. Open an incident record; name an incident owner, contract owner/signer,
   frontend owner, and communications owner. Preserve the deployed contract
   address, implementation address (if proxied), verified source, deployment
   transaction, and current frontend release hash.
2. Independently reproduce the fee for representative early withdrawals below
   100 USDC, exactly 100 USDC, and above 100 USDC against a Base mainnet fork.
   Record expected fee, actual fee, units/decimals, and the precise affected
   predicate. This validates that the proposed threshold is safe and catches
   boundary/rounding mistakes before publishing a workaround.
3. Release an official-frontend hotfix:
   - Block an *early* withdrawal whose entered amount is below the verified
     safe threshold (100 USDC only if step 2 confirms it); validate in base
     units, not floating-point display values.
   - Explain before wallet signing: “Early withdrawals below 100 USDC are
     temporarily unavailable because of a fee-calculation issue.” Do not
     silently round the amount up.
   - Apply the same check to every withdrawal entry point, including mobile,
     “max,” partial-withdraw, and any alternate app domain; release the exact
     same policy in client-side validation and server/API validation where one
     exists.
   - Display the contract-derived fee and an explicit warning that direct
     contract calls are not protected by the UI workaround.
4. Publish a concise incident notice in-app and in the normal support/status
   channels: scope (early withdrawals under the threshold), impact (fee
   overcharge; no loss beyond that), start time, temporary workaround, and
   support contact. Do not imply that funds are locked forever or that the UI
   update repairs the contract.
5. Monitor successful vault `Withdraw`/fee events, frontend validation
   rejections, support tickets, and direct calls for the affected amount range.
   Alert the incident owner on any post-release affected transaction. Keep a
   timestamped audit log of the release and monitoring results.
6. Begin a ledger of all affected withdrawals from deployment through the
   contract-level fix: transaction hash, wallet, amount, charged fee, correct
   fee, and difference. Reconcile it against on-chain events and publish the
   reimbursement method and eligibility snapshot as soon as it is reviewed.

If the contract has an authorized pause for early withdrawals or for the
vault, assess it immediately. Use it only if it can target the affected flow
without creating a worse custody/availability incident, and communicate it
before execution. A UI-only minimum is not a justification to ignore an
available contract-level safety control.

## What we ship this week

1. Determine the upgrade/migration path from the verified deployment and
   ownership configuration:
   - If the vault is a proxy with a functioning, authorized upgrade path,
     prepare a minimal implementation upgrade that corrects the fee's decimal
     arithmetic and preserves storage layout.
   - If immutable, deploy a corrected replacement vault plus a migration
     adapter/process that preserves each user's principal, accrual/lock state,
     rewards, and withdrawal eligibility as applicable. Do not assume users
     must re-approve until the migration design is validated; a contract-owned
     migration path or a controlled claim flow may reduce that burden.
2. Implement the fix with explicit token-unit constants and tests for USDC's
   6 decimals. Include property/fuzz tests across tiny amounts, 99.999999,
   100, 100.000001 USDC, full withdrawals, fee caps, rounding direction, and
   zero/maximum configured fee. Compare against a simple reference formula in
   integer base units.
3. Run Foundry tests, storage-layout validation (for an upgrade), static
   analysis, and a Base fork simulation using the exact deployed state. Have
   an independent reviewer check the formula, access control, and all migration
   accounting; obtain a focused external review if the change moves funds or
   changes lock/reward accounting.
4. Prepare the production transaction(s): multisig proposal, calldata review,
   signer schedule, rollback/containment plan, release notes, and before/after
   event/accounting checks. If an upgrade is used, retain the UI guard until
   on-chain verification confirms the new implementation and sampled
   withdrawals charge the expected fee.
5. Execute the upgrade or deploy/migration on Base mainnet during a staffed
   window. Verify source and implementation/address pointers, execute
   representative transactions, and monitor events and balances. Then remove
   the temporary minimum only after the corrected on-chain path is confirmed.
6. Reimburse the ledgered excess fees. Use a published snapshot and an
   auditable payout/claim list, with a second-person reconciliation and a
   clear deadline/support route. Include any users affected between discovery
   and the contract-level remediation, including direct callers.
7. Close with a public postmortem: timeline, root cause, affected transaction
   count and total excess fees, remediation and reimbursement status, and
   preventive controls. Add CI tests for token decimals and boundary values,
   a deployment checklist that records units, and monitoring for fee-rate
   anomalies.

## Concrete order of operations

1. Assign incident roles and preserve deployment evidence.
2. Reproduce and quantify the exact boundary on a mainnet fork.
3. Confirm whether pause/upgrade authority exists and its safe scope.
4. Deploy and verify the UI mitigation plus user notice.
5. Start event monitoring and the historical overcharge ledger.
6. Build, review, and fork-test the minimal on-chain correction or migration.
7. Execute the reviewed mainnet remediation and verify it on-chain.
8. Remove the temporary UI restriction only after verification.
9. Reimburse excess fees, monitor for stragglers, and publish the postmortem.

The $40k TVL and verified deployment make correctness, access-control review,
and an auditable migration/reimbursement plan more important than avoiding a
redeploy at all costs. The frontend change buys time; it cannot enforce safety
on a permissionless contract.
