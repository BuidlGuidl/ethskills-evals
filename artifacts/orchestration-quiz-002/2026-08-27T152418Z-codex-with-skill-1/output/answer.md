# Base vault early-withdrawal fee incident plan

## Decision

**A 100 USDC UI minimum does not resolve this incident.** It can reduce the
chance that users of the official web form take the affected path, but the fee
calculation remains wrong in immutable, publicly callable Base contract code.
Users can call the vault directly, use another UI or an integration, and the
official UI change does nothing for transactions already overcharged. It also
turns balances below 100 USDC into an apparent withdrawal lockout, which is a
bad customer outcome unless there is a clearly safe alternate withdrawal path.

Ship a UI guard today only as a short-lived mitigation. The incident is
resolved only after the on-chain fee logic is corrected (by an existing,
authorized proxy upgrade if available, otherwise a replacement vault and a
safe migration), the public UI is on the corrected path, and affected users
are remediated.

## What ships today (Thursday)

1. **Open an incident and preserve evidence.** Assign an incident owner,
   contract engineer, frontend owner, and customer-support/treasury owner.
   Record the affected vault address, implementation address (if any), first
   known bad block/transaction, exact intended fee formula, and a snapshot of
   relevant configuration. Do not alter or destroy logs.
2. **Establish the blast radius before publishing a workaround.** From Base
   events/traces, identify all early withdrawals since deployment, classify
   those below 100 USDC, and calculate intended fee, charged fee, and excess
   for each transaction. Independently reconcile the total with vault token
   balances and accounting. Have a second engineer review the query and
   arithmetic.
3. **Put an immediate guard on the official frontend.**
   - If the contract has an already-authorized pause/early-withdrawal switch,
     use its documented governance/emergency procedure to disable *only early
     withdrawals* while keeping mature, unaffected withdrawals available. Test
     that action first on a Base fork; do not improvise privileged calls.
   - If no contract-side control exists, release a frontend update that blocks
     early withdrawals below 100 USDC before wallet submission, uses integer
     USDC units (6 decimals; never floating point), and clearly says it is a
     temporary protection for this interface.
   - Prefer temporarily disabling **all early withdrawals** in the official UI
     if it can be done quickly and mature withdrawals remain available. That is
     safer than allowing a rule that merely funnels affected users elsewhere.
     If product chooses the proposed 100-USDC minimum instead, scope it solely
     to early withdrawal, show the calculated fee and 100-USDC threshold in
     the confirmation screen, and provide support escalation for users whose
     full balance is below the threshold.
   - Do not describe either UI option as a fix or promise that it protects
     direct callers.
4. **Verify the public mitigation.** Check the deployed public URL (not just a
   preview), connect a wallet, and test: 99.999999 USDC early withdrawal is
   rejected client-side; exactly 100 USDC follows the intended UI behavior;
   a mature withdrawal remains possible; and no transaction is presented for
   an UI-blocked amount. Test with Base mainnet and a small wallet/account
   before announcing it.
5. **Communicate plainly.** Post an in-app banner, status page/Discord/X
   notice, and support macro: early withdrawals under 100 USDC through the
   official UI are temporarily restricted while a fee-calculation defect is
   corrected; direct contract interactions are not protected by that UI
   restriction; users who withdrew early since the identified block will be
   reviewed for reimbursement. Provide a support channel and avoid claiming
   that funds are lost or that the contract has been upgraded before it has.
6. **Prepare remediation.** Freeze discretionary treasury transfers needed for
   reimbursement, define the reimbursement asset (USDC) and eligibility as
   `charged fee - intended fee`, and have legal/finance approve the recipient
   list and payment process. Do not reimburse from the vault in a way that
   changes remaining stakers' ownership.

**Today go/no-go:** The mitigation is public, tested against Base, clearly
labelled as temporary, and the team has an independently reviewed list of
potentially overcharged withdrawals. If the UI cannot be deployed and checked
promptly, publish the warning immediately and direct users away from early
withdrawals while the web release is completed.

## What ships this week

### 1. Reproduce and correct the contract (first)

