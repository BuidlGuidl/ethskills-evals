OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-004/2026-08-28T145230Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048db-ab6a-7741-a7ea-40950c6e8d18
--------
user
We publish a newsletter about our city's restaurants — around 200,000
subscribers, almost none of whom have used a crypto wallet, though many
already have Coinbase accounts. We want readers to tip a line cook directly;
tips run $1-$5 and arrive in bursts after each issue.

Two things before we commit to a build. Write the walkthrough of a first-time
reader's first tip — every screen, and everything they have to install, sign
up for, or fund before the money reaches the cook. Then tell me what would
have to change about this product for that setup to be the wrong one.

Write your answer to plan.md in this directory.

2026-08-28T14:52:31.196811Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048db-ab6a-7741-a7ea-40950c6e8d18.tmp-1787928750957900193: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this decision hinges on the smallest viable onchain boundary, the launch chain, and the reader/cook transaction flow. I’ll turn those constraints into a concrete first-tip walkthrough and explicit conditions that would invalidate the recommended setup.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-004/2026-08-28T145230Z-codex-with-skill-1/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: ship
description: "Scope a dApp or MVP and make it ready to build and release: decide the onchain boundary, minimal contract surface, state-transition callers and incentives, one launch chain, and the deployment runbook. Use before implementation or when a build lacks these decisions. Route detailed implementation, deployment, and audit work to their focused skills."
---

# Ship a dApp

Before coding, write down the smallest vertical slice that can ship. Decide what
is onchain, how many custom contracts it needs, who advances every state
transition, and one deployment target. Do not expand into a full application or
fetch every related skill before this plan is concrete.

## Architecture

Put only trustless ownership, value transfer, composability, censorship
resistance, or permanent commitments onchain. Keep profiles, descriptions,
media, search, filtering, and frequently changing rules in an offchain store;
put a content hash or URI onchain only when verification needs it.

Treat reputation and rankings as derived data. Emit the facts needed to compute
them, then calculate and sort offchain. Do not maintain a computed score,
leaderboard, or paginated ranking in contract storage merely to serve a browse
screen. Recording counters that settlement already needs is fine.

Prefer existing audited protocols and primitives. Most MVPs need zero to two
custom contracts, and three is the upper bound before reducing scope. Do not add a
factory, escrow, router, or fee-splitter unless its separate trust boundary is
required by the product.

When integrating a deployed protocol, use a verified address from the relevant
chain's official documentation or the `addresses` skill. Never invent or infer
an address: a wrong address can send approvals or funds to an attacker.

## State transitions

Contracts do not run on schedules. For each state-changing function, record:

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `claimPayout()` | recipient | receives the payout | funds remain claimable |
| permissionless settlement | keeper or participant | explicit fee or direct benefit | settlement waits |

Naming a permissionless caller is not an incentive. Identify the caller's
benefit and the source of any keeper fee. Prefer self-serve or permissionless
paths over an owner-only cron job; automation may be a convenience, but it must
not be the only liveness path.

Include the completed transition table in the project README, especially for
every function that moves funds.

## Chain and deployment decision

Choose one target chain for the first release and state why its capabilities fit
the product. Measure current fees when cost affects the decision; do not rely on
remembered gas prices. An L2 should be selected for a concrete product fit such
as its distribution, liquidity, account abstraction, or ecosystem—not merely
because “Ethereum is expensive.”

Before calling the MVP shippable, the README must name the target and contain
the exact deploy and verification commands, required environment variables,
contract ownership destination, and a small post-deploy transaction to verify
the path end to end. Do not leave the network or deployment procedure as TBD.

## Minimal ship checklist

- Onchain/offchain boundary is explicit, including where rankings are computed.
- Custom contract list is concrete and no larger than the MVP requires.
- Every state transition has a caller, incentive, and safe no-caller outcome.
- One target chain is selected for a product-specific reason.
- Tests cover custom logic and external integrations use a fork.
- README contains the transition table and executable deployment runbook.
- Contracts are verified and production ownership goes to the intended multisig.
- A fresh reviewer checks the finished vertical slice before launch.

Fetch another focused skill only when the plan reaches that phase and needs its
details—for example `addresses`, `l2s`, `gas`, `security`, `testing`,
`frontend-ux`, `frontend-playbook`, or `qa`. Skills are available at
`https://ethskills.com/<skill>/SKILL.md`. `ship` owns the product and release
decisions; use `frontend-playbook` for detailed hosting/deployment mechanics and
`qa` for the independent pre-launch review. Stop when the requested vertical
slice and its runbook are complete.

