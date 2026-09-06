OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144535Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048d5-5690-7431-9451-a94f10f37d2a
--------
user
We're building an onchain version of a savings circle — the thing my family
calls a susu. Twelve people put in $100 of USDC each month, and each month one
member takes the whole $1,200 pot; the order is fixed when the circle starts,
and everyone gets exactly one turn over the year. If someone misses a payment
they forfeit their turn, and their earlier contributions cover the shortfall
for that month's recipient.

There are two of us building this and we're both away for the next six weeks.
I want to know whether the circles that are already running keep working while
we're gone — and if not, exactly what breaks and what we'd have to do about
it.

Write your answer to plan.md in this directory: the contract design, plus the
answer to that.

2026-08-28T14:45:36.253910Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048d5-5690-7431-9451-a94f10f37d2a.tmp-1787928336019124956: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this needs both a minimal onchain design and a concrete operating model for unattended circles. I’ll inspect its guidance and the workspace, then write `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!vendor'"' ." in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144535Z-codex-with-skill-3/workspace
 exited 1 in 3ms:
codex
The key design constraint is economic, not just automation: in a normal monthly pot, earlier contributions have already been paid to earlier recipients, so they cannot later cover a default. I’m making that insolvency point explicit and designing the smallest collateralized version that can actually enforce the stated rule.
web search: 
web search: site:docs.base.org USDC Base mainnet address official ...
codex
I’ve also resolved an ambiguity that otherwise creates a contract bug: “forfeit their turn” cannot punish someone whose turn already happened. The plan therefore treats one missed installment as permanent default, cancels an unpaid future turn, and uses locked collateral to cover every remaining installment—including defaults after payout.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144535Z-codex-with-skill-3/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..87078e0cf5dfb99049981fa35db4360676658a77
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,148 @@
+# Susu: shippable contract and six-week absence plan
+
+## Decision in one paragraph
+
+Ship one non-upgradeable `SusuCircle` contract on Base, initially for one circle, using native USDC. The twelve addresses, payout order, $100 installment, monthly deadlines, and default rules become immutable when the circle is activated. Members pay by pushing USDC into the contract; anyone may finalize a month after its deadline; the recipient withdraws rather than receiving USDC inside finalization. Do not make an admin, backend, or cron job necessary for progress. A keeper can be added as a convenience, but members must retain the permissionless path.
+
+There is an important correction to the proposed economics: earlier installments cannot cover a later missed installment if those installments were already included in earlier $1,200 pots. The same $100 cannot be paid twice. A circle that promises every recipient the full $1,200 therefore needs separately locked collateral (or outside credit). For an MVP with no underwriting, require each member to lock $1,200 before activation. Monthly installments remain $100, but a missed installment is taken from that member's collateral. At completion, unused collateral is returned. This is capital-heavy, but it is the smallest design that actually guarantees the rule and protects later recipients.
+
+## Product rules that must be agreed before deployment
+
+- Exactly 12 unique member addresses; one immutable payout slot per member.
+- `installment = 100_000000` and nominal pot `= 1_200_000000` USDC (USDC has six decimals). Use integer constants, never dollar-price oracles.
+- A member locks `1_200_000000` USDC collateral before activation. This covers all twelve possible installments and makes even a month-one disappearance solvent. A smaller bond is possible only with an explicit loss/underwriting model.
+- Month 0 starts at an agreed UTC timestamp. Each monthly period should be a fixed duration stated in the UI and contract. If “calendar month” is required, store all 12 UTC deadlines at creation; do not approximate it with 30 days.
+- Payment window closes at that month's immutable deadline. No admin discretion and no retroactive payment.
+- A first missed payment permanently marks the member defaulted. For that month and every remaining month, $100 is moved internally from their locked collateral into the month's pot. They cannot make later payments.
+- If a defaulted member's payout slot has not happened, that payout is forfeited. The pot for that slot must have a pre-agreed destination. Recommended: distribute it pro rata to the eleven non-defaulting members after the circle ends, not to an operator. This preserves a deterministic schedule without handing an admin a windfall.
+- If the member already received their payout, it cannot be clawed back. Their collateral still funds every remaining installment. This is why collateral, not “forfeiting a turn,” protects the circle after an early recipient defaults.
+- A member who pays every installment gets all unused collateral back. A defaulted member gets any collateral left after all of their remaining obligations have been charged, but no forfeited pot.
+- No member replacement, payout-order edit, deadline edit, early admin withdrawal, pausing of settlement, protocol fee, or yield strategy in v1.
+
+The forfeited-pot rule is a real product choice. If the family instead wants to skip that slot and finish early, define exactly which installments are no longer owed and reduce the schedule. Do not deploy with this unresolved.
+
+## Onchain boundary
+
+Onchain: membership and order, deadlines, installments received, collateral, default status, month finalization, claimable balances, refunds, and all USDC transfers. Emit events sufficient to reconstruct payment history and defaults.
+
+Offchain: names, avatars, reminders, contact details, explanations, transaction submission, event indexing, and display of the schedule. A reminder service improves experience but has no authority and is not required for correctness.
+
+## One-contract surface
+
+Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions. Accept only the immutable native-USDC token. Track obligations with internal accounting; do not loop over unbounded data (the only loops are capped at 12).
+
+Suggested lifecycle and functions:
+
+```solidity
+enum Status { Funding, Active, Complete, Cancelled }
+
+constructor(
+  IERC20 usdc,
+  address[12] membersInPayoutOrder,
+  uint64[12] deadlines,
+  address forfeitureBeneficiary // preferably the circle's final pro-rata pool logic
+)
+
+depositCollateral()                 // member transfers exactly $1,200
+activate()                          // permissionless once all 12 deposits exist
+cancelUnfunded()                    // permissionless after funding deadline
+refundCancelled()                   // member pull-refund
+pay(uint8 month)                    // only that member, only current open month
+finalizeMonth(uint8 month)          // anyone, only after deadline, exactly once
+withdrawPayout()                    // recipient pull-withdrawal
+withdrawCompletionBalance()         // collateral refund / forfeited-pot share
+```
+
+In practice `pay()` need not take a month argument: requiring `month == currentMonth` reduces mistakes. `finalizeMonth` should:
+
+1. Mark the month finalized before any external transfer.
+2. For each member with no recorded payment, permanently default them and debit $100 from their collateral for this month.
+3. For members already defaulted in an earlier month, debit $100 collateral for this month.
+4. Assert that exactly $1,200 is allocated to the pot.
+5. If the scheduled recipient is eligible, credit their `claimable` balance; otherwise credit the forfeited-pot pool.
+6. Advance `currentMonth`; after month 11, mark complete and calculate withdrawable collateral and pro-rata forfeiture shares.
+
+Never transfer to twelve members inside finalization. Use pull withdrawals so a bad recipient address cannot block progression. USDC itself is centrally administered and can freeze an address; a frozen recipient's withdrawal may fail, but the rest of the circle must still settle. Define a recovery policy before launch (recommended: no admin redirection; the member must resolve the freeze with Circle or accept that funds remain claimable).
+
+Use balance-before/balance-after checks for deposits and reject tokens other than the configured USDC. Maintain the invariant:
+
+```text
+contract USDC balance
+  >= total member collateral still locked
+   + total paid installments not yet allocated
+   + total claimable payouts/refunds
+```
+
+Key tests: all-pay happy path; default before turn; default after turn; multiple defaults; default in month 0 and month 11; exact-deadline boundary; double payment/finalization/withdrawal; failed USDC transfer; frozen recipient; cancellation before activation; all withdrawals; conservation of USDC after every state transition; fuzzed call order; and fork tests against Base's actual USDC.
+
+## Who makes the months happen
+
+Smart contracts do not wake up on a date. A deadline only makes `finalizeMonth()` callable; some account must submit the transaction.
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `depositCollateral()` | each member | joins the circle and becomes eligible | circle never activates; deposits become refundable after funding deadline |
+| `activate()` | any member | starts their circle | funds stay safely locked; activation waits |
+| `pay()` | each non-defaulted member | preserves their turn and collateral | after deadline, collateral is charged and they default |
+| `finalizeMonth()` | current recipient, any member, or keeper | recipient unlocks $1,200; members advance the circle | nothing executes automatically; funds remain safe and the next month cannot open |
+| `withdrawPayout()` | recipient | receives $1,200 | balance remains claimable |
+| completion withdrawal | each member | recovers collateral/share | balance remains claimable |
+
+The current recipient has a direct $1,200 incentive to finalize, so a keeper fee is unnecessary for v1. Provide a public “Finalize month” button and documented direct contract call. Optional automation should alert and submit `finalizeMonth`, but must use a replaceable, minimally funded key and must not possess owner powers.
+
+## Will running circles work while both builders are away for six weeks?
+
+**Only if the deployed contracts already have a permissionless, correctly incentivized finalization path. They will not run merely because deadlines pass.** Six weeks crosses at least one monthly deadline, so this must be tested before leaving.
+
+For the design above, the builders can disappear and circles remain operable:
+
+- Members still have to submit their monthly `pay()` transactions. An ERC-20 approval is not a scheduled payment and cannot initiate a transaction by itself.
+- At or after each deadline, the recipient or any other account must call `finalizeMonth()`.
+- The recipient then calls `withdrawPayout()`.
+- If no one finalizes, USDC is not lost and defaults are not silently excused, but the circle stalls: the pot is not allocated, withdrawals do not open, and later months cannot progress until someone calls.
+- If the only finalizer is an owner/backend/keeper controlled by the two builders, the running circles **will break operationally** at the first deadline: settlement stalls for the full absence. The fix is a contract upgrade/migration to permissionless finalization, or keeping a monitored automation signer online. Automation alone is the weaker fix because outages and an empty gas balance recreate the same failure.
+- If settlement depends on an admin deciding who paid or who defaulted, it is not safe to leave unattended. Payment truth and deadline evaluation must be contract-derived.
+- If existing circles do not hold adequate collateral, they cannot guarantee a full pot after default. No keeper fixes insolvency. The choices are to disclose partial pots, add a guarantor/reserve, collect collateral, or migrate before promising $1,200.
+- If the contract is pausable and either builder is the sole pauser/unpauser, a pause during the trip strands progress. Do not pause merely for absence; production ownership should be a multisig with available signers, and normal settlement must not require it.
+
+### Go/no-go drill before departure
+
+On a Base fork or Base Sepolia, reproduce the exact six-week interval with production bytecode and UI:
+
+1. Create and fund a 12-member circle; ensure builders use no member address and no privileged call.
+2. Advance past two deadlines. Have one member miss before their turn and another miss after receiving their turn.
+3. From a fresh, unprivileged address, finalize both months. Confirm both recipients can withdraw exactly $1,200 and collateral is debited correctly.
+4. Turn off the backend/automation and repeat using only the public UI and direct explorer call instructions.
+5. Empty the automation wallet and confirm members can still progress.
+6. Confirm monitoring alerts on an unfinalized deadline, low automation gas, failed transactions, USDC balance/invariant mismatch, and Base/sequencer incidents.
+
+Go only if this passes and at least two non-builder members know how to finalize. Otherwise pause creation of new circles and arrange coverage for existing ones; do not pretend cron is autonomy.
+
+## Chain and release runbook
+
+Launch on **Base mainnet (chain ID 8453)**: it has native USDC, low-friction EVM tooling, and makes $100 monthly payments practical. Configure native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, verified against [Circle's official address list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Do not accept bridged lookalikes.
+
+Assuming a Foundry repository and script `script/DeploySusu.s.sol:DeploySusu`, the release README should contain and CI should exercise these exact command shapes:
+
+```bash
+export BASE_RPC_URL='https://your-authenticated-base-rpc'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='...'
+export MEMBERS_FILE='./deploy/members.json'
+
+forge test
+forge test --fork-url "$BASE_RPC_URL"
+forge script script/DeploySusu.s.sol:DeploySusu \
+  --rpc-url "$BASE_RPC_URL" --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployment script must refuse the wrong chain ID, wrong USDC address, duplicate/zero members, non-increasing deadlines, deadlines already passed, or amounts other than the constants. Print the address and constructor arguments, then independently compare the verified source and arguments on the explorer.
+
+There should be no routine owner power. If an emergency pause is retained after review, assign it to a member-approved multisig with at least one available signer outside the two-person builder team; pausing withdrawals is strongly discouraged. Do not use an EOA owned by either builder.
+
+Post-deploy, first use a fresh small test circle configuration on Base with consenting test wallets, deposit collateral, activate, pay one installment, advance/finalize under the tested timing rules, and withdraw. A real $1,200 circle should not start until a fresh reviewer has checked the contract, deployment arguments, invariant tests, default economics, and the unattended drill.
+
+## Ship gate
+
+The MVP is ready only when the forfeited-pot policy is signed off, all twelve people understand the collateral requirement and irreversible default rule, contract logic has an independent security review, fork/invariant tests pass, source is verified, monitoring and public runbooks are live, and normal operation has been demonstrated with both builders completely absent. Existing circles that fail either the permissionless-liveness test or the collateral-solvency test need remediation before the six-week trip.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..87078e0cf5dfb99049981fa35db4360676658a77
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,148 @@
+# Susu: shippable contract and six-week absence plan
+
+## Decision in one paragraph
+
+Ship one non-upgradeable `SusuCircle` contract on Base, initially for one circle, using native USDC. The twelve addresses, payout order, $100 installment, monthly deadlines, and default rules become immutable when the circle is activated. Members pay by pushing USDC into the contract; anyone may finalize a month after its deadline; the recipient withdraws rather than receiving USDC inside finalization. Do not make an admin, backend, or cron job necessary for progress. A keeper can be added as a convenience, but members must retain the permissionless path.
+
+There is an important correction to the proposed economics: earlier installments cannot cover a later missed installment if those installments were already included in earlier $1,200 pots. The same $100 cannot be paid twice. A circle that promises every recipient the full $1,200 therefore needs separately locked collateral (or outside credit). For an MVP with no underwriting, require each member to lock $1,200 before activation. Monthly installments remain $100, but a missed installment is taken from that member's collateral. At completion, unused collateral is returned. This is capital-heavy, but it is the smallest design that actually guarantees the rule and protects later recipients.
+
+## Product rules that must be agreed before deployment
+
+- Exactly 12 unique member addresses; one immutable payout slot per member.
+- `installment = 100_000000` and nominal pot `= 1_200_000000` USDC (USDC has six decimals). Use integer constants, never dollar-price oracles.
+- A member locks `1_200_000000` USDC collateral before activation. This covers all twelve possible installments and makes even a month-one disappearance solvent. A smaller bond is possible only with an explicit loss/underwriting model.
+- Month 0 starts at an agreed UTC timestamp. Each monthly period should be a fixed duration stated in the UI and contract. If “calendar month” is required, store all 12 UTC deadlines at creation; do not approximate it with 30 days.
+- Payment window closes at that month's immutable deadline. No admin discretion and no retroactive payment.
+- A first missed payment permanently marks the member defaulted. For that month and every remaining month, $100 is moved internally from their locked collateral into the month's pot. They cannot make later payments.
+- If a defaulted member's payout slot has not happened, that payout is forfeited. The pot for that slot must have a pre-agreed destination. Recommended: distribute it pro rata to the eleven non-defaulting members after the circle ends, not to an operator. This preserves a deterministic schedule without handing an admin a windfall.
+- If the member already received their payout, it cannot be clawed back. Their collateral still funds every remaining installment. This is why collateral, not “forfeiting a turn,” protects the circle after an early recipient defaults.
+- A member who pays every installment gets all unused collateral back. A defaulted member gets any collateral left after all of their remaining obligations have been charged, but no forfeited pot.
+- No member replacement, payout-order edit, deadline edit, early admin withdrawal, pausing of settlement, protocol fee, or yield strategy in v1.
+
+The forfeited-pot rule is a real product choice. If the family instead wants to skip that slot and finish early, define exactly which installments are no longer owed and reduce the schedule. Do not deploy with this unresolved.
+
+## Onchain boundary
+
+Onchain: membership and order, deadlines, installments received, collateral, default status, month finalization, claimable balances, refunds, and all USDC transfers. Emit events sufficient to reconstruct payment history and defaults.
+
+Offchain: names, avatars, reminders, contact details, explanations, transaction submission, event indexing, and display of the schedule. A reminder service improves experience but has no authority and is not required for correctness.
+
+## One-contract surface
+
+Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions. Accept only the immutable native-USDC token. Track obligations with internal accounting; do not loop over unbounded data (the only loops are capped at 12).
+
+Suggested lifecycle and functions:
+
+```solidity
+enum Status { Funding, Active, Complete, Cancelled }
+
+constructor(
+  IERC20 usdc,
+  address[12] membersInPayoutOrder,
+  uint64[12] deadlines,
+  address forfeitureBeneficiary // preferably the circle's final pro-rata pool logic
+)
+
+depositCollateral()                 // member transfers exactly $1,200
+activate()                          // permissionless once all 12 deposits exist
+cancelUnfunded()                    // permissionless after funding deadline
+refundCancelled()                   // member pull-refund
+pay(uint8 month)                    // only that member, only current open month
+finalizeMonth(uint8 month)          // anyone, only after deadline, exactly once
+withdrawPayout()                    // recipient pull-withdrawal
+withdrawCompletionBalance()         // collateral refund / forfeited-pot share
+```
+
+In practice `pay()` need not take a month argument: requiring `month == currentMonth` reduces mistakes. `finalizeMonth` should:
+
+1. Mark the month finalized before any external transfer.
+2. For each member with no recorded payment, permanently default them and debit $100 from their collateral for this month.
+3. For members already defaulted in an earlier month, debit $100 collateral for this month.
+4. Assert that exactly $1,200 is allocated to the pot.
+5. If the scheduled recipient is eligible, credit their `claimable` balance; otherwise credit the forfeited-pot pool.
+6. Advance `currentMonth`; after month 11, mark complete and calculate withdrawable collateral and pro-rata forfeiture shares.
+
+Never transfer to twelve members inside finalization. Use pull withdrawals so a bad recipient address cannot block progression. USDC itself is centrally administered and can freeze an address; a frozen recipient's withdrawal may fail, but the rest of the circle must still settle. Define a recovery policy before launch (recommended: no admin redirection; the member must resolve the freeze with Circle or accept that funds remain claimable).
+
+Use balance-before/balance-after checks for deposits and reject tokens other than the configured USDC. Maintain the invariant:
+
+```text
+contract USDC balance
+  >= total member collateral still locked
+   + total paid installments not yet allocated
+   + total claimable payouts/refunds
+```
+
+Key tests: all-pay happy path; default before turn; default after turn; multiple defaults; default in month 0 and month 11; exact-deadline boundary; double payment/finalization/withdrawal; failed USDC transfer; frozen recipient; cancellation before activation; all withdrawals; conservation of USDC after every state transition; fuzzed call order; and fork tests against Base's actual USDC.
+
+## Who makes the months happen
+
+Smart contracts do not wake up on a date. A deadline only makes `finalizeMonth()` callable; some account must submit the transaction.
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `depositCollateral()` | each member | joins the circle and becomes eligible | circle never activates; deposits become refundable after funding deadline |
+| `activate()` | any member | starts their circle | funds stay safely locked; activation waits |
+| `pay()` | each non-defaulted member | preserves their turn and collateral | after deadline, collateral is charged and they default |
+| `finalizeMonth()` | current recipient, any member, or keeper | recipient unlocks $1,200; members advance the circle | nothing executes automatically; funds remain safe and the next month cannot open |
+| `withdrawPayout()` | recipient | receives $1,200 | balance remains claimable |
+| completion withdrawal | each member | recovers collateral/share | balance remains claimable |
+
+The current recipient has a direct $1,200 incentive to finalize, so a keeper fee is unnecessary for v1. Provide a public “Finalize month” button and documented direct contract call. Optional automation should alert and submit `finalizeMonth`, but must use a replaceable, minimally funded key and must not possess owner powers.
+
+## Will running circles work while both builders are away for six weeks?
+
+**Only if the deployed contracts already have a permissionless, correctly incentivized finalization path. They will not run merely because deadlines pass.** Six weeks crosses at least one monthly deadline, so this must be tested before leaving.
+
+For the design above, the builders can disappear and circles remain operable:
+
+- Members still have to submit their monthly `pay()` transactions. An ERC-20 approval is not a scheduled payment and cannot initiate a transaction by itself.
+- At or after each deadline, the recipient or any other account must call `finalizeMonth()`.
+- The recipient then calls `withdrawPayout()`.
+- If no one finalizes, USDC is not lost and defaults are not silently excused, but the circle stalls: the pot is not allocated, withdrawals do not open, and later months cannot progress until someone calls.
+- If the only finalizer is an owner/backend/keeper controlled by the two builders, the running circles **will break operationally** at the first deadline: settlement stalls for the full absence. The fix is a contract upgrade/migration to permissionless finalization, or keeping a monitored automation signer online. Automation alone is the weaker fix because outages and an empty gas balance recreate the same failure.
+- If settlement depends on an admin deciding who paid or who defaulted, it is not safe to leave unattended. Payment truth and deadline evaluation must be contract-derived.
+- If existing circles do not hold adequate collateral, they cannot guarantee a full pot after default. No keeper fixes insolvency. The choices are to disclose partial pots, add a guarantor/reserve, collect collateral, or migrate before promising $1,200.
+- If the contract is pausable and either builder is the sole pauser/unpauser, a pause during the trip strands progress. Do not pause merely for absence; production ownership should be a multisig with available signers, and normal settlement must not require it.
+
+### Go/no-go drill before departure
+
+On a Base fork or Base Sepolia, reproduce the exact six-week interval with production bytecode and UI:
+
+1. Create and fund a 12-member circle; ensure builders use no member address and no privileged call.
+2. Advance past two deadlines. Have one member miss before their turn and another miss after receiving their turn.
+3. From a fresh, unprivileged address, finalize both months. Confirm both recipients can withdraw exactly $1,200 and collateral is debited correctly.
+4. Turn off the backend/automation and repeat using only the public UI and direct explorer call instructions.
+5. Empty the automation wallet and confirm members can still progress.
+6. Confirm monitoring alerts on an unfinalized deadline, low automation gas, failed transactions, USDC balance/invariant mismatch, and Base/sequencer incidents.
+
+Go only if this passes and at least two non-builder members know how to finalize. Otherwise pause creation of new circles and arrange coverage for existing ones; do not pretend cron is autonomy.
+
+## Chain and release runbook
+
+Launch on **Base mainnet (chain ID 8453)**: it has native USDC, low-friction EVM tooling, and makes $100 monthly payments practical. Configure native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, verified against [Circle's official address list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Do not accept bridged lookalikes.
+
+Assuming a Foundry repository and script `script/DeploySusu.s.sol:DeploySusu`, the release README should contain and CI should exercise these exact command shapes:
+
+```bash
+export BASE_RPC_URL='https://your-authenticated-base-rpc'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='...'
+export MEMBERS_FILE='./deploy/members.json'
+
+forge test
+forge test --fork-url "$BASE_RPC_URL"
+forge script script/DeploySusu.s.sol:DeploySusu \
+  --rpc-url "$BASE_RPC_URL" --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployment script must refuse the wrong chain ID, wrong USDC address, duplicate/zero members, non-increasing deadlines, deadlines already passed, or amounts other than the constants. Print the address and constructor arguments, then independently compare the verified source and arguments on the explorer.
+
+There should be no routine owner power. If an emergency pause is retained after review, assign it to a member-approved multisig with at least one available signer outside the two-person builder team; pausing withdrawals is strongly discouraged. Do not use an EOA owned by either builder.
+
+Post-deploy, first use a fresh small test circle configuration on Base with consenting test wallets, deposit collateral, activate, pay one installment, advance/finalize under the tested timing rules, and withdraw. A real $1,200 circle should not start until a fresh reviewer has checked the contract, deployment arguments, invariant tests, default economics, and the unattended drill.
+
+## Ship gate
+
+The MVP is ready only when the forfeited-pot policy is signed off, all twelve people understand the collateral requirement and irreversible default rule, contract logic has an independent security review, fork/invariant tests pass, source is verified, monitoring and public runbooks are live, and normal operation has been demonstrated with both builders completely absent. Existing circles that fail either the permissionless-liveness test or the collateral-solvency test need remediation before the six-week trip.

exec
/bin/bash -lc "wc -l plan.md && sed -n '1,40p' plan.md && git diff --check -- plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144535Z-codex-with-skill-3/workspace
 succeeded in 0ms:
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..87078e0cf5dfb99049981fa35db4360676658a77
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,148 @@
+# Susu: shippable contract and six-week absence plan
+
+## Decision in one paragraph
+
+Ship one non-upgradeable `SusuCircle` contract on Base, initially for one circle, using native USDC. The twelve addresses, payout order, $100 installment, monthly deadlines, and default rules become immutable when the circle is activated. Members pay by pushing USDC into the contract; anyone may finalize a month after its deadline; the recipient withdraws rather than receiving USDC inside finalization. Do not make an admin, backend, or cron job necessary for progress. A keeper can be added as a convenience, but members must retain the permissionless path.
+
+There is an important correction to the proposed economics: earlier installments cannot cover a later missed installment if those installments were already included in earlier $1,200 pots. The same $100 cannot be paid twice. A circle that promises every recipient the full $1,200 therefore needs separately locked collateral (or outside credit). For an MVP with no underwriting, require each member to lock $1,200 before activation. Monthly installments remain $100, but a missed installment is taken from that member's collateral. At completion, unused collateral is returned. This is capital-heavy, but it is the smallest design that actually guarantees the rule and protects later recipients.
+
+## Product rules that must be agreed before deployment
+
+- Exactly 12 unique member addresses; one immutable payout slot per member.
+- `installment = 100_000000` and nominal pot `= 1_200_000000` USDC (USDC has six decimals). Use integer constants, never dollar-price oracles.
+- A member locks `1_200_000000` USDC collateral before activation. This covers all twelve possible installments and makes even a month-one disappearance solvent. A smaller bond is possible only with an explicit loss/underwriting model.
+- Month 0 starts at an agreed UTC timestamp. Each monthly period should be a fixed duration stated in the UI and contract. If “calendar month” is required, store all 12 UTC deadlines at creation; do not approximate it with 30 days.
+- Payment window closes at that month's immutable deadline. No admin discretion and no retroactive payment.
+- A first missed payment permanently marks the member defaulted. For that month and every remaining month, $100 is moved internally from their locked collateral into the month's pot. They cannot make later payments.
+- If a defaulted member's payout slot has not happened, that payout is forfeited. The pot for that slot must have a pre-agreed destination. Recommended: distribute it pro rata to the eleven non-defaulting members after the circle ends, not to an operator. This preserves a deterministic schedule without handing an admin a windfall.
+- If the member already received their payout, it cannot be clawed back. Their collateral still funds every remaining installment. This is why collateral, not “forfeiting a turn,” protects the circle after an early recipient defaults.
+- A member who pays every installment gets all unused collateral back. A defaulted member gets any collateral left after all of their remaining obligations have been charged, but no forfeited pot.
+- No member replacement, payout-order edit, deadline edit, early admin withdrawal, pausing of settlement, protocol fee, or yield strategy in v1.
+
+The forfeited-pot rule is a real product choice. If the family instead wants to skip that slot and finish early, define exactly which installments are no longer owed and reduce the schedule. Do not deploy with this unresolved.
+
+## Onchain boundary
+
+Onchain: membership and order, deadlines, installments received, collateral, default status, month finalization, claimable balances, refunds, and all USDC transfers. Emit events sufficient to reconstruct payment history and defaults.
+
+Offchain: names, avatars, reminders, contact details, explanations, transaction submission, event indexing, and display of the schedule. A reminder service improves experience but has no authority and is not required for correctness.
+
+## One-contract surface
+
+Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions. Accept only the immutable native-USDC token. Track obligations with internal accounting; do not loop over unbounded data (the only loops are capped at 12).
+
+Suggested lifecycle and functions:
+
+```solidity
+enum Status { Funding, Active, Complete, Cancelled }
+
+constructor(
+  IERC20 usdc,
+  address[12] membersInPayoutOrder,
+  uint64[12] deadlines,
+  address forfeitureBeneficiary // preferably the circle's final pro-rata pool logic
+)
+
+depositCollateral()                 // member transfers exactly $1,200
+activate()                          // permissionless once all 12 deposits exist
+cancelUnfunded()                    // permissionless after funding deadline
+refundCancelled()                   // member pull-refund
+pay(uint8 month)                    // only that member, only current open month
+finalizeMonth(uint8 month)          // anyone, only after deadline, exactly once
+withdrawPayout()                    // recipient pull-withdrawal
+withdrawCompletionBalance()         // collateral refund / forfeited-pot share
+```
+
+In practice `pay()` need not take a month argument: requiring `month == currentMonth` reduces mistakes. `finalizeMonth` should:
+
+1. Mark the month finalized before any external transfer.
+2. For each member with no recorded payment, permanently default them and debit $100 from their collateral for this month.
+3. For members already defaulted in an earlier month, debit $100 collateral for this month.
+4. Assert that exactly $1,200 is allocated to the pot.
+5. If the scheduled recipient is eligible, credit their `claimable` balance; otherwise credit the forfeited-pot pool.
+6. Advance `currentMonth`; after month 11, mark complete and calculate withdrawable collateral and pro-rata forfeiture shares.
+
+Never transfer to twelve members inside finalization. Use pull withdrawals so a bad recipient address cannot block progression. USDC itself is centrally administered and can freeze an address; a frozen recipient's withdrawal may fail, but the rest of the circle must still settle. Define a recovery policy before launch (recommended: no admin redirection; the member must resolve the freeze with Circle or accept that funds remain claimable).
+
+Use balance-before/balance-after checks for deposits and reject tokens other than the configured USDC. Maintain the invariant:
+
+```text
+contract USDC balance
+  >= total member collateral still locked
+   + total paid installments not yet allocated
+   + total claimable payouts/refunds
+```
+
+Key tests: all-pay happy path; default before turn; default after turn; multiple defaults; default in month 0 and month 11; exact-deadline boundary; double payment/finalization/withdrawal; failed USDC transfer; frozen recipient; cancellation before activation; all withdrawals; conservation of USDC after every state transition; fuzzed call order; and fork tests against Base's actual USDC.
+
+## Who makes the months happen
+
+Smart contracts do not wake up on a date. A deadline only makes `finalizeMonth()` callable; some account must submit the transaction.
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `depositCollateral()` | each member | joins the circle and becomes eligible | circle never activates; deposits become refundable after funding deadline |
+| `activate()` | any member | starts their circle | funds stay safely locked; activation waits |
+| `pay()` | each non-defaulted member | preserves their turn and collateral | after deadline, collateral is charged and they default |
+| `finalizeMonth()` | current recipient, any member, or keeper | recipient unlocks $1,200; members advance the circle | nothing executes automatically; funds remain safe and the next month cannot open |
+| `withdrawPayout()` | recipient | receives $1,200 | balance remains claimable |
+| completion withdrawal | each member | recovers collateral/share | balance remains claimable |
+
+The current recipient has a direct $1,200 incentive to finalize, so a keeper fee is unnecessary for v1. Provide a public “Finalize month” button and documented direct contract call. Optional automation should alert and submit `finalizeMonth`, but must use a replaceable, minimally funded key and must not possess owner powers.
+
+## Will running circles work while both builders are away for six weeks?
+
+**Only if the deployed contracts already have a permissionless, correctly incentivized finalization path. They will not run merely because deadlines pass.** Six weeks crosses at least one monthly deadline, so this must be tested before leaving.
+
+For the design above, the builders can disappear and circles remain operable:
+
+- Members still have to submit their monthly `pay()` transactions. An ERC-20 approval is not a scheduled payment and cannot initiate a transaction by itself.
+- At or after each deadline, the recipient or any other account must call `finalizeMonth()`.
+- The recipient then calls `withdrawPayout()`.
+- If no one finalizes, USDC is not lost and defaults are not silently excused, but the circle stalls: the pot is not allocated, withdrawals do not open, and later months cannot progress until someone calls.
+- If the only finalizer is an owner/backend/keeper controlled by the two builders, the running circles **will break operationally** at the first deadline: settlement stalls for the full absence. The fix is a contract upgrade/migration to permissionless finalization, or keeping a monitored automation signer online. Automation alone is the weaker fix because outages and an empty gas balance recreate the same failure.
+- If settlement depends on an admin deciding who paid or who defaulted, it is not safe to leave unattended. Payment truth and deadline evaluation must be contract-derived.
+- If existing circles do not hold adequate collateral, they cannot guarantee a full pot after default. No keeper fixes insolvency. The choices are to disclose partial pots, add a guarantor/reserve, collect collateral, or migrate before promising $1,200.
+- If the contract is pausable and either builder is the sole pauser/unpauser, a pause during the trip strands progress. Do not pause merely for absence; production ownership should be a multisig with available signers, and normal settlement must not require it.
+
+### Go/no-go drill before departure
+
+On a Base fork or Base Sepolia, reproduce the exact six-week interval with production bytecode and UI:
+
+1. Create and fund a 12-member circle; ensure builders use no member address and no privileged call.
+2. Advance past two deadlines. Have one member miss before their turn and another miss after receiving their turn.
+3. From a fresh, unprivileged address, finalize both months. Confirm both recipients can withdraw exactly $1,200 and collateral is debited correctly.
+4. Turn off the backend/automation and repeat using only the public UI and direct explorer call instructions.
+5. Empty the automation wallet and confirm members can still progress.
+6. Confirm monitoring alerts on an unfinalized deadline, low automation gas, failed transactions, USDC balance/invariant mismatch, and Base/sequencer incidents.
+
+Go only if this passes and at least two non-builder members know how to finalize. Otherwise pause creation of new circles and arrange coverage for existing ones; do not pretend cron is autonomy.
+
+## Chain and release runbook
+
+Launch on **Base mainnet (chain ID 8453)**: it has native USDC, low-friction EVM tooling, and makes $100 monthly payments practical. Configure native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, verified against [Circle's official address list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Do not accept bridged lookalikes.
+
+Assuming a Foundry repository and script `script/DeploySusu.s.sol:DeploySusu`, the release README should contain and CI should exercise these exact command shapes:
+
+```bash
+export BASE_RPC_URL='https://your-authenticated-base-rpc'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='...'
+export MEMBERS_FILE='./deploy/members.json'
+
+forge test
+forge test --fork-url "$BASE_RPC_URL"
+forge script script/DeploySusu.s.sol:DeploySusu \
+  --rpc-url "$BASE_RPC_URL" --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployment script must refuse the wrong chain ID, wrong USDC address, duplicate/zero members, non-increasing deadlines, deadlines already passed, or amounts other than the constants. Print the address and constructor arguments, then independently compare the verified source and arguments on the explorer.
+
+There should be no routine owner power. If an emergency pause is retained after review, assign it to a member-approved multisig with at least one available signer outside the two-person builder team; pausing withdrawals is strongly discouraged. Do not use an EOA owned by either builder.
+
+Post-deploy, first use a fresh small test circle configuration on Base with consenting test wallets, deposit collateral, activate, pay one installment, advance/finalize under the tested timing rules, and withdraw. A real $1,200 circle should not start until a fresh reviewer has checked the contract, deployment arguments, invariant tests, default economics, and the unattended drill.
+
+## Ship gate
+
+The MVP is ready only when the forfeited-pot policy is signed off, all twelve people understand the collateral requirement and irreversible default rule, contract logic has an independent security review, fork/invariant tests pass, source is verified, monitoring and public runbooks are live, and normal operation has been demonstrated with both builders completely absent. Existing circles that fail either the permissionless-liveness test or the collateral-solvency test need remediation before the six-week trip.

codex
A final liveness check found one subtle failure mode: if payments are allowed only for the contract’s “current month,” a delayed finalization can prevent everyone from paying the next month and falsely default them. I’m correcting the interface so scheduled payment windows remain usable even when settlement is behind.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144535Z-codex-with-skill-3/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..fca901ea96fd71db77cf035bc0f6b3acc9ba7f89
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,148 @@
+# Susu: shippable contract and six-week absence plan
+
+## Decision in one paragraph
+
+Ship one non-upgradeable `SusuCircle` contract on Base, initially for one circle, using native USDC. The twelve addresses, payout order, $100 installment, monthly deadlines, and default rules become immutable when the circle is activated. Members pay by pushing USDC into the contract; anyone may finalize a month after its deadline; the recipient withdraws rather than receiving USDC inside finalization. Do not make an admin, backend, or cron job necessary for progress. A keeper can be added as a convenience, but members must retain the permissionless path.
+
+There is an important correction to the proposed economics: earlier installments cannot cover a later missed installment if those installments were already included in earlier $1,200 pots. The same $100 cannot be paid twice. A circle that promises every recipient the full $1,200 therefore needs separately locked collateral (or outside credit). For an MVP with no underwriting, require each member to lock $1,200 before activation. Monthly installments remain $100, but a missed installment is taken from that member's collateral. At completion, unused collateral is returned. This is capital-heavy, but it is the smallest design that actually guarantees the rule and protects later recipients.
+
+## Product rules that must be agreed before deployment
+
+- Exactly 12 unique member addresses; one immutable payout slot per member.
+- `installment = 100_000000` and nominal pot `= 1_200_000000` USDC (USDC has six decimals). Use integer constants, never dollar-price oracles.
+- A member locks `1_200_000000` USDC collateral before activation. This covers all twelve possible installments and makes even a month-one disappearance solvent. A smaller bond is possible only with an explicit loss/underwriting model.
+- Month 0 starts at an agreed UTC timestamp. Each monthly period should be a fixed duration stated in the UI and contract. If “calendar month” is required, store all 12 UTC deadlines at creation; do not approximate it with 30 days.
+- Payment window closes at that month's immutable deadline. No admin discretion and no retroactive payment.
+- A first missed payment permanently marks the member defaulted. For that month and every remaining month, $100 is moved internally from their locked collateral into the month's pot. They cannot make later payments.
+- If a defaulted member's payout slot has not happened, that payout is forfeited. The pot for that slot must have a pre-agreed destination. Recommended: distribute it pro rata to the eleven non-defaulting members after the circle ends, not to an operator. This preserves a deterministic schedule without handing an admin a windfall.
+- If the member already received their payout, it cannot be clawed back. Their collateral still funds every remaining installment. This is why collateral, not “forfeiting a turn,” protects the circle after an early recipient defaults.
+- A member who pays every installment gets all unused collateral back. A defaulted member gets any collateral left after all of their remaining obligations have been charged, but no forfeited pot.
+- No member replacement, payout-order edit, deadline edit, early admin withdrawal, pausing of settlement, protocol fee, or yield strategy in v1.
+
+The forfeited-pot rule is a real product choice. If the family instead wants to skip that slot and finish early, define exactly which installments are no longer owed and reduce the schedule. Do not deploy with this unresolved.
+
+## Onchain boundary
+
+Onchain: membership and order, deadlines, installments received, collateral, default status, month finalization, claimable balances, refunds, and all USDC transfers. Emit events sufficient to reconstruct payment history and defaults.
+
+Offchain: names, avatars, reminders, contact details, explanations, transaction submission, event indexing, and display of the schedule. A reminder service improves experience but has no authority and is not required for correctness.
+
+## One-contract surface
+
+Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions. Accept only the immutable native-USDC token. Track obligations with internal accounting; do not loop over unbounded data (the only loops are capped at 12).
+
+Suggested lifecycle and functions:
+
+```solidity
+enum Status { Funding, Active, Complete, Cancelled }
+
+constructor(
+  IERC20 usdc,
+  address[12] membersInPayoutOrder,
+  uint64[12] deadlines,
+  address forfeitureBeneficiary // preferably the circle's final pro-rata pool logic
+)
+
+depositCollateral()                 // member transfers exactly $1,200
+activate()                          // permissionless once all 12 deposits exist
+cancelUnfunded()                    // permissionless after funding deadline
+refundCancelled()                   // member pull-refund
+pay(uint8 month)                    // member pays any presently open scheduled month
+finalizeMonth(uint8 month)          // anyone, only after deadline, exactly once
+withdrawPayout()                    // recipient pull-withdrawal
+withdrawCompletionBalance()         // collateral refund / forfeited-pot share
+```
+
+Keep the month argument. Payment windows must be based on the immutable schedule, not on the last finalized month. Otherwise, if nobody finalizes month 3 until after month 4's deadline, members would have been unable to pay month 4 and would all be falsely defaulted. Permit a member to prepay any started, unexpired month (and optionally future months if the UI labels that clearly), even while earlier finalization is behind. Require finalization in order so accounting stays simple. `finalizeMonth` should:
+
+1. Mark the month finalized before any external transfer.
+2. For each member with no recorded payment, permanently default them and debit $100 from their collateral for this month.
+3. For members already defaulted in an earlier month, debit $100 collateral for this month.
+4. Assert that exactly $1,200 is allocated to the pot.
+5. If the scheduled recipient is eligible, credit their `claimable` balance; otherwise credit the forfeited-pot pool.
+6. Advance `currentMonth`; after month 11, mark complete and calculate withdrawable collateral and pro-rata forfeiture shares.
+
+Never transfer to twelve members inside finalization. Use pull withdrawals so a bad recipient address cannot block progression. USDC itself is centrally administered and can freeze an address; a frozen recipient's withdrawal may fail, but the rest of the circle must still settle. Define a recovery policy before launch (recommended: no admin redirection; the member must resolve the freeze with Circle or accept that funds remain claimable).
+
+Use balance-before/balance-after checks for deposits and reject tokens other than the configured USDC. Maintain the invariant:
+
+```text
+contract USDC balance
+  >= total member collateral still locked
+   + total paid installments not yet allocated
+   + total claimable payouts/refunds
+```
+
+Key tests: all-pay happy path; default before turn; default after turn; multiple defaults; default in month 0 and month 11; exact-deadline boundary; double payment/finalization/withdrawal; failed USDC transfer; frozen recipient; cancellation before activation; all withdrawals; conservation of USDC after every state transition; fuzzed call order; and fork tests against Base's actual USDC.
+
+## Who makes the months happen
+
+Smart contracts do not wake up on a date. A deadline only makes `finalizeMonth()` callable; some account must submit the transaction.
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `depositCollateral()` | each member | joins the circle and becomes eligible | circle never activates; deposits become refundable after funding deadline |
+| `activate()` | any member | starts their circle | funds stay safely locked; activation waits |
+| `pay()` | each non-defaulted member | preserves their turn and collateral | after deadline, collateral is charged and they default |
+| `finalizeMonth()` | current recipient, any member, or keeper | recipient unlocks $1,200; members advance the circle | nothing executes automatically; funds remain safe and the next month cannot open |
+| `withdrawPayout()` | recipient | receives $1,200 | balance remains claimable |
+| completion withdrawal | each member | recovers collateral/share | balance remains claimable |
+
+The current recipient has a direct $1,200 incentive to finalize, so a keeper fee is unnecessary for v1. Provide a public “Finalize month” button and documented direct contract call. Optional automation should alert and submit `finalizeMonth`, but must use a replaceable, minimally funded key and must not possess owner powers.
+
+## Will running circles work while both builders are away for six weeks?
+
+**Only if the deployed contracts already have a permissionless, correctly incentivized finalization path. They will not run merely because deadlines pass.** Six weeks crosses at least one monthly deadline, so this must be tested before leaving.
+
+For the design above, the builders can disappear and circles remain operable:
+
+- Members still have to submit their monthly `pay()` transactions. An ERC-20 approval is not a scheduled payment and cannot initiate a transaction by itself.
+- At or after each deadline, the recipient or any other account must call `finalizeMonth()`.
+- The recipient then calls `withdrawPayout()`.
+- If no one finalizes, USDC is not lost and defaults are not silently excused, but settlement stalls: the pot is not allocated and withdrawals do not open until someone calls. Crucially, members can still pay installments for later scheduled months while finalization is behind; catching up must not manufacture defaults.
+- If the only finalizer is an owner/backend/keeper controlled by the two builders, the running circles **will break operationally** at the first deadline: settlement stalls for the full absence. The fix is a contract upgrade/migration to permissionless finalization, or keeping a monitored automation signer online. Automation alone is the weaker fix because outages and an empty gas balance recreate the same failure.
+- If settlement depends on an admin deciding who paid or who defaulted, it is not safe to leave unattended. Payment truth and deadline evaluation must be contract-derived.
+- If existing circles do not hold adequate collateral, they cannot guarantee a full pot after default. No keeper fixes insolvency. The choices are to disclose partial pots, add a guarantor/reserve, collect collateral, or migrate before promising $1,200.
+- If the contract is pausable and either builder is the sole pauser/unpauser, a pause during the trip strands progress. Do not pause merely for absence; production ownership should be a multisig with available signers, and normal settlement must not require it.
+
+### Go/no-go drill before departure
+
+On a Base fork or Base Sepolia, reproduce the exact six-week interval with production bytecode and UI:
+
+1. Create and fund a 12-member circle; ensure builders use no member address and no privileged call.
+2. Advance past two deadlines. Have one member miss before their turn and another miss after receiving their turn.
+3. From a fresh, unprivileged address, finalize both months. Confirm both recipients can withdraw exactly $1,200 and collateral is debited correctly.
+4. Turn off the backend/automation and repeat using only the public UI and direct explorer call instructions.
+5. Empty the automation wallet and confirm members can still progress.
+6. Confirm monitoring alerts on an unfinalized deadline, low automation gas, failed transactions, USDC balance/invariant mismatch, and Base/sequencer incidents.
+
+Go only if this passes and at least two non-builder members know how to finalize. Otherwise pause creation of new circles and arrange coverage for existing ones; do not pretend cron is autonomy.
+
+## Chain and release runbook
+
+Launch on **Base mainnet (chain ID 8453)**: it has native USDC, low-friction EVM tooling, and makes $100 monthly payments practical. Configure native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, verified against [Circle's official address list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Do not accept bridged lookalikes.
+
+Assuming a Foundry repository and script `script/DeploySusu.s.sol:DeploySusu`, the release README should contain and CI should exercise these exact command shapes:
+
+```bash
+export BASE_RPC_URL='https://your-authenticated-base-rpc'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='...'
+export MEMBERS_FILE='./deploy/members.json'
+
+forge test
+forge test --fork-url "$BASE_RPC_URL"
+forge script script/DeploySusu.s.sol:DeploySusu \
+  --rpc-url "$BASE_RPC_URL" --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployment script must refuse the wrong chain ID, wrong USDC address, duplicate/zero members, non-increasing deadlines, deadlines already passed, or amounts other than the constants. Print the address and constructor arguments, then independently compare the verified source and arguments on the explorer.
+
+There should be no routine owner power. If an emergency pause is retained after review, assign it to a member-approved multisig with at least one available signer outside the two-person builder team; pausing withdrawals is strongly discouraged. Do not use an EOA owned by either builder.
+
+Post-deploy, first use a fresh small test circle configuration on Base with consenting test wallets, deposit collateral, activate, pay one installment, advance/finalize under the tested timing rules, and withdraw. A real $1,200 circle should not start until a fresh reviewer has checked the contract, deployment arguments, invariant tests, default economics, and the unattended drill.
+
+## Ship gate
+
+The MVP is ready only when the forfeited-pot policy is signed off, all twelve people understand the collateral requirement and irreversible default rule, contract logic has an independent security review, fork/invariant tests pass, source is verified, monitoring and public runbooks are live, and normal operation has been demonstrated with both builders completely absent. Existing circles that fail either the permissionless-liveness test or the collateral-solvency test need remediation before the six-week trip.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..fca901ea96fd71db77cf035bc0f6b3acc9ba7f89
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,148 @@
+# Susu: shippable contract and six-week absence plan
+
+## Decision in one paragraph
+
+Ship one non-upgradeable `SusuCircle` contract on Base, initially for one circle, using native USDC. The twelve addresses, payout order, $100 installment, monthly deadlines, and default rules become immutable when the circle is activated. Members pay by pushing USDC into the contract; anyone may finalize a month after its deadline; the recipient withdraws rather than receiving USDC inside finalization. Do not make an admin, backend, or cron job necessary for progress. A keeper can be added as a convenience, but members must retain the permissionless path.
+
+There is an important correction to the proposed economics: earlier installments cannot cover a later missed installment if those installments were already included in earlier $1,200 pots. The same $100 cannot be paid twice. A circle that promises every recipient the full $1,200 therefore needs separately locked collateral (or outside credit). For an MVP with no underwriting, require each member to lock $1,200 before activation. Monthly installments remain $100, but a missed installment is taken from that member's collateral. At completion, unused collateral is returned. This is capital-heavy, but it is the smallest design that actually guarantees the rule and protects later recipients.
+
+## Product rules that must be agreed before deployment
+
+- Exactly 12 unique member addresses; one immutable payout slot per member.
+- `installment = 100_000000` and nominal pot `= 1_200_000000` USDC (USDC has six decimals). Use integer constants, never dollar-price oracles.
+- A member locks `1_200_000000` USDC collateral before activation. This covers all twelve possible installments and makes even a month-one disappearance solvent. A smaller bond is possible only with an explicit loss/underwriting model.
+- Month 0 starts at an agreed UTC timestamp. Each monthly period should be a fixed duration stated in the UI and contract. If “calendar month” is required, store all 12 UTC deadlines at creation; do not approximate it with 30 days.
+- Payment window closes at that month's immutable deadline. No admin discretion and no retroactive payment.
+- A first missed payment permanently marks the member defaulted. For that month and every remaining month, $100 is moved internally from their locked collateral into the month's pot. They cannot make later payments.
+- If a defaulted member's payout slot has not happened, that payout is forfeited. The pot for that slot must have a pre-agreed destination. Recommended: distribute it pro rata to the eleven non-defaulting members after the circle ends, not to an operator. This preserves a deterministic schedule without handing an admin a windfall.
+- If the member already received their payout, it cannot be clawed back. Their collateral still funds every remaining installment. This is why collateral, not “forfeiting a turn,” protects the circle after an early recipient defaults.
+- A member who pays every installment gets all unused collateral back. A defaulted member gets any collateral left after all of their remaining obligations have been charged, but no forfeited pot.
+- No member replacement, payout-order edit, deadline edit, early admin withdrawal, pausing of settlement, protocol fee, or yield strategy in v1.
+
+The forfeited-pot rule is a real product choice. If the family instead wants to skip that slot and finish early, define exactly which installments are no longer owed and reduce the schedule. Do not deploy with this unresolved.
+
+## Onchain boundary
+
+Onchain: membership and order, deadlines, installments received, collateral, default status, month finalization, claimable balances, refunds, and all USDC transfers. Emit events sufficient to reconstruct payment history and defaults.
+
+Offchain: names, avatars, reminders, contact details, explanations, transaction submission, event indexing, and display of the schedule. A reminder service improves experience but has no authority and is not required for correctness.
+
+## One-contract surface
+
+Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions. Accept only the immutable native-USDC token. Track obligations with internal accounting; do not loop over unbounded data (the only loops are capped at 12).
+
+Suggested lifecycle and functions:
+
+```solidity
+enum Status { Funding, Active, Complete, Cancelled }
+
+constructor(
+  IERC20 usdc,
+  address[12] membersInPayoutOrder,
+  uint64[12] deadlines,
+  address forfeitureBeneficiary // preferably the circle's final pro-rata pool logic
+)
+
+depositCollateral()                 // member transfers exactly $1,200
+activate()                          // permissionless once all 12 deposits exist
+cancelUnfunded()                    // permissionless after funding deadline
+refundCancelled()                   // member pull-refund
+pay(uint8 month)                    // member pays any presently open scheduled month
+finalizeMonth(uint8 month)          // anyone, only after deadline, exactly once
+withdrawPayout()                    // recipient pull-withdrawal
+withdrawCompletionBalance()         // collateral refund / forfeited-pot share
+```
+
+Keep the month argument. Payment windows must be based on the immutable schedule, not on the last finalized month. Otherwise, if nobody finalizes month 3 until after month 4's deadline, members would have been unable to pay month 4 and would all be falsely defaulted. Permit a member to prepay any started, unexpired month (and optionally future months if the UI labels that clearly), even while earlier finalization is behind. Require finalization in order so accounting stays simple. `finalizeMonth` should:
+
+1. Mark the month finalized before any external transfer.
+2. For each member with no recorded payment, permanently default them and debit $100 from their collateral for this month.
+3. For members already defaulted in an earlier month, debit $100 collateral for this month.
+4. Assert that exactly $1,200 is allocated to the pot.
+5. If the scheduled recipient is eligible, credit their `claimable` balance; otherwise credit the forfeited-pot pool.
+6. Advance `currentMonth`; after month 11, mark complete and calculate withdrawable collateral and pro-rata forfeiture shares.
+
+Never transfer to twelve members inside finalization. Use pull withdrawals so a bad recipient address cannot block progression. USDC itself is centrally administered and can freeze an address; a frozen recipient's withdrawal may fail, but the rest of the circle must still settle. Define a recovery policy before launch (recommended: no admin redirection; the member must resolve the freeze with Circle or accept that funds remain claimable).
+
+Use balance-before/balance-after checks for deposits and reject tokens other than the configured USDC. Maintain the invariant:
+
+```text
+contract USDC balance
+  >= total member collateral still locked
+   + total paid installments not yet allocated
+   + total claimable payouts/refunds
+```
+
+Key tests: all-pay happy path; default before turn; default after turn; multiple defaults; default in month 0 and month 11; exact-deadline boundary; double payment/finalization/withdrawal; failed USDC transfer; frozen recipient; cancellation before activation; all withdrawals; conservation of USDC after every state transition; fuzzed call order; and fork tests against Base's actual USDC.
+
+## Who makes the months happen
+
+Smart contracts do not wake up on a date. A deadline only makes `finalizeMonth()` callable; some account must submit the transaction.
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `depositCollateral()` | each member | joins the circle and becomes eligible | circle never activates; deposits become refundable after funding deadline |
+| `activate()` | any member | starts their circle | funds stay safely locked; activation waits |
+| `pay()` | each non-defaulted member | preserves their turn and collateral | after deadline, collateral is charged and they default |
+| `finalizeMonth()` | current recipient, any member, or keeper | recipient unlocks $1,200; members advance the circle | nothing executes automatically; funds remain safe and the next month cannot open |
+| `withdrawPayout()` | recipient | receives $1,200 | balance remains claimable |
+| completion withdrawal | each member | recovers collateral/share | balance remains claimable |
+
+The current recipient has a direct $1,200 incentive to finalize, so a keeper fee is unnecessary for v1. Provide a public “Finalize month” button and documented direct contract call. Optional automation should alert and submit `finalizeMonth`, but must use a replaceable, minimally funded key and must not possess owner powers.
+
+## Will running circles work while both builders are away for six weeks?
+
+**Only if the deployed contracts already have a permissionless, correctly incentivized finalization path. They will not run merely because deadlines pass.** Six weeks crosses at least one monthly deadline, so this must be tested before leaving.
+
+For the design above, the builders can disappear and circles remain operable:
+
+- Members still have to submit their monthly `pay()` transactions. An ERC-20 approval is not a scheduled payment and cannot initiate a transaction by itself.
+- At or after each deadline, the recipient or any other account must call `finalizeMonth()`.
+- The recipient then calls `withdrawPayout()`.
+- If no one finalizes, USDC is not lost and defaults are not silently excused, but settlement stalls: the pot is not allocated and withdrawals do not open until someone calls. Crucially, members can still pay installments for later scheduled months while finalization is behind; catching up must not manufacture defaults.
+- If the only finalizer is an owner/backend/keeper controlled by the two builders, the running circles **will break operationally** at the first deadline: settlement stalls for the full absence. The fix is a contract upgrade/migration to permissionless finalization, or keeping a monitored automation signer online. Automation alone is the weaker fix because outages and an empty gas balance recreate the same failure.
+- If settlement depends on an admin deciding who paid or who defaulted, it is not safe to leave unattended. Payment truth and deadline evaluation must be contract-derived.
+- If existing circles do not hold adequate collateral, they cannot guarantee a full pot after default. No keeper fixes insolvency. The choices are to disclose partial pots, add a guarantor/reserve, collect collateral, or migrate before promising $1,200.
+- If the contract is pausable and either builder is the sole pauser/unpauser, a pause during the trip strands progress. Do not pause merely for absence; production ownership should be a multisig with available signers, and normal settlement must not require it.
+
+### Go/no-go drill before departure
+
+On a Base fork or Base Sepolia, reproduce the exact six-week interval with production bytecode and UI:
+
+1. Create and fund a 12-member circle; ensure builders use no member address and no privileged call.
+2. Advance past two deadlines. Have one member miss before their turn and another miss after receiving their turn.
+3. From a fresh, unprivileged address, finalize both months. Confirm both recipients can withdraw exactly $1,200 and collateral is debited correctly.
+4. Turn off the backend/automation and repeat using only the public UI and direct explorer call instructions.
+5. Empty the automation wallet and confirm members can still progress.
+6. Confirm monitoring alerts on an unfinalized deadline, low automation gas, failed transactions, USDC balance/invariant mismatch, and Base/sequencer incidents.
+
+Go only if this passes and at least two non-builder members know how to finalize. Otherwise pause creation of new circles and arrange coverage for existing ones; do not pretend cron is autonomy.
+
+## Chain and release runbook
+
+Launch on **Base mainnet (chain ID 8453)**: it has native USDC, low-friction EVM tooling, and makes $100 monthly payments practical. Configure native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, verified against [Circle's official address list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Do not accept bridged lookalikes.
+
+Assuming a Foundry repository and script `script/DeploySusu.s.sol:DeploySusu`, the release README should contain and CI should exercise these exact command shapes:
+
+```bash
+export BASE_RPC_URL='https://your-authenticated-base-rpc'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='...'
+export MEMBERS_FILE='./deploy/members.json'
+
+forge test
+forge test --fork-url "$BASE_RPC_URL"
+forge script script/DeploySusu.s.sol:DeploySusu \
+  --rpc-url "$BASE_RPC_URL" --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployment script must refuse the wrong chain ID, wrong USDC address, duplicate/zero members, non-increasing deadlines, deadlines already passed, or amounts other than the constants. Print the address and constructor arguments, then independently compare the verified source and arguments on the explorer.
+
+There should be no routine owner power. If an emergency pause is retained after review, assign it to a member-approved multisig with at least one available signer outside the two-person builder team; pausing withdrawals is strongly discouraged. Do not use an EOA owned by either builder.
+
+Post-deploy, first use a fresh small test circle configuration on Base with consenting test wallets, deposit collateral, activate, pay one installment, advance/finalize under the tested timing rules, and withdraw. A real $1,200 circle should not start until a fresh reviewer has checked the contract, deployment arguments, invariant tests, default economics, and the unattended drill.
+
+## Ship gate
+
+The MVP is ready only when the forfeited-pot policy is signed off, all twelve people understand the collateral requirement and irreversible default rule, contract logic has an independent security review, fork/invariant tests pass, source is verified, monitoring and public runbooks are live, and normal operation has been demonstrated with both builders completely absent. Existing circles that fail either the permissionless-liveness test or the collateral-solvency test need remediation before the six-week trip.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144535Z-codex-with-skill-3/workspace/plan.md).

It includes:

- The collateralized contract design and default economics.
- Permissionless monthly settlement and withdrawal paths.
- The precise six-week liveness analysis.
- What breaks with admin-only automation or insufficient collateral.
- An unattended-operation drill, Base deployment runbook, invariants, and test requirements.

The central finding: contracts do not execute when deadlines pass. Existing circles remain operational only if an incentivized party can finalize permissionlessly—and previous contributions cannot cover future defaults unless separate collateral or a guarantor exists.
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..fca901ea96fd71db77cf035bc0f6b3acc9ba7f89
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,148 @@
+# Susu: shippable contract and six-week absence plan
+
+## Decision in one paragraph
+
+Ship one non-upgradeable `SusuCircle` contract on Base, initially for one circle, using native USDC. The twelve addresses, payout order, $100 installment, monthly deadlines, and default rules become immutable when the circle is activated. Members pay by pushing USDC into the contract; anyone may finalize a month after its deadline; the recipient withdraws rather than receiving USDC inside finalization. Do not make an admin, backend, or cron job necessary for progress. A keeper can be added as a convenience, but members must retain the permissionless path.
+
+There is an important correction to the proposed economics: earlier installments cannot cover a later missed installment if those installments were already included in earlier $1,200 pots. The same $100 cannot be paid twice. A circle that promises every recipient the full $1,200 therefore needs separately locked collateral (or outside credit). For an MVP with no underwriting, require each member to lock $1,200 before activation. Monthly installments remain $100, but a missed installment is taken from that member's collateral. At completion, unused collateral is returned. This is capital-heavy, but it is the smallest design that actually guarantees the rule and protects later recipients.
+
+## Product rules that must be agreed before deployment
+
+- Exactly 12 unique member addresses; one immutable payout slot per member.
+- `installment = 100_000000` and nominal pot `= 1_200_000000` USDC (USDC has six decimals). Use integer constants, never dollar-price oracles.
+- A member locks `1_200_000000` USDC collateral before activation. This covers all twelve possible installments and makes even a month-one disappearance solvent. A smaller bond is possible only with an explicit loss/underwriting model.
+- Month 0 starts at an agreed UTC timestamp. Each monthly period should be a fixed duration stated in the UI and contract. If “calendar month” is required, store all 12 UTC deadlines at creation; do not approximate it with 30 days.
+- Payment window closes at that month's immutable deadline. No admin discretion and no retroactive payment.
+- A first missed payment permanently marks the member defaulted. For that month and every remaining month, $100 is moved internally from their locked collateral into the month's pot. They cannot make later payments.
+- If a defaulted member's payout slot has not happened, that payout is forfeited. The pot for that slot must have a pre-agreed destination. Recommended: distribute it pro rata to the eleven non-defaulting members after the circle ends, not to an operator. This preserves a deterministic schedule without handing an admin a windfall.
+- If the member already received their payout, it cannot be clawed back. Their collateral still funds every remaining installment. This is why collateral, not “forfeiting a turn,” protects the circle after an early recipient defaults.
+- A member who pays every installment gets all unused collateral back. A defaulted member gets any collateral left after all of their remaining obligations have been charged, but no forfeited pot.
+- No member replacement, payout-order edit, deadline edit, early admin withdrawal, pausing of settlement, protocol fee, or yield strategy in v1.
+
+The forfeited-pot rule is a real product choice. If the family instead wants to skip that slot and finish early, define exactly which installments are no longer owed and reduce the schedule. Do not deploy with this unresolved.
+
+## Onchain boundary
+
+Onchain: membership and order, deadlines, installments received, collateral, default status, month finalization, claimable balances, refunds, and all USDC transfers. Emit events sufficient to reconstruct payment history and defaults.
+
+Offchain: names, avatars, reminders, contact details, explanations, transaction submission, event indexing, and display of the schedule. A reminder service improves experience but has no authority and is not required for correctness.
+
+## One-contract surface
+
+Use OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and checks-effects-interactions. Accept only the immutable native-USDC token. Track obligations with internal accounting; do not loop over unbounded data (the only loops are capped at 12).
+
+Suggested lifecycle and functions:
+
+```solidity
+enum Status { Funding, Active, Complete, Cancelled }
+
+constructor(
+  IERC20 usdc,
+  address[12] membersInPayoutOrder,
+  uint64[12] deadlines,
+  address forfeitureBeneficiary // preferably the circle's final pro-rata pool logic
+)
+
+depositCollateral()                 // member transfers exactly $1,200
+activate()                          // permissionless once all 12 deposits exist
+cancelUnfunded()                    // permissionless after funding deadline
+refundCancelled()                   // member pull-refund
+pay(uint8 month)                    // member pays any presently open scheduled month
+finalizeMonth(uint8 month)          // anyone, only after deadline, exactly once
+withdrawPayout()                    // recipient pull-withdrawal
+withdrawCompletionBalance()         // collateral refund / forfeited-pot share
+```
+
+Keep the month argument. Payment windows must be based on the immutable schedule, not on the last finalized month. Otherwise, if nobody finalizes month 3 until after month 4's deadline, members would have been unable to pay month 4 and would all be falsely defaulted. Permit a member to prepay any started, unexpired month (and optionally future months if the UI labels that clearly), even while earlier finalization is behind. Require finalization in order so accounting stays simple. `finalizeMonth` should:
+
+1. Mark the month finalized before any external transfer.
+2. For each member with no recorded payment, permanently default them and debit $100 from their collateral for this month.
+3. For members already defaulted in an earlier month, debit $100 collateral for this month.
+4. Assert that exactly $1,200 is allocated to the pot.
+5. If the scheduled recipient is eligible, credit their `claimable` balance; otherwise credit the forfeited-pot pool.
+6. Advance `currentMonth`; after month 11, mark complete and calculate withdrawable collateral and pro-rata forfeiture shares.
+
+Never transfer to twelve members inside finalization. Use pull withdrawals so a bad recipient address cannot block progression. USDC itself is centrally administered and can freeze an address; a frozen recipient's withdrawal may fail, but the rest of the circle must still settle. Define a recovery policy before launch (recommended: no admin redirection; the member must resolve the freeze with Circle or accept that funds remain claimable).
+
+Use balance-before/balance-after checks for deposits and reject tokens other than the configured USDC. Maintain the invariant:
+
+```text
+contract USDC balance
+  >= total member collateral still locked
+   + total paid installments not yet allocated
+   + total claimable payouts/refunds
+```
+
+Key tests: all-pay happy path; default before turn; default after turn; multiple defaults; default in month 0 and month 11; exact-deadline boundary; double payment/finalization/withdrawal; failed USDC transfer; frozen recipient; cancellation before activation; all withdrawals; conservation of USDC after every state transition; fuzzed call order; and fork tests against Base's actual USDC.
+
+## Who makes the months happen
+
+Smart contracts do not wake up on a date. A deadline only makes `finalizeMonth()` callable; some account must submit the transaction.
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `depositCollateral()` | each member | joins the circle and becomes eligible | circle never activates; deposits become refundable after funding deadline |
+| `activate()` | any member | starts their circle | funds stay safely locked; activation waits |
+| `pay()` | each non-defaulted member | preserves their turn and collateral | after deadline, collateral is charged and they default |
+| `finalizeMonth()` | current recipient, any member, or keeper | recipient unlocks $1,200; members advance the circle | nothing executes automatically; funds remain safe and the next month cannot open |
+| `withdrawPayout()` | recipient | receives $1,200 | balance remains claimable |
+| completion withdrawal | each member | recovers collateral/share | balance remains claimable |
+
+The current recipient has a direct $1,200 incentive to finalize, so a keeper fee is unnecessary for v1. Provide a public “Finalize month” button and documented direct contract call. Optional automation should alert and submit `finalizeMonth`, but must use a replaceable, minimally funded key and must not possess owner powers.
+
+## Will running circles work while both builders are away for six weeks?
+
+**Only if the deployed contracts already have a permissionless, correctly incentivized finalization path. They will not run merely because deadlines pass.** Six weeks crosses at least one monthly deadline, so this must be tested before leaving.
+
+For the design above, the builders can disappear and circles remain operable:
+
+- Members still have to submit their monthly `pay()` transactions. An ERC-20 approval is not a scheduled payment and cannot initiate a transaction by itself.
+- At or after each deadline, the recipient or any other account must call `finalizeMonth()`.
+- The recipient then calls `withdrawPayout()`.
+- If no one finalizes, USDC is not lost and defaults are not silently excused, but settlement stalls: the pot is not allocated and withdrawals do not open until someone calls. Crucially, members can still pay installments for later scheduled months while finalization is behind; catching up must not manufacture defaults.
+- If the only finalizer is an owner/backend/keeper controlled by the two builders, the running circles **will break operationally** at the first deadline: settlement stalls for the full absence. The fix is a contract upgrade/migration to permissionless finalization, or keeping a monitored automation signer online. Automation alone is the weaker fix because outages and an empty gas balance recreate the same failure.
+- If settlement depends on an admin deciding who paid or who defaulted, it is not safe to leave unattended. Payment truth and deadline evaluation must be contract-derived.
+- If existing circles do not hold adequate collateral, they cannot guarantee a full pot after default. No keeper fixes insolvency. The choices are to disclose partial pots, add a guarantor/reserve, collect collateral, or migrate before promising $1,200.
+- If the contract is pausable and either builder is the sole pauser/unpauser, a pause during the trip strands progress. Do not pause merely for absence; production ownership should be a multisig with available signers, and normal settlement must not require it.
+
+### Go/no-go drill before departure
+
+On a Base fork or Base Sepolia, reproduce the exact six-week interval with production bytecode and UI:
+
+1. Create and fund a 12-member circle; ensure builders use no member address and no privileged call.
+2. Advance past two deadlines. Have one member miss before their turn and another miss after receiving their turn.
+3. From a fresh, unprivileged address, finalize both months. Confirm both recipients can withdraw exactly $1,200 and collateral is debited correctly.
+4. Turn off the backend/automation and repeat using only the public UI and direct explorer call instructions.
+5. Empty the automation wallet and confirm members can still progress.
+6. Confirm monitoring alerts on an unfinalized deadline, low automation gas, failed transactions, USDC balance/invariant mismatch, and Base/sequencer incidents.
+
+Go only if this passes and at least two non-builder members know how to finalize. Otherwise pause creation of new circles and arrange coverage for existing ones; do not pretend cron is autonomy.
+
+## Chain and release runbook
+
+Launch on **Base mainnet (chain ID 8453)**: it has native USDC, low-friction EVM tooling, and makes $100 monthly payments practical. Configure native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, verified against [Circle's official address list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Do not accept bridged lookalikes.
+
+Assuming a Foundry repository and script `script/DeploySusu.s.sol:DeploySusu`, the release README should contain and CI should exercise these exact command shapes:
+
+```bash
+export BASE_RPC_URL='https://your-authenticated-base-rpc'
+export BASESCAN_API_KEY='...'
+export DEPLOYER_PRIVATE_KEY='...'
+export MEMBERS_FILE='./deploy/members.json'
+
+forge test
+forge test --fork-url "$BASE_RPC_URL"
+forge script script/DeploySusu.s.sol:DeploySusu \
+  --rpc-url "$BASE_RPC_URL" --broadcast --verify \
+  --etherscan-api-key "$BASESCAN_API_KEY"
+```
+
+The deployment script must refuse the wrong chain ID, wrong USDC address, duplicate/zero members, non-increasing deadlines, deadlines already passed, or amounts other than the constants. Print the address and constructor arguments, then independently compare the verified source and arguments on the explorer.
+
+There should be no routine owner power. If an emergency pause is retained after review, assign it to a member-approved multisig with at least one available signer outside the two-person builder team; pausing withdrawals is strongly discouraged. Do not use an EOA owned by either builder.
+
+Post-deploy, first use a fresh small test circle configuration on Base with consenting test wallets, deposit collateral, activate, pay one installment, advance/finalize under the tested timing rules, and withdraw. A real $1,200 circle should not start until a fresh reviewer has checked the contract, deployment arguments, invariant tests, default economics, and the unattended drill.
+
+## Ship gate
+
+The MVP is ready only when the forfeited-pot policy is signed off, all twelve people understand the collateral requirement and irreversible default rule, contract logic has an independent security review, fork/invariant tests pass, source is verified, monitoring and public runbooks are live, and normal operation has been demonstrated with both builders completely absent. Existing circles that fail either the permissionless-liveness test or the collateral-solvency test need remediation before the six-week trip.

tokens used
25,266
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-003/2026-08-28T144535Z-codex-with-skill-3/workspace/plan.md).

It includes:

- The collateralized contract design and default economics.
- Permissionless monthly settlement and withdrawal paths.
- The precise six-week liveness analysis.
- What breaks with admin-only automation or insufficient collateral.
- An unattended-operation drill, Base deployment runbook, invariants, and test requirements.

The central finding: contracts do not execute when deadlines pass. Existing circles remain operational only if an incentivized party can finalize permissionlessly—and previous contributions cannot cover future defaults unless separate collateral or a guarantor exists.