1. Check out the exact deployed source/build metadata and confirm that it
   matches the verified Base source and current vault address. Identify whether
   the vault is a proxy, its proxy type, implementation address, admin/owner,
   upgrade timelock, and any pause powers. Do not assume it is upgradeable
   because the frontend is configurable.
2. Fork **Base** at a fixed recent block using the foundry Scaffold-ETH 2
   command `yarn fork --network base` (not `yarn fork base`). Confirm the fork
   contains Base USDC and the live vault state; chain ID 31337 alone is not
   proof of the right fork.
3. Add a regression test that reproduces the exact live error with USDC's
   6-decimal amounts, asserting both the fee and user/net vault balance.
   Cover at least a tiny nonzero withdrawal, 99.999999 USDC, exactly 100 USDC,
   just above 100 USDC, the configured fee boundary/time conditions, and a
   normal post-lock withdrawal. Compute expected values in integer base units,
   including rounding direction.
4. Correct the fee calculation in source by making the fee numerator,
   denominator, and token scale explicit. Add invariant/fuzz tests that the
   fee never exceeds the intended rate (subject to documented rounding), is
   monotonic with amount, and is correct for a 6-decimal token. Run the full
   Foundry test suite, formatting/linting, and the deployment/upgrade script
   against the Base fork.
5. Conduct an expedited independent review focused on decimal conversions,
   rounding, storage-layout compatibility (if a proxy), initializer safety,
   access control, and migration/accounting. A narrow fee patch still deserves
   this review because it governs live user balances.

### 2. Put the corrected logic on Base (second)

1. **If the live vault is upgradeable:** use the established multisig/timelock
   procedure to upgrade only after the fork simulation succeeds with the
   actual live proxy state. Verify the new implementation and proxy linkage on
   Base immediately after the transaction. Retain the same vault address, so
   users' deposits/shares and ERC-20 approvals normally remain in place;
   confirm that claim for this specific architecture before communicating it.
2. **If the live vault is not upgradeable:** deploy a corrected replacement
   vault; do not pretend a UI change fixes the old one. Verify the new contract
   immediately after deployment with `yarn verify --network base` from the
   checkout that created the broadcast artifact. Publish a migration contract
   or one-click flow only after it is tested on the Base fork. Design it so
   every user receives exactly their existing economic position, handles
   pending rewards and lock/early-exit rules explicitly, and cannot strand
   small balances. State clearly whether an approval/signature is required;
   do not promise an approval-free migration without proving it.
3. For either branch, do the live-contract test while the frontend is still
   private: use a real Base wallet and $1--10 to exercise deposit, an affected
   early withdrawal amount, boundary amounts, and mature withdrawal where
   applicable. Confirm on-chain events and displayed balances/fees.

**Contract-release go/no-go:** The corrected logic passes regression and fork
tests, live authorization and storage checks are reviewed, source is verified,
and an end-to-end transaction on the live corrected contract charges the
intended fee. Failure at any point leaves the UI mitigation and incident
communications in place; it does not justify an unreviewed upgrade/deploy.

### 3. Complete the customer and frontend release (third)

1. Update the frontend to use the corrected proxy/replacement address as
   appropriate, remove the temporary 100-USDC rule only after its underlying
   contract path is corrected, and display the fee in USDC from integer units.
   Keep a contextual warning/migration callout until adoption is complete.
2. Deploy to production only after walking the full flow against the live
   corrected contract. After deployment, load the public URL and submit one
   small real transaction again; verify the UI's fee, the wallet confirmation,
   and the settled on-chain amounts agree.
3. Execute the reviewed reimbursement process for all confirmed overcharges,
   publishing a transaction reference or claim method and a deadline. Re-run
   the event scan just before payment to catch late transactions on the old
   contract, and preserve an auditable calculation file.
4. Publish a concise postmortem: scope and timeframe, root cause, correction,
   reimbursement method, and preventive tests/monitoring. Add alerts or a
   dashboard comparing quoted versus settled fees and flagging unexpected fee
   rates.

**Incident closure condition:** No official flow routes users to the faulty
logic; the corrected on-chain path is live and verified; direct callers have a
safe corrected/migration path; all affected withdrawals are reconciled and
remediated or have an accessible claim process; and the post-deploy live test
has passed.