codex
The likely fit is a gas-sponsored USDC tip on Base with an embedded/passkey wallet, not a conventional “install a wallet, buy ETH, bridge, then tip” flow. I’m checking the current official wallet/onramp capabilities so the walkthrough reflects what a reader would actually see today.
web search: 
web search: site:docs.cdp.coinbase.com embedded wallets Coinbase account authentication Base USDC onramp ...
codex
One constraint changes the product recommendation: Coinbase documents an approximately $5 minimum for guest card/Apple Pay/Google Pay purchases. So a truthful launch cannot promise a clean $1 first tip unless testing confirms authenticated Coinbase balances support it; the plan will make $5 the first-tip floor and treat $1–$4 as an explicit invalidation trigger, not hide the extra funding friction.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-004/2026-08-28T145230Z-codex-with-skill-1/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0da628a7161dbe703f44dde9fcf493a4a0156d45
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,66 @@
+# First-tip product plan
+
+## Recommendation
+
+Launch a web tip page that sends **USDC on Base straight to the cook's wallet using Coinbase-hosted Onramp**. Do not make the reader install a wallet, create a newsletter account, buy ETH, bridge funds, or keep a crypto balance. Do not deploy a custom contract for the MVP.
+
+This is the smallest honest onchain boundary: the only onchain action is the USDC transfer to the cook. The newsletter stores the cook's profile, issue association, verified payout address, and transaction status offchain. Coinbase handles the reader's regulated purchase flow. Base is the single launch network because Coinbase Onramp can deliver USDC to a specified Base address, existing Coinbase users can use their saved balance or payment methods, and sponsored USDC transfers are supported in Coinbase's Base wallet stack ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Base gasless-transfer example](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)).
+
+There is an important launch constraint: make the first-tip buttons **$5 only**, pending production tests of authenticated Coinbase accounts. Coinbase documents a roughly $5 minimum for guest debit-card and Apple/Google Pay purchases; it does not promise that every $1–$4 route works ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Advertising $1 tips before proving the actual quote and minimum would produce a misleading or broken flow.
+
+## A first-time reader's first tip
+
+Assume the cook has already completed the recipient setup below and the reader already has a verified Coinbase account with either a USD/USDC balance or a linked payment method.
+
+1. **Newsletter.** Under the cook's story, the reader sees “Tip Ana $5.” Supporting text says “Ana receives USDC (about $5) in her wallet,” names Base, and links to a plain-language disclosure that the transfer is public and irreversible. The button is a normal HTTPS link; no app is required.
+
+2. **Tip page.** A mobile web page shows Ana's verified name/photo, `$5 tip`, `Ana receives 5 USDC`, the network (`Base`), and any Coinbase fee before commitment. It does not expose or ask the reader to copy an address. The page offers **Continue with Coinbase** and explains that the reader will briefly go to Coinbase to pay. The newsletter backend creates a single-use Onramp session fixed to USDC, Base, $5, and Ana's allowlisted address. Coinbase's API supports preset purchase amounts and a destination network/address ([session API](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-session)).
+
+3. **Coinbase sign-in.** Coinbase's hosted page opens. The reader chooses sign in, enters the email/password or passkey for the Coinbase account, and completes whatever two-factor or device confirmation Coinbase requests. They are not creating a newsletter account or a self-custody wallet. If already signed in on that device, this may collapse to a confirmation.
+
+4. **Funding source.** Coinbase shows eligible sources: an existing fiat or crypto balance and/or a linked bank or debit card. The reader selects one. If none is usable, they must link or fund one and may have to complete Coinbase identity checks or wait for a bank transfer; the tip has not happened yet. Existing users can use Coinbase balances and linked bank/debit methods ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)).
+
+5. **Coinbase review.** The screen shows the $5 purchase/send, USDC, Base destination, exchange/network fees, payment source, and total charged. The reader taps **Confirm & send** and completes any final bank, card, or Coinbase verification. The exact Coinbase labels can change; these are product requirements, not claims that we control its hosted copy.
+
+6. **Processing.** Coinbase buys or draws 5 USDC and sends it to Ana's Base address. A progress screen says not to retry. Our backend watches that address/transaction and deduplicates by Onramp session and transaction hash; an Onramp redirect alone is not proof of payment.
+
+7. **Receipt.** After chain confirmation, the reader returns to “Ana received 5 USDC,” with an optional Base explorer link and email receipt from Coinbase. The page offers “Back to the issue,” not a prompt to install a wallet. If payment succeeds but the redirect fails, the newsletter can recover status from Coinbase/webhook and show it when the signed session URL is reopened.
+
+### Everything the reader must have or do
+
+- Install: **nothing**; a browser is enough.
+- Sign up: **nothing new** if the Coinbase account remains usable. They do sign into Coinbase and may face 2FA or refreshed identity verification.
+- Fund: have an eligible Coinbase balance or linked payment source covering the tip **plus the disclosed fee**. If not, add/link one inside Coinbase. They do not acquire ETH or pay gas separately.
+- Hold afterward: nothing. The reader never needs a wallet or stranded crypto balance.
+
+### What the cook must do first
+
+The newsletter cannot make this invisible on both sides. Ana creates or designates a wallet that supports Base USDC (a Coinbase Wallet/embedded wallet is acceptable), secures its recovery method, submits the Base address, and proves control with a signature. The newsletter verifies her real-world identity and employment, shows her a test transfer, and explains public balances, irreversible transfers, taxes, and cash-out fees. To receive dollars in a bank, she also needs a supported off-ramp; Coinbase says ACH off-ramp requires a Coinbase account with linked bank details ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Until she cashes out, she has USDC, not bank dollars.
+
+## Onchain scope and liveness
+
+There are **zero custom contracts**. One transfer settles one tip; bursts after an issue create independent transfers and require no batch job or privileged settlement.
+
+| Transition | Caller | Why they act/pay | If nobody acts |
+| --- | --- | --- | --- |
+| Buy/send USDC to cook | Reader through Coinbase Onramp | Wants to tip; Coinbase quotes the complete charge | No charge and no tip |
+| Confirm/index receipt | Newsletter backend, reading Coinbase status and Base | Gives reader and cook a receipt; no onchain gas | Funds still reach the cook; UI remains pending until reconciled |
+| Convert USDC to bank money | Cook through chosen off-ramp | Wants spendable fiat and accepts quoted fees | USDC remains under the cook's control |
+
+Before launch, run production-sized $5 tests from each offered Coinbase funding source, confirm the net amount at the cook address, test duplicate clicks and failed redirects, and load-test session creation/webhooks for the post-issue burst. If fees make “Ana receives 5 USDC” false, show the exact net amount or subsidize the difference; never silently deduct it from the cook.
+
+## What would make this the wrong setup
+
+Change the architecture when the product changes in any of these ways:
+
+- **$1–$4 must work as true one-off tips.** If production quotes enforce a $5 minimum or fees are material, direct fiat-to-chain onramping per tip is wrong. Use ordinary card/Apple Pay collection into a disclosed custodial ledger and batch payouts to cooks, or subsidize minimums/fees. That is no longer a direct per-reader onchain transfer and brings money-transmission, custody, chargeback, accounting, and payout compliance work.
+- **Most readers are not eligible Coinbase users.** If the audience is outside supported regions, lacks reusable funding methods, or refuses Coinbase, add a second regulated payment/onramp provider or make fiat tipping primary. Do not compensate by forcing wallet installation.
+- **The reader should tip repeatedly.** If repeat behavior matters more than a one-time issue spike, an embedded smart wallet funded once and gas-sponsored USDC transfers may beat repeated Coinbase checkout. That adds wallet creation/recovery, balance management, and a clear withdrawal path—the very friction this MVP avoids.
+- **One payment must split among a kitchen team, fund a pool, vest, match, refund, or release conditionally.** A direct transfer cannot enforce those rules. Introduce one narrowly scoped, audited splitter/escrow contract only after specifying who can trigger every release and why; do not use a contract merely for analytics.
+- **Cooks require dollars immediately or cannot manage wallets/taxes/off-ramping.** Pay them through fiat payroll/payout rails. Calling USDC “dollars delivered” would be deceptive when the recipient bears conversion work and fees.
+- **Private tips or hidden recipient balances are required.** Base transfers are public. Use fiat rails or a purpose-built privacy system after legal/security review; changing only the UI does not provide privacy.
+- **Tips must be reversible or support chargebacks and disputes.** Direct onchain settlement is irreversible. Use an intermediary/escrow and accept that the tip is no longer immediately under the cook's sole control.
+- **The newsletter needs to take a fee or guarantee an exact net payout across providers.** Direct-to-cook Onramp may not express that policy cleanly. A payment processor or a minimal splitter becomes necessary, along with explicit fee disclosure and additional compliance review.
+- **Cooks want composable onchain history, but readers also need persistent identities, balances, or rewards.** Then a reader wallet and perhaps signed attestations become product features rather than accidental infrastructure. Keep profiles, rankings, and restaurant content offchain; add a contract only for commitments that truly need trustless enforcement.
+
+The go/no-go test is therefore simple: ship this setup only if a representative reader can send a tested $5 tip from an existing Coinbase account, the cook receives the promised USDC amount on Base, and both parties understand that the cook—not the newsletter—controls and cashes out the funds. If $1 tipping is non-negotiable, this direct-Onramp design should not be approved without evidence that the $1 route works economically and operationally.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0da628a7161dbe703f44dde9fcf493a4a0156d45
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,66 @@
+# First-tip product plan
+
+## Recommendation
+
+Launch a web tip page that sends **USDC on Base straight to the cook's wallet using Coinbase-hosted Onramp**. Do not make the reader install a wallet, create a newsletter account, buy ETH, bridge funds, or keep a crypto balance. Do not deploy a custom contract for the MVP.
+
+This is the smallest honest onchain boundary: the only onchain action is the USDC transfer to the cook. The newsletter stores the cook's profile, issue association, verified payout address, and transaction status offchain. Coinbase handles the reader's regulated purchase flow. Base is the single launch network because Coinbase Onramp can deliver USDC to a specified Base address, existing Coinbase users can use their saved balance or payment methods, and sponsored USDC transfers are supported in Coinbase's Base wallet stack ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Base gasless-transfer example](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)).
+
+There is an important launch constraint: make the first-tip buttons **$5 only**, pending production tests of authenticated Coinbase accounts. Coinbase documents a roughly $5 minimum for guest debit-card and Apple/Google Pay purchases; it does not promise that every $1–$4 route works ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Advertising $1 tips before proving the actual quote and minimum would produce a misleading or broken flow.
+
+## A first-time reader's first tip
+
+Assume the cook has already completed the recipient setup below and the reader already has a verified Coinbase account with either a USD/USDC balance or a linked payment method.
+
+1. **Newsletter.** Under the cook's story, the reader sees “Tip Ana $5.” Supporting text says “Ana receives USDC (about $5) in her wallet,” names Base, and links to a plain-language disclosure that the transfer is public and irreversible. The button is a normal HTTPS link; no app is required.
+
+2. **Tip page.** A mobile web page shows Ana's verified name/photo, `$5 tip`, `Ana receives 5 USDC`, the network (`Base`), and any Coinbase fee before commitment. It does not expose or ask the reader to copy an address. The page offers **Continue with Coinbase** and explains that the reader will briefly go to Coinbase to pay. The newsletter backend creates a single-use Onramp session fixed to USDC, Base, $5, and Ana's allowlisted address. Coinbase's API supports preset purchase amounts and a destination network/address ([session API](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-session)).
+
+3. **Coinbase sign-in.** Coinbase's hosted page opens. The reader chooses sign in, enters the email/password or passkey for the Coinbase account, and completes whatever two-factor or device confirmation Coinbase requests. They are not creating a newsletter account or a self-custody wallet. If already signed in on that device, this may collapse to a confirmation.
+
+4. **Funding source.** Coinbase shows eligible sources: an existing fiat or crypto balance and/or a linked bank or debit card. The reader selects one. If none is usable, they must link or fund one and may have to complete Coinbase identity checks or wait for a bank transfer; the tip has not happened yet. Existing users can use Coinbase balances and linked bank/debit methods ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)).
+
+5. **Coinbase review.** The screen shows the $5 purchase/send, USDC, Base destination, exchange/network fees, payment source, and total charged. The reader taps **Confirm & send** and completes any final bank, card, or Coinbase verification. The exact Coinbase labels can change; these are product requirements, not claims that we control its hosted copy.
+
+6. **Processing.** Coinbase buys or draws 5 USDC and sends it to Ana's Base address. A progress screen says not to retry. Our backend watches that address/transaction and deduplicates by Onramp session and transaction hash; an Onramp redirect alone is not proof of payment.
+
+7. **Receipt.** After chain confirmation, the reader returns to “Ana received 5 USDC,” with an optional Base explorer link and email receipt from Coinbase. The page offers “Back to the issue,” not a prompt to install a wallet. If payment succeeds but the redirect fails, the newsletter can recover status from Coinbase/webhook and show it when the signed session URL is reopened.
+
+### Everything the reader must have or do
+
+- Install: **nothing**; a browser is enough.
+- Sign up: **nothing new** if the Coinbase account remains usable. They do sign into Coinbase and may face 2FA or refreshed identity verification.
+- Fund: have an eligible Coinbase balance or linked payment source covering the tip **plus the disclosed fee**. If not, add/link one inside Coinbase. They do not acquire ETH or pay gas separately.
+- Hold afterward: nothing. The reader never needs a wallet or stranded crypto balance.
+
+### What the cook must do first
+
+The newsletter cannot make this invisible on both sides. Ana creates or designates a wallet that supports Base USDC (a Coinbase Wallet/embedded wallet is acceptable), secures its recovery method, submits the Base address, and proves control with a signature. The newsletter verifies her real-world identity and employment, shows her a test transfer, and explains public balances, irreversible transfers, taxes, and cash-out fees. To receive dollars in a bank, she also needs a supported off-ramp; Coinbase says ACH off-ramp requires a Coinbase account with linked bank details ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Until she cashes out, she has USDC, not bank dollars.
+
+## Onchain scope and liveness
+
+There are **zero custom contracts**. One transfer settles one tip; bursts after an issue create independent transfers and require no batch job or privileged settlement.
+
+| Transition | Caller | Why they act/pay | If nobody acts |
+| --- | --- | --- | --- |
+| Buy/send USDC to cook | Reader through Coinbase Onramp | Wants to tip; Coinbase quotes the complete charge | No charge and no tip |
+| Confirm/index receipt | Newsletter backend, reading Coinbase status and Base | Gives reader and cook a receipt; no onchain gas | Funds still reach the cook; UI remains pending until reconciled |
+| Convert USDC to bank money | Cook through chosen off-ramp | Wants spendable fiat and accepts quoted fees | USDC remains under the cook's control |
+
+Before launch, run production-sized $5 tests from each offered Coinbase funding source, confirm the net amount at the cook address, test duplicate clicks and failed redirects, and load-test session creation/webhooks for the post-issue burst. If fees make “Ana receives 5 USDC” false, show the exact net amount or subsidize the difference; never silently deduct it from the cook.
+
+## What would make this the wrong setup
+
+Change the architecture when the product changes in any of these ways:
+
+- **$1–$4 must work as true one-off tips.** If production quotes enforce a $5 minimum or fees are material, direct fiat-to-chain onramping per tip is wrong. Use ordinary card/Apple Pay collection into a disclosed custodial ledger and batch payouts to cooks, or subsidize minimums/fees. That is no longer a direct per-reader onchain transfer and brings money-transmission, custody, chargeback, accounting, and payout compliance work.
+- **Most readers are not eligible Coinbase users.** If the audience is outside supported regions, lacks reusable funding methods, or refuses Coinbase, add a second regulated payment/onramp provider or make fiat tipping primary. Do not compensate by forcing wallet installation.
+- **The reader should tip repeatedly.** If repeat behavior matters more than a one-time issue spike, an embedded smart wallet funded once and gas-sponsored USDC transfers may beat repeated Coinbase checkout. That adds wallet creation/recovery, balance management, and a clear withdrawal path—the very friction this MVP avoids.
+- **One payment must split among a kitchen team, fund a pool, vest, match, refund, or release conditionally.** A direct transfer cannot enforce those rules. Introduce one narrowly scoped, audited splitter/escrow contract only after specifying who can trigger every release and why; do not use a contract merely for analytics.
+- **Cooks require dollars immediately or cannot manage wallets/taxes/off-ramping.** Pay them through fiat payroll/payout rails. Calling USDC “dollars delivered” would be deceptive when the recipient bears conversion work and fees.
+- **Private tips or hidden recipient balances are required.** Base transfers are public. Use fiat rails or a purpose-built privacy system after legal/security review; changing only the UI does not provide privacy.
+- **Tips must be reversible or support chargebacks and disputes.** Direct onchain settlement is irreversible. Use an intermediary/escrow and accept that the tip is no longer immediately under the cook's sole control.
+- **The newsletter needs to take a fee or guarantee an exact net payout across providers.** Direct-to-cook Onramp may not express that policy cleanly. A payment processor or a minimal splitter becomes necessary, along with explicit fee disclosure and additional compliance review.
+- **Cooks want composable onchain history, but readers also need persistent identities, balances, or rewards.** Then a reader wallet and perhaps signed attestations become product features rather than accidental infrastructure. Keep profiles, rankings, and restaurant content offchain; add a contract only for commitments that truly need trustless enforcement.
+
+The go/no-go test is therefore simple: ship this setup only if a representative reader can send a tested $5 tip from an existing Coinbase account, the cook receives the promised USDC amount on Base, and both parties understand that the cook—not the newsletter—controls and cashes out the funds. If $1 tipping is non-negotiable, this direct-Onramp design should not be approved without evidence that the $1 route works economically and operationally.

exec
/bin/bash -lc "sed -n '1,260p' plan.md && git diff --check -- plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-004/2026-08-28T145230Z-codex-with-skill-1/workspace
 succeeded in 7ms:
# First-tip product plan

## Recommendation

Launch a web tip page that sends **USDC on Base straight to the cook's wallet using Coinbase-hosted Onramp**. Do not make the reader install a wallet, create a newsletter account, buy ETH, bridge funds, or keep a crypto balance. Do not deploy a custom contract for the MVP.

This is the smallest honest onchain boundary: the only onchain action is the USDC transfer to the cook. The newsletter stores the cook's profile, issue association, verified payout address, and transaction status offchain. Coinbase handles the reader's regulated purchase flow. Base is the single launch network because Coinbase Onramp can deliver USDC to a specified Base address, existing Coinbase users can use their saved balance or payment methods, and sponsored USDC transfers are supported in Coinbase's Base wallet stack ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Base gasless-transfer example](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)).

There is an important launch constraint: make the first-tip buttons **$5 only**, pending production tests of authenticated Coinbase accounts. Coinbase documents a roughly $5 minimum for guest debit-card and Apple/Google Pay purchases; it does not promise that every $1–$4 route works ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Advertising $1 tips before proving the actual quote and minimum would produce a misleading or broken flow.

## A first-time reader's first tip

Assume the cook has already completed the recipient setup below and the reader already has a verified Coinbase account with either a USD/USDC balance or a linked payment method.

1. **Newsletter.** Under the cook's story, the reader sees “Tip Ana $5.” Supporting text says “Ana receives USDC (about $5) in her wallet,” names Base, and links to a plain-language disclosure that the transfer is public and irreversible. The button is a normal HTTPS link; no app is required.

2. **Tip page.** A mobile web page shows Ana's verified name/photo, `$5 tip`, `Ana receives 5 USDC`, the network (`Base`), and any Coinbase fee before commitment. It does not expose or ask the reader to copy an address. The page offers **Continue with Coinbase** and explains that the reader will briefly go to Coinbase to pay. The newsletter backend creates a single-use Onramp session fixed to USDC, Base, $5, and Ana's allowlisted address. Coinbase's API supports preset purchase amounts and a destination network/address ([session API](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-session)).

3. **Coinbase sign-in.** Coinbase's hosted page opens. The reader chooses sign in, enters the email/password or passkey for the Coinbase account, and completes whatever two-factor or device confirmation Coinbase requests. They are not creating a newsletter account or a self-custody wallet. If already signed in on that device, this may collapse to a confirmation.

4. **Funding source.** Coinbase shows eligible sources: an existing fiat or crypto balance and/or a linked bank or debit card. The reader selects one. If none is usable, they must link or fund one and may have to complete Coinbase identity checks or wait for a bank transfer; the tip has not happened yet. Existing users can use Coinbase balances and linked bank/debit methods ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)).

5. **Coinbase review.** The screen shows the $5 purchase/send, USDC, Base destination, exchange/network fees, payment source, and total charged. The reader taps **Confirm & send** and completes any final bank, card, or Coinbase verification. The exact Coinbase labels can change; these are product requirements, not claims that we control its hosted copy.

6. **Processing.** Coinbase buys or draws 5 USDC and sends it to Ana's Base address. A progress screen says not to retry. Our backend watches that address/transaction and deduplicates by Onramp session and transaction hash; an Onramp redirect alone is not proof of payment.

7. **Receipt.** After chain confirmation, the reader returns to “Ana received 5 USDC,” with an optional Base explorer link and email receipt from Coinbase. The page offers “Back to the issue,” not a prompt to install a wallet. If payment succeeds but the redirect fails, the newsletter can recover status from Coinbase/webhook and show it when the signed session URL is reopened.

### Everything the reader must have or do

- Install: **nothing**; a browser is enough.
- Sign up: **nothing new** if the Coinbase account remains usable. They do sign into Coinbase and may face 2FA or refreshed identity verification.
- Fund: have an eligible Coinbase balance or linked payment source covering the tip **plus the disclosed fee**. If not, add/link one inside Coinbase. They do not acquire ETH or pay gas separately.
- Hold afterward: nothing. The reader never needs a wallet or stranded crypto balance.

### What the cook must do first

The newsletter cannot make this invisible on both sides. Ana creates or designates a wallet that supports Base USDC (a Coinbase Wallet/embedded wallet is acceptable), secures its recovery method, submits the Base address, and proves control with a signature. The newsletter verifies her real-world identity and employment, shows her a test transfer, and explains public balances, irreversible transfers, taxes, and cash-out fees. To receive dollars in a bank, she also needs a supported off-ramp; Coinbase says ACH off-ramp requires a Coinbase account with linked bank details ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Until she cashes out, she has USDC, not bank dollars.

## Onchain scope and liveness

There are **zero custom contracts**. One transfer settles one tip; bursts after an issue create independent transfers and require no batch job or privileged settlement.

| Transition | Caller | Why they act/pay | If nobody acts |
| --- | --- | --- | --- |
| Buy/send USDC to cook | Reader through Coinbase Onramp | Wants to tip; Coinbase quotes the complete charge | No charge and no tip |
| Confirm/index receipt | Newsletter backend, reading Coinbase status and Base | Gives reader and cook a receipt; no onchain gas | Funds still reach the cook; UI remains pending until reconciled |
| Convert USDC to bank money | Cook through chosen off-ramp | Wants spendable fiat and accepts quoted fees | USDC remains under the cook's control |

Before launch, run production-sized $5 tests from each offered Coinbase funding source, confirm the net amount at the cook address, test duplicate clicks and failed redirects, and load-test session creation/webhooks for the post-issue burst. If fees make “Ana receives 5 USDC” false, show the exact net amount or subsidize the difference; never silently deduct it from the cook.

## What would make this the wrong setup

Change the architecture when the product changes in any of these ways:

- **$1–$4 must work as true one-off tips.** If production quotes enforce a $5 minimum or fees are material, direct fiat-to-chain onramping per tip is wrong. Use ordinary card/Apple Pay collection into a disclosed custodial ledger and batch payouts to cooks, or subsidize minimums/fees. That is no longer a direct per-reader onchain transfer and brings money-transmission, custody, chargeback, accounting, and payout compliance work.
- **Most readers are not eligible Coinbase users.** If the audience is outside supported regions, lacks reusable funding methods, or refuses Coinbase, add a second regulated payment/onramp provider or make fiat tipping primary. Do not compensate by forcing wallet installation.
- **The reader should tip repeatedly.** If repeat behavior matters more than a one-time issue spike, an embedded smart wallet funded once and gas-sponsored USDC transfers may beat repeated Coinbase checkout. That adds wallet creation/recovery, balance management, and a clear withdrawal path—the very friction this MVP avoids.
- **One payment must split among a kitchen team, fund a pool, vest, match, refund, or release conditionally.** A direct transfer cannot enforce those rules. Introduce one narrowly scoped, audited splitter/escrow contract only after specifying who can trigger every release and why; do not use a contract merely for analytics.
- **Cooks require dollars immediately or cannot manage wallets/taxes/off-ramping.** Pay them through fiat payroll/payout rails. Calling USDC “dollars delivered” would be deceptive when the recipient bears conversion work and fees.
- **Private tips or hidden recipient balances are required.** Base transfers are public. Use fiat rails or a purpose-built privacy system after legal/security review; changing only the UI does not provide privacy.
- **Tips must be reversible or support chargebacks and disputes.** Direct onchain settlement is irreversible. Use an intermediary/escrow and accept that the tip is no longer immediately under the cook's sole control.
- **The newsletter needs to take a fee or guarantee an exact net payout across providers.** Direct-to-cook Onramp may not express that policy cleanly. A payment processor or a minimal splitter becomes necessary, along with explicit fee disclosure and additional compliance review.
- **Cooks want composable onchain history, but readers also need persistent identities, balances, or rewards.** Then a reader wallet and perhaps signed attestations become product features rather than accidental infrastructure. Keep profiles, rankings, and restaurant content offchain; add a contract only for commitments that truly need trustless enforcement.

The go/no-go test is therefore simple: ship this setup only if a representative reader can send a tested $5 tip from an existing Coinbase account, the cook receives the promised USDC amount on Base, and both parties understand that the cook—not the newsletter—controls and cashes out the funds. If $1 tipping is non-negotiable, this direct-Onramp design should not be approved without evidence that the $1 route works economically and operationally.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0da628a7161dbe703f44dde9fcf493a4a0156d45
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,66 @@
+# First-tip product plan
+
+## Recommendation
+
+Launch a web tip page that sends **USDC on Base straight to the cook's wallet using Coinbase-hosted Onramp**. Do not make the reader install a wallet, create a newsletter account, buy ETH, bridge funds, or keep a crypto balance. Do not deploy a custom contract for the MVP.
+
+This is the smallest honest onchain boundary: the only onchain action is the USDC transfer to the cook. The newsletter stores the cook's profile, issue association, verified payout address, and transaction status offchain. Coinbase handles the reader's regulated purchase flow. Base is the single launch network because Coinbase Onramp can deliver USDC to a specified Base address, existing Coinbase users can use their saved balance or payment methods, and sponsored USDC transfers are supported in Coinbase's Base wallet stack ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Base gasless-transfer example](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)).
+
+There is an important launch constraint: make the first-tip buttons **$5 only**, pending production tests of authenticated Coinbase accounts. Coinbase documents a roughly $5 minimum for guest debit-card and Apple/Google Pay purchases; it does not promise that every $1–$4 route works ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Advertising $1 tips before proving the actual quote and minimum would produce a misleading or broken flow.
+
+## A first-time reader's first tip
+
+Assume the cook has already completed the recipient setup below and the reader already has a verified Coinbase account with either a USD/USDC balance or a linked payment method.
+
+1. **Newsletter.** Under the cook's story, the reader sees “Tip Ana $5.” Supporting text says “Ana receives USDC (about $5) in her wallet,” names Base, and links to a plain-language disclosure that the transfer is public and irreversible. The button is a normal HTTPS link; no app is required.
+
+2. **Tip page.** A mobile web page shows Ana's verified name/photo, `$5 tip`, `Ana receives 5 USDC`, the network (`Base`), and any Coinbase fee before commitment. It does not expose or ask the reader to copy an address. The page offers **Continue with Coinbase** and explains that the reader will briefly go to Coinbase to pay. The newsletter backend creates a single-use Onramp session fixed to USDC, Base, $5, and Ana's allowlisted address. Coinbase's API supports preset purchase amounts and a destination network/address ([session API](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-session)).
+
+3. **Coinbase sign-in.** Coinbase's hosted page opens. The reader chooses sign in, enters the email/password or passkey for the Coinbase account, and completes whatever two-factor or device confirmation Coinbase requests. They are not creating a newsletter account or a self-custody wallet. If already signed in on that device, this may collapse to a confirmation.
+
+4. **Funding source.** Coinbase shows eligible sources: an existing fiat or crypto balance and/or a linked bank or debit card. The reader selects one. If none is usable, they must link or fund one and may have to complete Coinbase identity checks or wait for a bank transfer; the tip has not happened yet. Existing users can use Coinbase balances and linked bank/debit methods ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)).
+
+5. **Coinbase review.** The screen shows the $5 purchase/send, USDC, Base destination, exchange/network fees, payment source, and total charged. The reader taps **Confirm & send** and completes any final bank, card, or Coinbase verification. The exact Coinbase labels can change; these are product requirements, not claims that we control its hosted copy.
+
+6. **Processing.** Coinbase buys or draws 5 USDC and sends it to Ana's Base address. A progress screen says not to retry. Our backend watches that address/transaction and deduplicates by Onramp session and transaction hash; an Onramp redirect alone is not proof of payment.
+
+7. **Receipt.** After chain confirmation, the reader returns to “Ana received 5 USDC,” with an optional Base explorer link and email receipt from Coinbase. The page offers “Back to the issue,” not a prompt to install a wallet. If payment succeeds but the redirect fails, the newsletter can recover status from Coinbase/webhook and show it when the signed session URL is reopened.
+
+### Everything the reader must have or do
+
+- Install: **nothing**; a browser is enough.
+- Sign up: **nothing new** if the Coinbase account remains usable. They do sign into Coinbase and may face 2FA or refreshed identity verification.
+- Fund: have an eligible Coinbase balance or linked payment source covering the tip **plus the disclosed fee**. If not, add/link one inside Coinbase. They do not acquire ETH or pay gas separately.
+- Hold afterward: nothing. The reader never needs a wallet or stranded crypto balance.
+
+### What the cook must do first
+
+The newsletter cannot make this invisible on both sides. Ana creates or designates a wallet that supports Base USDC (a Coinbase Wallet/embedded wallet is acceptable), secures its recovery method, submits the Base address, and proves control with a signature. The newsletter verifies her real-world identity and employment, shows her a test transfer, and explains public balances, irreversible transfers, taxes, and cash-out fees. To receive dollars in a bank, she also needs a supported off-ramp; Coinbase says ACH off-ramp requires a Coinbase account with linked bank details ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Until she cashes out, she has USDC, not bank dollars.
+
+## Onchain scope and liveness
+
+There are **zero custom contracts**. One transfer settles one tip; bursts after an issue create independent transfers and require no batch job or privileged settlement.
+
+| Transition | Caller | Why they act/pay | If nobody acts |
+| --- | --- | --- | --- |
+| Buy/send USDC to cook | Reader through Coinbase Onramp | Wants to tip; Coinbase quotes the complete charge | No charge and no tip |
+| Confirm/index receipt | Newsletter backend, reading Coinbase status and Base | Gives reader and cook a receipt; no onchain gas | Funds still reach the cook; UI remains pending until reconciled |
+| Convert USDC to bank money | Cook through chosen off-ramp | Wants spendable fiat and accepts quoted fees | USDC remains under the cook's control |
+
+Before launch, run production-sized $5 tests from each offered Coinbase funding source, confirm the net amount at the cook address, test duplicate clicks and failed redirects, and load-test session creation/webhooks for the post-issue burst. If fees make “Ana receives 5 USDC” false, show the exact net amount or subsidize the difference; never silently deduct it from the cook.
+
+## What would make this the wrong setup
+
+Change the architecture when the product changes in any of these ways:
+
+- **$1–$4 must work as true one-off tips.** If production quotes enforce a $5 minimum or fees are material, direct fiat-to-chain onramping per tip is wrong. Use ordinary card/Apple Pay collection into a disclosed custodial ledger and batch payouts to cooks, or subsidize minimums/fees. That is no longer a direct per-reader onchain transfer and brings money-transmission, custody, chargeback, accounting, and payout compliance work.
+- **Most readers are not eligible Coinbase users.** If the audience is outside supported regions, lacks reusable funding methods, or refuses Coinbase, add a second regulated payment/onramp provider or make fiat tipping primary. Do not compensate by forcing wallet installation.
+- **The reader should tip repeatedly.** If repeat behavior matters more than a one-time issue spike, an embedded smart wallet funded once and gas-sponsored USDC transfers may beat repeated Coinbase checkout. That adds wallet creation/recovery, balance management, and a clear withdrawal path—the very friction this MVP avoids.
+- **One payment must split among a kitchen team, fund a pool, vest, match, refund, or release conditionally.** A direct transfer cannot enforce those rules. Introduce one narrowly scoped, audited splitter/escrow contract only after specifying who can trigger every release and why; do not use a contract merely for analytics.
+- **Cooks require dollars immediately or cannot manage wallets/taxes/off-ramping.** Pay them through fiat payroll/payout rails. Calling USDC “dollars delivered” would be deceptive when the recipient bears conversion work and fees.
+- **Private tips or hidden recipient balances are required.** Base transfers are public. Use fiat rails or a purpose-built privacy system after legal/security review; changing only the UI does not provide privacy.
+- **Tips must be reversible or support chargebacks and disputes.** Direct onchain settlement is irreversible. Use an intermediary/escrow and accept that the tip is no longer immediately under the cook's sole control.
+- **The newsletter needs to take a fee or guarantee an exact net payout across providers.** Direct-to-cook Onramp may not express that policy cleanly. A payment processor or a minimal splitter becomes necessary, along with explicit fee disclosure and additional compliance review.
+- **Cooks want composable onchain history, but readers also need persistent identities, balances, or rewards.** Then a reader wallet and perhaps signed attestations become product features rather than accidental infrastructure. Keep profiles, rankings, and restaurant content offchain; add a contract only for commitments that truly need trustless enforcement.
+
+The go/no-go test is therefore simple: ship this setup only if a representative reader can send a tested $5 tip from an existing Coinbase account, the cook receives the promised USDC amount on Base, and both parties understand that the cook—not the newsletter—controls and cashes out the funds. If $1 tipping is non-negotiable, this direct-Onramp design should not be approved without evidence that the $1 route works economically and operationally.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-004/2026-08-28T145230Z-codex-with-skill-1/workspace/plan.md).

It recommends direct USDC tips on Base through Coinbase-hosted Onramp, with no reader wallet or custom contract, and flags the potential $5 minimum as the key product constraint.
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0da628a7161dbe703f44dde9fcf493a4a0156d45
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,66 @@
+# First-tip product plan
+
+## Recommendation
+
+Launch a web tip page that sends **USDC on Base straight to the cook's wallet using Coinbase-hosted Onramp**. Do not make the reader install a wallet, create a newsletter account, buy ETH, bridge funds, or keep a crypto balance. Do not deploy a custom contract for the MVP.
+
+This is the smallest honest onchain boundary: the only onchain action is the USDC transfer to the cook. The newsletter stores the cook's profile, issue association, verified payout address, and transaction status offchain. Coinbase handles the reader's regulated purchase flow. Base is the single launch network because Coinbase Onramp can deliver USDC to a specified Base address, existing Coinbase users can use their saved balance or payment methods, and sponsored USDC transfers are supported in Coinbase's Base wallet stack ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Base gasless-transfer example](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)).
+
+There is an important launch constraint: make the first-tip buttons **$5 only**, pending production tests of authenticated Coinbase accounts. Coinbase documents a roughly $5 minimum for guest debit-card and Apple/Google Pay purchases; it does not promise that every $1–$4 route works ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Advertising $1 tips before proving the actual quote and minimum would produce a misleading or broken flow.
+
+## A first-time reader's first tip
+
+Assume the cook has already completed the recipient setup below and the reader already has a verified Coinbase account with either a USD/USDC balance or a linked payment method.
+
+1. **Newsletter.** Under the cook's story, the reader sees “Tip Ana $5.” Supporting text says “Ana receives USDC (about $5) in her wallet,” names Base, and links to a plain-language disclosure that the transfer is public and irreversible. The button is a normal HTTPS link; no app is required.
+
+2. **Tip page.** A mobile web page shows Ana's verified name/photo, `$5 tip`, `Ana receives 5 USDC`, the network (`Base`), and any Coinbase fee before commitment. It does not expose or ask the reader to copy an address. The page offers **Continue with Coinbase** and explains that the reader will briefly go to Coinbase to pay. The newsletter backend creates a single-use Onramp session fixed to USDC, Base, $5, and Ana's allowlisted address. Coinbase's API supports preset purchase amounts and a destination network/address ([session API](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-session)).
+
+3. **Coinbase sign-in.** Coinbase's hosted page opens. The reader chooses sign in, enters the email/password or passkey for the Coinbase account, and completes whatever two-factor or device confirmation Coinbase requests. They are not creating a newsletter account or a self-custody wallet. If already signed in on that device, this may collapse to a confirmation.
+
+4. **Funding source.** Coinbase shows eligible sources: an existing fiat or crypto balance and/or a linked bank or debit card. The reader selects one. If none is usable, they must link or fund one and may have to complete Coinbase identity checks or wait for a bank transfer; the tip has not happened yet. Existing users can use Coinbase balances and linked bank/debit methods ([hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)).
+
+5. **Coinbase review.** The screen shows the $5 purchase/send, USDC, Base destination, exchange/network fees, payment source, and total charged. The reader taps **Confirm & send** and completes any final bank, card, or Coinbase verification. The exact Coinbase labels can change; these are product requirements, not claims that we control its hosted copy.
+
+6. **Processing.** Coinbase buys or draws 5 USDC and sends it to Ana's Base address. A progress screen says not to retry. Our backend watches that address/transaction and deduplicates by Onramp session and transaction hash; an Onramp redirect alone is not proof of payment.
+
+7. **Receipt.** After chain confirmation, the reader returns to “Ana received 5 USDC,” with an optional Base explorer link and email receipt from Coinbase. The page offers “Back to the issue,” not a prompt to install a wallet. If payment succeeds but the redirect fails, the newsletter can recover status from Coinbase/webhook and show it when the signed session URL is reopened.
+
+### Everything the reader must have or do
+
+- Install: **nothing**; a browser is enough.
+- Sign up: **nothing new** if the Coinbase account remains usable. They do sign into Coinbase and may face 2FA or refreshed identity verification.
+- Fund: have an eligible Coinbase balance or linked payment source covering the tip **plus the disclosed fee**. If not, add/link one inside Coinbase. They do not acquire ETH or pay gas separately.
+- Hold afterward: nothing. The reader never needs a wallet or stranded crypto balance.
+
+### What the cook must do first
+
+The newsletter cannot make this invisible on both sides. Ana creates or designates a wallet that supports Base USDC (a Coinbase Wallet/embedded wallet is acceptable), secures its recovery method, submits the Base address, and proves control with a signature. The newsletter verifies her real-world identity and employment, shows her a test transfer, and explains public balances, irreversible transfers, taxes, and cash-out fees. To receive dollars in a bank, she also needs a supported off-ramp; Coinbase says ACH off-ramp requires a Coinbase account with linked bank details ([Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq)). Until she cashes out, she has USDC, not bank dollars.
+
+## Onchain scope and liveness
+
+There are **zero custom contracts**. One transfer settles one tip; bursts after an issue create independent transfers and require no batch job or privileged settlement.
+
+| Transition | Caller | Why they act/pay | If nobody acts |
+| --- | --- | --- | --- |
+| Buy/send USDC to cook | Reader through Coinbase Onramp | Wants to tip; Coinbase quotes the complete charge | No charge and no tip |
+| Confirm/index receipt | Newsletter backend, reading Coinbase status and Base | Gives reader and cook a receipt; no onchain gas | Funds still reach the cook; UI remains pending until reconciled |
+| Convert USDC to bank money | Cook through chosen off-ramp | Wants spendable fiat and accepts quoted fees | USDC remains under the cook's control |
+
+Before launch, run production-sized $5 tests from each offered Coinbase funding source, confirm the net amount at the cook address, test duplicate clicks and failed redirects, and load-test session creation/webhooks for the post-issue burst. If fees make “Ana receives 5 USDC” false, show the exact net amount or subsidize the difference; never silently deduct it from the cook.
+
+## What would make this the wrong setup
+
+Change the architecture when the product changes in any of these ways:
+
+- **$1–$4 must work as true one-off tips.** If production quotes enforce a $5 minimum or fees are material, direct fiat-to-chain onramping per tip is wrong. Use ordinary card/Apple Pay collection into a disclosed custodial ledger and batch payouts to cooks, or subsidize minimums/fees. That is no longer a direct per-reader onchain transfer and brings money-transmission, custody, chargeback, accounting, and payout compliance work.
+- **Most readers are not eligible Coinbase users.** If the audience is outside supported regions, lacks reusable funding methods, or refuses Coinbase, add a second regulated payment/onramp provider or make fiat tipping primary. Do not compensate by forcing wallet installation.
+- **The reader should tip repeatedly.** If repeat behavior matters more than a one-time issue spike, an embedded smart wallet funded once and gas-sponsored USDC transfers may beat repeated Coinbase checkout. That adds wallet creation/recovery, balance management, and a clear withdrawal path—the very friction this MVP avoids.
+- **One payment must split among a kitchen team, fund a pool, vest, match, refund, or release conditionally.** A direct transfer cannot enforce those rules. Introduce one narrowly scoped, audited splitter/escrow contract only after specifying who can trigger every release and why; do not use a contract merely for analytics.
+- **Cooks require dollars immediately or cannot manage wallets/taxes/off-ramping.** Pay them through fiat payroll/payout rails. Calling USDC “dollars delivered” would be deceptive when the recipient bears conversion work and fees.
+- **Private tips or hidden recipient balances are required.** Base transfers are public. Use fiat rails or a purpose-built privacy system after legal/security review; changing only the UI does not provide privacy.
+- **Tips must be reversible or support chargebacks and disputes.** Direct onchain settlement is irreversible. Use an intermediary/escrow and accept that the tip is no longer immediately under the cook's sole control.
+- **The newsletter needs to take a fee or guarantee an exact net payout across providers.** Direct-to-cook Onramp may not express that policy cleanly. A payment processor or a minimal splitter becomes necessary, along with explicit fee disclosure and additional compliance review.
+- **Cooks want composable onchain history, but readers also need persistent identities, balances, or rewards.** Then a reader wallet and perhaps signed attestations become product features rather than accidental infrastructure. Keep profiles, rankings, and restaurant content offchain; add a contract only for commitments that truly need trustless enforcement.
+
+The go/no-go test is therefore simple: ship this setup only if a representative reader can send a tested $5 tip from an existing Coinbase account, the cook receives the promised USDC amount on Base, and both parties understand that the cook—not the newsletter—controls and cashes out the funds. If $1 tipping is non-negotiable, this direct-Onramp design should not be approved without evidence that the $1 route works economically and operationally.

tokens used
38,412
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-004/2026-08-28T145230Z-codex-with-skill-1/workspace/plan.md).

It recommends direct USDC tips on Base through Coinbase-hosted Onramp, with no reader wallet or custom contract, and flags the potential $5 minimum as the key product constraint.
