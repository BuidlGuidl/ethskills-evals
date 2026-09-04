Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4ae-28c5-7450-880d-c39b32e6d69b
--------
user
We publish a newsletter about our city's restaurants — around 200,000
subscribers, almost none of whom have ever used a crypto wallet, though a
large share of them already have a Coinbase account they signed up for years
ago. We want readers to be able to tip a line cook directly: a reader taps a
tip under a dish we wrote about, the cook gets the money. Tips run $1-$5 and
we expect a few thousand a week, most of them in the two days after an issue
goes out.

Two things before we commit to a build. Write the walkthrough of a first-time
reader's first tip — every screen, and everything they have to install, sign
up for, or fund before the money reaches the cook. Then tell me what would
have to change about this product for that setup to be the wrong one.

Write your answer to plan.md in this directory.
codex
I’ll map the lowest-friction setup against current official Coinbase documentation, then write the reader journey and the conditions that would invalidate it.
web search: 
web search: site:docs.cdp.coinbase.com embedded wallets smart wallet passkey onramp Coinbase account one tap payment USDC Base ...
web search: 
web search: site:docs.cdp.coinbase.com "Base Pay" checkout consumer Coinbase account USDC ...
web search: 
web search: site:docs.base.org/base-account "Coinbase account" sign in first time Base Pay popup ...
codex
The key constraint is now clear: Base Pay fits $1–$5 direct tips and existing funded Coinbase users, but it is not a card-style “charge $3 from any old Coinbase account” flow. I’m making that funding boundary—and the cook’s cash-out burden—explicit.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..e8a24301f8eebc2e973aec95d2332fa70a9bbe1f
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,105 @@
+# Recommendation
+
+Use **Base Pay**, sending USDC on Base straight to a separate Base Account controlled by each cook. Do not build a custom wallet, pooled tip contract, or Coinbase Onramp into the first-tip path.
+
+This is the best crypto-native fit because Base Pay accepts amounts down to $0.01, sponsors gas, settles in seconds, and can draw from a funded Base Account or Coinbase account. The reader does not need ETH, a seed phrase, a browser extension, a network selector, or our own account. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments), [`pay()` reference](https://docs.base.org/base-account/reference/base-pay/pay))
+
+Important qualification: “has a Coinbase account” is not the same as “can tip immediately.” The account must be accessible and have enough spendable USDC (or the live payment sheet must explicitly offer an eligible Coinbase funding source). We should prototype the production payment sheet with representative dormant accounts before committing.
+
+# Before any reader can tip
+
+Each cook completes recipient onboarding once:
+
+1. Open our cook invite.
+2. **Claim your tips** — name, restaurant, phone/email; accept terms and tax/privacy disclosures.
+3. **Create or connect Base Account** — choose Continue with Base.
+4. **Sign in / create account** — authenticate and create a passkey if needed. No seed phrase or extension. A Base Account is a self-custodial smart wallet with passkey sign-on. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account))
+5. **Confirm tip address** — we show the shortened address and require a test receipt/confirmation. We bind cook ID → address server-side and lock edits behind re-authentication.
+6. **How you get paid** — explicitly say: “Tips arrive as USDC, a digital dollar, in your Base Account—not directly in your bank.” Offer cash-out guidance; do not describe the money as cash wages or promise instant bank settlement.
+7. **Ready** — the cook’s address becomes eligible for published tip buttons.
+
+The newsletter never receives or controls the tip. Our backend creates a unique, idempotent intent containing cook ID, dish/article ID, amount, and expected recipient address; the browser calls `pay({ amount, to: cookAddress })`; our backend verifies the returned transaction before showing success. The onchain transfer itself is the source of truth.
+
+# First-time reader’s first tip
+
+Assume a mobile browser opened from email, an existing Coinbase account, and enough spendable USDC. Exact Coinbase copy can change; these are the product screens and decisions we must test, not invented pixel-perfect labels.
+
+1. **Article**
+   - Under the dish: “Tip Ana, the line cook” with **$1 / $3 / $5**.
+   - Reader taps **$3**.
+   - Nothing installed, no newsletter sign-up, and no wallet connection yet.
+
+2. **Tip review (ours)**
+   - “$3.00 USDC goes directly to Ana.”
+   - Show cook, restaurant, dish, “on Base,” reader fee **$0**, cook receives **$3.00**, tips are final, and an optional anonymous/public-name choice.
+   - Primary action: **Pay $3 with Base**.
+   - This disclosure matters: USDC is designed to track USD, but it is still crypto in the cook’s wallet.
+
+3. **Base payment sheet (Base-controlled popup/sheet)**
+   - Reader selects or is prompted to use **Coinbase / Base Account**.
+   - No Coinbase Wallet/Base app, extension, or newsletter app installation should be required; Base documents the web flow as working with no app install and without prior site sign-in. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account), [web quickstart](https://docs.base.org/base-account/quickstart/web))
+
+4. **Coinbase authentication**
+   - Enter the email/phone associated with Coinbase if no active session.
+   - Complete the actual Coinbase challenge shown: password/passkey, email code, authenticator, or device approval.
+   - A years-old user may encounter account recovery, updated terms, identity re-verification, or a locked/closed account. That is a blocking detour, not “one tap,” and must be measured in the pilot.
+   - Reader authorizes linking/using the Coinbase-backed Base Account if prompted.
+
+5. **Payment review**
+   - Confirm **$3.00 USDC**, Ana’s shortened recipient/address, Base network, and total/fee.
+   - Reader taps **Confirm/Pay** and completes device biometric/passkey approval if requested.
+   - Base Pay handles gas sponsorship; the reader should not acquire ETH or choose a network. Base says the payer pays the exact amount and the recipient receives the full amount. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments))
+
+6. **Processing (ours)**
+   - “Sending tip…” while we poll/verify the transaction ID using `getPaymentStatus`.
+   - Do not call it paid merely because the popup returned; handle pending, rejected, duplicate, wrong-recipient, and failed states.
+
+7. **Success (ours)**
+   - “Ana received $3.00 USDC.”
+   - Receipt details and transaction link; optional email receipt only with consent.
+   - The money has now reached Ana’s Base Account. It has **not** necessarily reached her bank.
+
+## If the reader is not funded
+
+Insert this branch before payment confirmation:
+
+1. **Insufficient USDC** — offer **Add funds** or cancel.
+2. **Funding provider** — sign in to Coinbase and choose an existing USD/crypto balance or linked payment method, if offered.
+3. **Buy/review USDC** — show funding amount, method, spread/fees, timing, and total.
+4. **Bank/card authentication** — complete issuer or bank approval.
+5. **Funding pending/success** — only return to the $3 tip when funds are spendable.
+6. Resume at **Payment review** and approve the separate tip.
+
+This is materially worse than the funded path. Coinbase-hosted Onramp supports Coinbase balances and linked methods, but guest/card checkout has an approximately **$5 minimum** and fees can apply; therefore it is a poor primitive for a fresh $1 or $3 purchase per tip. ([Onramp overview](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq))
+
+Reader prerequisites, stated plainly:
+
+- **Always:** a modern browser, access to an authentication device/email/phone, and enough USDC available to Base Pay.
+- **Sometimes:** recover Coinbase access, re-verify identity, accept terms, add/verify a bank or card, and buy/fund USDC.
+- **Never for the intended path:** install our app, install a wallet extension, save a seed phrase, buy ETH, or manually bridge/select Base.
+
+# What would make this the wrong setup
+
+Change away from direct Base Pay if any of these product facts changes:
+
+1. **The real requirement is “tap a normal card/Apple Pay and be done.”** Most readers lack spendable USDC, dormant-account recovery is common, or funded first-tip completion misses the target. Use conventional card/Apple Pay checkout and pay cooks through a compliant marketplace payout provider. At $1–$5, batch reader support into a balance or raise the minimum so fixed/payment fees do not dominate.
+
+2. **“Gets the money” means bank dollars, automatically.** Direct Base Pay gives the cook USDC in a self-custodial account. If cooks will not manage a wallet/off-ramp, collect centrally and run bank payouts, or use a marketplace/payment partner that supports seller onboarding, tax reporting, holds, refunds, and fiat settlement.
+
+3. **We need refunds, disputes, moderation, delayed release, split tips, or reassignment.** Direct irreversible transfers cannot reliably claw back a mistaken or fraudulent tip. Move to platform/partner custody with a ledger and batched payouts. Coinbase’s Payment Acceptance product has authorization/capture/refund and bank or USDC settlement, but is partner-onboarded and aimed at payment platforms/marketplaces; evaluate it rather than assuming self-serve access. ([Payment Acceptance](https://docs.cdp.coinbase.com/payments/payment-acceptance/overview))
+
+4. **Legal analysis says the newsletter is a marketplace, money transmitter, employer, or reporting/withholding party.** Stop direct-address launch design and obtain local payments/employment/tax counsel. Architecture follows the required KYC, sanctions screening, 1099/reporting, escheatment, age, and tip-distribution rules—not the reverse.
+
+5. **Cooks cannot safely own persistent wallets.** High loss/recovery rates, shared phones, job turnover, coercion, or restaurant ownership disputes make direct addresses unsafe. Use verified recipient accounts with recoverable credentials and controlled payout-destination changes.
+
+6. **Recipient privacy is required.** A stable public address exposes an address’s transaction graph and tip totals. Use per-campaign/deposit addresses with managed payouts or a privacy-preserving compliant processor.
+
+7. **Our volume/traffic shape breaks dependencies.** Issue-day concurrency, Base/Coinbase outages, risk throttles, or payment-sheet incompatibility cause unacceptable failures. Add graceful retries and status recovery first; switch rails if measured reliability still misses the service objective.
+
+8. **Tips become recurring, aggregated, cross-border, multi-currency, or much larger.** Re-evaluate spend permissions, custody, FX, sanctions, limits, tax, and payout batching. Do not extend this one-off direct-tip design by inertia.
+
+# Commit gate
+
+Run a clickable production-surface pilot before a build commitment: 30–50 existing Coinbase users stratified by active/dormant and funded/unfunded, plus 10 cooks. Record screen-by-screen drop-off, recovery/re-verification incidence, funding method/minimum/fees, time to confirmed tip, cook claim rate, and time/cost to bank cash-out.
+
+Proceed with direct Base Pay only if the funded path needs no install and reliably completes in under a minute, a sufficiently large share is already funded (or will pre-fund), $1/$3/$5 all work, cooks knowingly accept USDC, and legal review approves direct transfers. Otherwise the product should become ordinary fiat tipping with batched cook payouts; “many readers once opened Coinbase” is not enough evidence.

diff --git a/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..e8a24301f8eebc2e973aec95d2332fa70a9bbe1f
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,105 @@
+# Recommendation
+
+Use **Base Pay**, sending USDC on Base straight to a separate Base Account controlled by each cook. Do not build a custom wallet, pooled tip contract, or Coinbase Onramp into the first-tip path.
+
+This is the best crypto-native fit because Base Pay accepts amounts down to $0.01, sponsors gas, settles in seconds, and can draw from a funded Base Account or Coinbase account. The reader does not need ETH, a seed phrase, a browser extension, a network selector, or our own account. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments), [`pay()` reference](https://docs.base.org/base-account/reference/base-pay/pay))
+
+Important qualification: “has a Coinbase account” is not the same as “can tip immediately.” The account must be accessible and have enough spendable USDC (or the live payment sheet must explicitly offer an eligible Coinbase funding source). We should prototype the production payment sheet with representative dormant accounts before committing.
+
+# Before any reader can tip
+
+Each cook completes recipient onboarding once:
+
+1. Open our cook invite.
+2. **Claim your tips** — name, restaurant, phone/email; accept terms and tax/privacy disclosures.
+3. **Create or connect Base Account** — choose Continue with Base.
+4. **Sign in / create account** — authenticate and create a passkey if needed. No seed phrase or extension. A Base Account is a self-custodial smart wallet with passkey sign-on. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account))
+5. **Confirm tip address** — we show the shortened address and require a test receipt/confirmation. We bind cook ID → address server-side and lock edits behind re-authentication.
+6. **How you get paid** — explicitly say: “Tips arrive as USDC, a digital dollar, in your Base Account—not directly in your bank.” Offer cash-out guidance; do not describe the money as cash wages or promise instant bank settlement.
+7. **Ready** — the cook’s address becomes eligible for published tip buttons.
+
+The newsletter never receives or controls the tip. Our backend creates a unique, idempotent intent containing cook ID, dish/article ID, amount, and expected recipient address; the browser calls `pay({ amount, to: cookAddress })`; our backend verifies the returned transaction before showing success. The onchain transfer itself is the source of truth.
+
+# First-time reader’s first tip
+
+Assume a mobile browser opened from email, an existing Coinbase account, and enough spendable USDC. Exact Coinbase copy can change; these are the product screens and decisions we must test, not invented pixel-perfect labels.
+
+1. **Article**
+   - Under the dish: “Tip Ana, the line cook” with **$1 / $3 / $5**.
+   - Reader taps **$3**.
+   - Nothing installed, no newsletter sign-up, and no wallet connection yet.
+
+2. **Tip review (ours)**
+   - “$3.00 USDC goes directly to Ana.”
+   - Show cook, restaurant, dish, “on Base,” reader fee **$0**, cook receives **$3.00**, tips are final, and an optional anonymous/public-name choice.
+   - Primary action: **Pay $3 with Base**.
+   - This disclosure matters: USDC is designed to track USD, but it is still crypto in the cook’s wallet.
+
+3. **Base payment sheet (Base-controlled popup/sheet)**
+   - Reader selects or is prompted to use **Coinbase / Base Account**.
+   - No Coinbase Wallet/Base app, extension, or newsletter app installation should be required; Base documents the web flow as working with no app install and without prior site sign-in. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account), [web quickstart](https://docs.base.org/base-account/quickstart/web))
+
+4. **Coinbase authentication**
+   - Enter the email/phone associated with Coinbase if no active session.
+   - Complete the actual Coinbase challenge shown: password/passkey, email code, authenticator, or device approval.
+   - A years-old user may encounter account recovery, updated terms, identity re-verification, or a locked/closed account. That is a blocking detour, not “one tap,” and must be measured in the pilot.
+   - Reader authorizes linking/using the Coinbase-backed Base Account if prompted.
+
+5. **Payment review**
+   - Confirm **$3.00 USDC**, Ana’s shortened recipient/address, Base network, and total/fee.
+   - Reader taps **Confirm/Pay** and completes device biometric/passkey approval if requested.
+   - Base Pay handles gas sponsorship; the reader should not acquire ETH or choose a network. Base says the payer pays the exact amount and the recipient receives the full amount. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments))
+
+6. **Processing (ours)**
+   - “Sending tip…” while we poll/verify the transaction ID using `getPaymentStatus`.
+   - Do not call it paid merely because the popup returned; handle pending, rejected, duplicate, wrong-recipient, and failed states.
+
+7. **Success (ours)**
+   - “Ana received $3.00 USDC.”
+   - Receipt details and transaction link; optional email receipt only with consent.
+   - The money has now reached Ana’s Base Account. It has **not** necessarily reached her bank.
+
+## If the reader is not funded
+
+Insert this branch before payment confirmation:
+
+1. **Insufficient USDC** — offer **Add funds** or cancel.
+2. **Funding provider** — sign in to Coinbase and choose an existing USD/crypto balance or linked payment method, if offered.
+3. **Buy/review USDC** — show funding amount, method, spread/fees, timing, and total.
+4. **Bank/card authentication** — complete issuer or bank approval.
+5. **Funding pending/success** — only return to the $3 tip when funds are spendable.
+6. Resume at **Payment review** and approve the separate tip.
+
+This is materially worse than the funded path. Coinbase-hosted Onramp supports Coinbase balances and linked methods, but guest/card checkout has an approximately **$5 minimum** and fees can apply; therefore it is a poor primitive for a fresh $1 or $3 purchase per tip. ([Onramp overview](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq))
+
+Reader prerequisites, stated plainly:
+
+- **Always:** a modern browser, access to an authentication device/email/phone, and enough USDC available to Base Pay.
+- **Sometimes:** recover Coinbase access, re-verify identity, accept terms, add/verify a bank or card, and buy/fund USDC.
+- **Never for the intended path:** install our app, install a wallet extension, save a seed phrase, buy ETH, or manually bridge/select Base.
+
+# What would make this the wrong setup
+
+Change away from direct Base Pay if any of these product facts changes:
+
+1. **The real requirement is “tap a normal card/Apple Pay and be done.”** Most readers lack spendable USDC, dormant-account recovery is common, or funded first-tip completion misses the target. Use conventional card/Apple Pay checkout and pay cooks through a compliant marketplace payout provider. At $1–$5, batch reader support into a balance or raise the minimum so fixed/payment fees do not dominate.
+
+2. **“Gets the money” means bank dollars, automatically.** Direct Base Pay gives the cook USDC in a self-custodial account. If cooks will not manage a wallet/off-ramp, collect centrally and run bank payouts, or use a marketplace/payment partner that supports seller onboarding, tax reporting, holds, refunds, and fiat settlement.
+
+3. **We need refunds, disputes, moderation, delayed release, split tips, or reassignment.** Direct irreversible transfers cannot reliably claw back a mistaken or fraudulent tip. Move to platform/partner custody with a ledger and batched payouts. Coinbase’s Payment Acceptance product has authorization/capture/refund and bank or USDC settlement, but is partner-onboarded and aimed at payment platforms/marketplaces; evaluate it rather than assuming self-serve access. ([Payment Acceptance](https://docs.cdp.coinbase.com/payments/payment-acceptance/overview))
+
+4. **Legal analysis says the newsletter is a marketplace, money transmitter, employer, or reporting/withholding party.** Stop direct-address launch design and obtain local payments/employment/tax counsel. Architecture follows the required KYC, sanctions screening, 1099/reporting, escheatment, age, and tip-distribution rules—not the reverse.
+
+5. **Cooks cannot safely own persistent wallets.** High loss/recovery rates, shared phones, job turnover, coercion, or restaurant ownership disputes make direct addresses unsafe. Use verified recipient accounts with recoverable credentials and controlled payout-destination changes.
+
+6. **Recipient privacy is required.** A stable public address exposes an address’s transaction graph and tip totals. Use per-campaign/deposit addresses with managed payouts or a privacy-preserving compliant processor.
+
+7. **Our volume/traffic shape breaks dependencies.** Issue-day concurrency, Base/Coinbase outages, risk throttles, or payment-sheet incompatibility cause unacceptable failures. Add graceful retries and status recovery first; switch rails if measured reliability still misses the service objective.
+
+8. **Tips become recurring, aggregated, cross-border, multi-currency, or much larger.** Re-evaluate spend permissions, custody, FX, sanctions, limits, tax, and payout batching. Do not extend this one-off direct-tip design by inertia.
+
+# Commit gate
+
+Run a clickable production-surface pilot before a build commitment: 30–50 existing Coinbase users stratified by active/dormant and funded/unfunded, plus 10 cooks. Record screen-by-screen drop-off, recovery/re-verification incidence, funding method/minimum/fees, time to confirmed tip, cook claim rate, and time/cost to bank cash-out.
+
+Proceed with direct Base Pay only if the funded path needs no install and reliably completes in under a minute, a sufficiently large share is already funded (or will pre-fund), $1/$3/$5 all work, cooks knowingly accept USDC, and legal review approves direct transfers. Otherwise the product should become ordinary fiat tipping with batched cook payouts; “many readers once opened Coinbase” is not enough evidence.

exec
/bin/bash -lc "sed -n '1,260p' plan.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace
 succeeded in 0ms:
# Recommendation

Use **Base Pay**, sending USDC on Base straight to a separate Base Account controlled by each cook. Do not build a custom wallet, pooled tip contract, or Coinbase Onramp into the first-tip path.

This is the best crypto-native fit because Base Pay accepts amounts down to $0.01, sponsors gas, settles in seconds, and can draw from a funded Base Account or Coinbase account. The reader does not need ETH, a seed phrase, a browser extension, a network selector, or our own account. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments), [`pay()` reference](https://docs.base.org/base-account/reference/base-pay/pay))

Important qualification: “has a Coinbase account” is not the same as “can tip immediately.” The account must be accessible and have enough spendable USDC (or the live payment sheet must explicitly offer an eligible Coinbase funding source). We should prototype the production payment sheet with representative dormant accounts before committing.

# Before any reader can tip

Each cook completes recipient onboarding once:

1. Open our cook invite.
2. **Claim your tips** — name, restaurant, phone/email; accept terms and tax/privacy disclosures.
3. **Create or connect Base Account** — choose Continue with Base.
4. **Sign in / create account** — authenticate and create a passkey if needed. No seed phrase or extension. A Base Account is a self-custodial smart wallet with passkey sign-on. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account))
5. **Confirm tip address** — we show the shortened address and require a test receipt/confirmation. We bind cook ID → address server-side and lock edits behind re-authentication.
6. **How you get paid** — explicitly say: “Tips arrive as USDC, a digital dollar, in your Base Account—not directly in your bank.” Offer cash-out guidance; do not describe the money as cash wages or promise instant bank settlement.
7. **Ready** — the cook’s address becomes eligible for published tip buttons.

The newsletter never receives or controls the tip. Our backend creates a unique, idempotent intent containing cook ID, dish/article ID, amount, and expected recipient address; the browser calls `pay({ amount, to: cookAddress })`; our backend verifies the returned transaction before showing success. The onchain transfer itself is the source of truth.

# First-time reader’s first tip

Assume a mobile browser opened from email, an existing Coinbase account, and enough spendable USDC. Exact Coinbase copy can change; these are the product screens and decisions we must test, not invented pixel-perfect labels.

1. **Article**
   - Under the dish: “Tip Ana, the line cook” with **$1 / $3 / $5**.
   - Reader taps **$3**.
   - Nothing installed, no newsletter sign-up, and no wallet connection yet.

2. **Tip review (ours)**
   - “$3.00 USDC goes directly to Ana.”
   - Show cook, restaurant, dish, “on Base,” reader fee **$0**, cook receives **$3.00**, tips are final, and an optional anonymous/public-name choice.
   - Primary action: **Pay $3 with Base**.
   - This disclosure matters: USDC is designed to track USD, but it is still crypto in the cook’s wallet.

3. **Base payment sheet (Base-controlled popup/sheet)**
   - Reader selects or is prompted to use **Coinbase / Base Account**.
   - No Coinbase Wallet/Base app, extension, or newsletter app installation should be required; Base documents the web flow as working with no app install and without prior site sign-in. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account), [web quickstart](https://docs.base.org/base-account/quickstart/web))

4. **Coinbase authentication**
   - Enter the email/phone associated with Coinbase if no active session.
   - Complete the actual Coinbase challenge shown: password/passkey, email code, authenticator, or device approval.
   - A years-old user may encounter account recovery, updated terms, identity re-verification, or a locked/closed account. That is a blocking detour, not “one tap,” and must be measured in the pilot.
   - Reader authorizes linking/using the Coinbase-backed Base Account if prompted.

5. **Payment review**
   - Confirm **$3.00 USDC**, Ana’s shortened recipient/address, Base network, and total/fee.
   - Reader taps **Confirm/Pay** and completes device biometric/passkey approval if requested.
   - Base Pay handles gas sponsorship; the reader should not acquire ETH or choose a network. Base says the payer pays the exact amount and the recipient receives the full amount. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments))

6. **Processing (ours)**
   - “Sending tip…” while we poll/verify the transaction ID using `getPaymentStatus`.
   - Do not call it paid merely because the popup returned; handle pending, rejected, duplicate, wrong-recipient, and failed states.

7. **Success (ours)**
   - “Ana received $3.00 USDC.”
   - Receipt details and transaction link; optional email receipt only with consent.
   - The money has now reached Ana’s Base Account. It has **not** necessarily reached her bank.

## If the reader is not funded

Insert this branch before payment confirmation:

1. **Insufficient USDC** — offer **Add funds** or cancel.
2. **Funding provider** — sign in to Coinbase and choose an existing USD/crypto balance or linked payment method, if offered.
3. **Buy/review USDC** — show funding amount, method, spread/fees, timing, and total.
4. **Bank/card authentication** — complete issuer or bank approval.
5. **Funding pending/success** — only return to the $3 tip when funds are spendable.
6. Resume at **Payment review** and approve the separate tip.

This is materially worse than the funded path. Coinbase-hosted Onramp supports Coinbase balances and linked methods, but guest/card checkout has an approximately **$5 minimum** and fees can apply; therefore it is a poor primitive for a fresh $1 or $3 purchase per tip. ([Onramp overview](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq))

Reader prerequisites, stated plainly:

- **Always:** a modern browser, access to an authentication device/email/phone, and enough USDC available to Base Pay.
- **Sometimes:** recover Coinbase access, re-verify identity, accept terms, add/verify a bank or card, and buy/fund USDC.
- **Never for the intended path:** install our app, install a wallet extension, save a seed phrase, buy ETH, or manually bridge/select Base.

# What would make this the wrong setup

Change away from direct Base Pay if any of these product facts changes:

1. **The real requirement is “tap a normal card/Apple Pay and be done.”** Most readers lack spendable USDC, dormant-account recovery is common, or funded first-tip completion misses the target. Use conventional card/Apple Pay checkout and pay cooks through a compliant marketplace payout provider. At $1–$5, batch reader support into a balance or raise the minimum so fixed/payment fees do not dominate.

2. **“Gets the money” means bank dollars, automatically.** Direct Base Pay gives the cook USDC in a self-custodial account. If cooks will not manage a wallet/off-ramp, collect centrally and run bank payouts, or use a marketplace/payment partner that supports seller onboarding, tax reporting, holds, refunds, and fiat settlement.

3. **We need refunds, disputes, moderation, delayed release, split tips, or reassignment.** Direct irreversible transfers cannot reliably claw back a mistaken or fraudulent tip. Move to platform/partner custody with a ledger and batched payouts. Coinbase’s Payment Acceptance product has authorization/capture/refund and bank or USDC settlement, but is partner-onboarded and aimed at payment platforms/marketplaces; evaluate it rather than assuming self-serve access. ([Payment Acceptance](https://docs.cdp.coinbase.com/payments/payment-acceptance/overview))

4. **Legal analysis says the newsletter is a marketplace, money transmitter, employer, or reporting/withholding party.** Stop direct-address launch design and obtain local payments/employment/tax counsel. Architecture follows the required KYC, sanctions screening, 1099/reporting, escheatment, age, and tip-distribution rules—not the reverse.

5. **Cooks cannot safely own persistent wallets.** High loss/recovery rates, shared phones, job turnover, coercion, or restaurant ownership disputes make direct addresses unsafe. Use verified recipient accounts with recoverable credentials and controlled payout-destination changes.

6. **Recipient privacy is required.** A stable public address exposes an address’s transaction graph and tip totals. Use per-campaign/deposit addresses with managed payouts or a privacy-preserving compliant processor.

7. **Our volume/traffic shape breaks dependencies.** Issue-day concurrency, Base/Coinbase outages, risk throttles, or payment-sheet incompatibility cause unacceptable failures. Add graceful retries and status recovery first; switch rails if measured reliability still misses the service objective.

8. **Tips become recurring, aggregated, cross-border, multi-currency, or much larger.** Re-evaluate spend permissions, custody, FX, sanctions, limits, tax, and payout batching. Do not extend this one-off direct-tip design by inertia.

# Commit gate

Run a clickable production-surface pilot before a build commitment: 30–50 existing Coinbase users stratified by active/dormant and funded/unfunded, plus 10 cooks. Record screen-by-screen drop-off, recovery/re-verification incidence, funding method/minimum/fees, time to confirmed tip, cook claim rate, and time/cost to bank cash-out.

Proceed with direct Base Pay only if the funded path needs no install and reliably completes in under a minute, a sufficiently large share is already funded (or will pre-fund), $1/$3/$5 all work, cooks knowingly accept USDC, and legal review approves direct transfers. Otherwise the product should become ordinary fiat tipping with batched cook payouts; “many readers once opened Coinbase” is not enough evidence.

diff --git a/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..e8a24301f8eebc2e973aec95d2332fa70a9bbe1f
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,105 @@
+# Recommendation
+
+Use **Base Pay**, sending USDC on Base straight to a separate Base Account controlled by each cook. Do not build a custom wallet, pooled tip contract, or Coinbase Onramp into the first-tip path.
+
+This is the best crypto-native fit because Base Pay accepts amounts down to $0.01, sponsors gas, settles in seconds, and can draw from a funded Base Account or Coinbase account. The reader does not need ETH, a seed phrase, a browser extension, a network selector, or our own account. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments), [`pay()` reference](https://docs.base.org/base-account/reference/base-pay/pay))
+
+Important qualification: “has a Coinbase account” is not the same as “can tip immediately.” The account must be accessible and have enough spendable USDC (or the live payment sheet must explicitly offer an eligible Coinbase funding source). We should prototype the production payment sheet with representative dormant accounts before committing.
+
+# Before any reader can tip
+
+Each cook completes recipient onboarding once:
+
+1. Open our cook invite.
+2. **Claim your tips** — name, restaurant, phone/email; accept terms and tax/privacy disclosures.
+3. **Create or connect Base Account** — choose Continue with Base.
+4. **Sign in / create account** — authenticate and create a passkey if needed. No seed phrase or extension. A Base Account is a self-custodial smart wallet with passkey sign-on. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account))
+5. **Confirm tip address** — we show the shortened address and require a test receipt/confirmation. We bind cook ID → address server-side and lock edits behind re-authentication.
+6. **How you get paid** — explicitly say: “Tips arrive as USDC, a digital dollar, in your Base Account—not directly in your bank.” Offer cash-out guidance; do not describe the money as cash wages or promise instant bank settlement.
+7. **Ready** — the cook’s address becomes eligible for published tip buttons.
+
+The newsletter never receives or controls the tip. Our backend creates a unique, idempotent intent containing cook ID, dish/article ID, amount, and expected recipient address; the browser calls `pay({ amount, to: cookAddress })`; our backend verifies the returned transaction before showing success. The onchain transfer itself is the source of truth.
+
+# First-time reader’s first tip
+
+Assume a mobile browser opened from email, an existing Coinbase account, and enough spendable USDC. Exact Coinbase copy can change; these are the product screens and decisions we must test, not invented pixel-perfect labels.
+
+1. **Article**
+   - Under the dish: “Tip Ana, the line cook” with **$1 / $3 / $5**.
+   - Reader taps **$3**.
+   - Nothing installed, no newsletter sign-up, and no wallet connection yet.
+
+2. **Tip review (ours)**
+   - “$3.00 USDC goes directly to Ana.”
+   - Show cook, restaurant, dish, “on Base,” reader fee **$0**, cook receives **$3.00**, tips are final, and an optional anonymous/public-name choice.
+   - Primary action: **Pay $3 with Base**.
+   - This disclosure matters: USDC is designed to track USD, but it is still crypto in the cook’s wallet.
+
+3. **Base payment sheet (Base-controlled popup/sheet)**
+   - Reader selects or is prompted to use **Coinbase / Base Account**.
+   - No Coinbase Wallet/Base app, extension, or newsletter app installation should be required; Base documents the web flow as working with no app install and without prior site sign-in. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account), [web quickstart](https://docs.base.org/base-account/quickstart/web))
+
+4. **Coinbase authentication**
+   - Enter the email/phone associated with Coinbase if no active session.
+   - Complete the actual Coinbase challenge shown: password/passkey, email code, authenticator, or device approval.
+   - A years-old user may encounter account recovery, updated terms, identity re-verification, or a locked/closed account. That is a blocking detour, not “one tap,” and must be measured in the pilot.
+   - Reader authorizes linking/using the Coinbase-backed Base Account if prompted.
+
+5. **Payment review**
+   - Confirm **$3.00 USDC**, Ana’s shortened recipient/address, Base network, and total/fee.
+   - Reader taps **Confirm/Pay** and completes device biometric/passkey approval if requested.
+   - Base Pay handles gas sponsorship; the reader should not acquire ETH or choose a network. Base says the payer pays the exact amount and the recipient receives the full amount. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments))
+
+6. **Processing (ours)**
+   - “Sending tip…” while we poll/verify the transaction ID using `getPaymentStatus`.
+   - Do not call it paid merely because the popup returned; handle pending, rejected, duplicate, wrong-recipient, and failed states.
+
+7. **Success (ours)**
+   - “Ana received $3.00 USDC.”
+   - Receipt details and transaction link; optional email receipt only with consent.
+   - The money has now reached Ana’s Base Account. It has **not** necessarily reached her bank.
+
+## If the reader is not funded
+
+Insert this branch before payment confirmation:
+
+1. **Insufficient USDC** — offer **Add funds** or cancel.
+2. **Funding provider** — sign in to Coinbase and choose an existing USD/crypto balance or linked payment method, if offered.
+3. **Buy/review USDC** — show funding amount, method, spread/fees, timing, and total.
+4. **Bank/card authentication** — complete issuer or bank approval.
+5. **Funding pending/success** — only return to the $3 tip when funds are spendable.
+6. Resume at **Payment review** and approve the separate tip.
+
+This is materially worse than the funded path. Coinbase-hosted Onramp supports Coinbase balances and linked methods, but guest/card checkout has an approximately **$5 minimum** and fees can apply; therefore it is a poor primitive for a fresh $1 or $3 purchase per tip. ([Onramp overview](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq))
+
+Reader prerequisites, stated plainly:
+
+- **Always:** a modern browser, access to an authentication device/email/phone, and enough USDC available to Base Pay.
+- **Sometimes:** recover Coinbase access, re-verify identity, accept terms, add/verify a bank or card, and buy/fund USDC.
+- **Never for the intended path:** install our app, install a wallet extension, save a seed phrase, buy ETH, or manually bridge/select Base.
+
+# What would make this the wrong setup
+
+Change away from direct Base Pay if any of these product facts changes:
+
+1. **The real requirement is “tap a normal card/Apple Pay and be done.”** Most readers lack spendable USDC, dormant-account recovery is common, or funded first-tip completion misses the target. Use conventional card/Apple Pay checkout and pay cooks through a compliant marketplace payout provider. At $1–$5, batch reader support into a balance or raise the minimum so fixed/payment fees do not dominate.
+
+2. **“Gets the money” means bank dollars, automatically.** Direct Base Pay gives the cook USDC in a self-custodial account. If cooks will not manage a wallet/off-ramp, collect centrally and run bank payouts, or use a marketplace/payment partner that supports seller onboarding, tax reporting, holds, refunds, and fiat settlement.
+
+3. **We need refunds, disputes, moderation, delayed release, split tips, or reassignment.** Direct irreversible transfers cannot reliably claw back a mistaken or fraudulent tip. Move to platform/partner custody with a ledger and batched payouts. Coinbase’s Payment Acceptance product has authorization/capture/refund and bank or USDC settlement, but is partner-onboarded and aimed at payment platforms/marketplaces; evaluate it rather than assuming self-serve access. ([Payment Acceptance](https://docs.cdp.coinbase.com/payments/payment-acceptance/overview))
+
+4. **Legal analysis says the newsletter is a marketplace, money transmitter, employer, or reporting/withholding party.** Stop direct-address launch design and obtain local payments/employment/tax counsel. Architecture follows the required KYC, sanctions screening, 1099/reporting, escheatment, age, and tip-distribution rules—not the reverse.
+
+5. **Cooks cannot safely own persistent wallets.** High loss/recovery rates, shared phones, job turnover, coercion, or restaurant ownership disputes make direct addresses unsafe. Use verified recipient accounts with recoverable credentials and controlled payout-destination changes.
+
+6. **Recipient privacy is required.** A stable public address exposes an address’s transaction graph and tip totals. Use per-campaign/deposit addresses with managed payouts or a privacy-preserving compliant processor.
+
+7. **Our volume/traffic shape breaks dependencies.** Issue-day concurrency, Base/Coinbase outages, risk throttles, or payment-sheet incompatibility cause unacceptable failures. Add graceful retries and status recovery first; switch rails if measured reliability still misses the service objective.
+
+8. **Tips become recurring, aggregated, cross-border, multi-currency, or much larger.** Re-evaluate spend permissions, custody, FX, sanctions, limits, tax, and payout batching. Do not extend this one-off direct-tip design by inertia.
+
+# Commit gate
+
+Run a clickable production-surface pilot before a build commitment: 30–50 existing Coinbase users stratified by active/dormant and funded/unfunded, plus 10 cooks. Record screen-by-screen drop-off, recovery/re-verification incidence, funding method/minimum/fees, time to confirmed tip, cook claim rate, and time/cost to bank cash-out.
+
+Proceed with direct Base Pay only if the funded path needs no install and reliably completes in under a minute, a sufficiently large share is already funded (or will pre-fund), $1/$3/$5 all work, cooks knowingly accept USDC, and legal review approves direct transfers. Otherwise the product should become ordinary fiat tipping with batched cook payouts; “many readers once opened Coinbase” is not enough evidence.

codex
Created [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md). Covers complete reader/cook flows, funding branch, Base Pay recommendation, invalidation conditions, and pilot commit gate.
diff --git a/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..e8a24301f8eebc2e973aec95d2332fa70a9bbe1f
--- /dev/null
+++ b/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,105 @@
+# Recommendation
+
+Use **Base Pay**, sending USDC on Base straight to a separate Base Account controlled by each cook. Do not build a custom wallet, pooled tip contract, or Coinbase Onramp into the first-tip path.
+
+This is the best crypto-native fit because Base Pay accepts amounts down to $0.01, sponsors gas, settles in seconds, and can draw from a funded Base Account or Coinbase account. The reader does not need ETH, a seed phrase, a browser extension, a network selector, or our own account. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments), [`pay()` reference](https://docs.base.org/base-account/reference/base-pay/pay))
+
+Important qualification: “has a Coinbase account” is not the same as “can tip immediately.” The account must be accessible and have enough spendable USDC (or the live payment sheet must explicitly offer an eligible Coinbase funding source). We should prototype the production payment sheet with representative dormant accounts before committing.
+
+# Before any reader can tip
+
+Each cook completes recipient onboarding once:
+
+1. Open our cook invite.
+2. **Claim your tips** — name, restaurant, phone/email; accept terms and tax/privacy disclosures.
+3. **Create or connect Base Account** — choose Continue with Base.
+4. **Sign in / create account** — authenticate and create a passkey if needed. No seed phrase or extension. A Base Account is a self-custodial smart wallet with passkey sign-on. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account))
+5. **Confirm tip address** — we show the shortened address and require a test receipt/confirmation. We bind cook ID → address server-side and lock edits behind re-authentication.
+6. **How you get paid** — explicitly say: “Tips arrive as USDC, a digital dollar, in your Base Account—not directly in your bank.” Offer cash-out guidance; do not describe the money as cash wages or promise instant bank settlement.
+7. **Ready** — the cook’s address becomes eligible for published tip buttons.
+
+The newsletter never receives or controls the tip. Our backend creates a unique, idempotent intent containing cook ID, dish/article ID, amount, and expected recipient address; the browser calls `pay({ amount, to: cookAddress })`; our backend verifies the returned transaction before showing success. The onchain transfer itself is the source of truth.
+
+# First-time reader’s first tip
+
+Assume a mobile browser opened from email, an existing Coinbase account, and enough spendable USDC. Exact Coinbase copy can change; these are the product screens and decisions we must test, not invented pixel-perfect labels.
+
+1. **Article**
+   - Under the dish: “Tip Ana, the line cook” with **$1 / $3 / $5**.
+   - Reader taps **$3**.
+   - Nothing installed, no newsletter sign-up, and no wallet connection yet.
+
+2. **Tip review (ours)**
+   - “$3.00 USDC goes directly to Ana.”
+   - Show cook, restaurant, dish, “on Base,” reader fee **$0**, cook receives **$3.00**, tips are final, and an optional anonymous/public-name choice.
+   - Primary action: **Pay $3 with Base**.
+   - This disclosure matters: USDC is designed to track USD, but it is still crypto in the cook’s wallet.
+
+3. **Base payment sheet (Base-controlled popup/sheet)**
+   - Reader selects or is prompted to use **Coinbase / Base Account**.
+   - No Coinbase Wallet/Base app, extension, or newsletter app installation should be required; Base documents the web flow as working with no app install and without prior site sign-in. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account), [web quickstart](https://docs.base.org/base-account/quickstart/web))
+
+4. **Coinbase authentication**
+   - Enter the email/phone associated with Coinbase if no active session.
+   - Complete the actual Coinbase challenge shown: password/passkey, email code, authenticator, or device approval.
+   - A years-old user may encounter account recovery, updated terms, identity re-verification, or a locked/closed account. That is a blocking detour, not “one tap,” and must be measured in the pilot.
+   - Reader authorizes linking/using the Coinbase-backed Base Account if prompted.
+
+5. **Payment review**
+   - Confirm **$3.00 USDC**, Ana’s shortened recipient/address, Base network, and total/fee.
+   - Reader taps **Confirm/Pay** and completes device biometric/passkey approval if requested.
+   - Base Pay handles gas sponsorship; the reader should not acquire ETH or choose a network. Base says the payer pays the exact amount and the recipient receives the full amount. ([Base Pay](https://docs.base.org/base-account/guides/accept-payments))
+
+6. **Processing (ours)**
+   - “Sending tip…” while we poll/verify the transaction ID using `getPaymentStatus`.
+   - Do not call it paid merely because the popup returned; handle pending, rejected, duplicate, wrong-recipient, and failed states.
+
+7. **Success (ours)**
+   - “Ana received $3.00 USDC.”
+   - Receipt details and transaction link; optional email receipt only with consent.
+   - The money has now reached Ana’s Base Account. It has **not** necessarily reached her bank.
+
+## If the reader is not funded
+
+Insert this branch before payment confirmation:
+
+1. **Insufficient USDC** — offer **Add funds** or cancel.
+2. **Funding provider** — sign in to Coinbase and choose an existing USD/crypto balance or linked payment method, if offered.
+3. **Buy/review USDC** — show funding amount, method, spread/fees, timing, and total.
+4. **Bank/card authentication** — complete issuer or bank approval.
+5. **Funding pending/success** — only return to the $3 tip when funds are spendable.
+6. Resume at **Payment review** and approve the separate tip.
+
+This is materially worse than the funded path. Coinbase-hosted Onramp supports Coinbase balances and linked methods, but guest/card checkout has an approximately **$5 minimum** and fees can apply; therefore it is a poor primitive for a fresh $1 or $3 purchase per tip. ([Onramp overview](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview), [Onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq))
+
+Reader prerequisites, stated plainly:
+
+- **Always:** a modern browser, access to an authentication device/email/phone, and enough USDC available to Base Pay.
+- **Sometimes:** recover Coinbase access, re-verify identity, accept terms, add/verify a bank or card, and buy/fund USDC.
+- **Never for the intended path:** install our app, install a wallet extension, save a seed phrase, buy ETH, or manually bridge/select Base.
+
+# What would make this the wrong setup
+
+Change away from direct Base Pay if any of these product facts changes:
+
+1. **The real requirement is “tap a normal card/Apple Pay and be done.”** Most readers lack spendable USDC, dormant-account recovery is common, or funded first-tip completion misses the target. Use conventional card/Apple Pay checkout and pay cooks through a compliant marketplace payout provider. At $1–$5, batch reader support into a balance or raise the minimum so fixed/payment fees do not dominate.
+
+2. **“Gets the money” means bank dollars, automatically.** Direct Base Pay gives the cook USDC in a self-custodial account. If cooks will not manage a wallet/off-ramp, collect centrally and run bank payouts, or use a marketplace/payment partner that supports seller onboarding, tax reporting, holds, refunds, and fiat settlement.
+
+3. **We need refunds, disputes, moderation, delayed release, split tips, or reassignment.** Direct irreversible transfers cannot reliably claw back a mistaken or fraudulent tip. Move to platform/partner custody with a ledger and batched payouts. Coinbase’s Payment Acceptance product has authorization/capture/refund and bank or USDC settlement, but is partner-onboarded and aimed at payment platforms/marketplaces; evaluate it rather than assuming self-serve access. ([Payment Acceptance](https://docs.cdp.coinbase.com/payments/payment-acceptance/overview))
+
+4. **Legal analysis says the newsletter is a marketplace, money transmitter, employer, or reporting/withholding party.** Stop direct-address launch design and obtain local payments/employment/tax counsel. Architecture follows the required KYC, sanctions screening, 1099/reporting, escheatment, age, and tip-distribution rules—not the reverse.
+
+5. **Cooks cannot safely own persistent wallets.** High loss/recovery rates, shared phones, job turnover, coercion, or restaurant ownership disputes make direct addresses unsafe. Use verified recipient accounts with recoverable credentials and controlled payout-destination changes.
+
+6. **Recipient privacy is required.** A stable public address exposes an address’s transaction graph and tip totals. Use per-campaign/deposit addresses with managed payouts or a privacy-preserving compliant processor.
+
+7. **Our volume/traffic shape breaks dependencies.** Issue-day concurrency, Base/Coinbase outages, risk throttles, or payment-sheet incompatibility cause unacceptable failures. Add graceful retries and status recovery first; switch rails if measured reliability still misses the service objective.
+
+8. **Tips become recurring, aggregated, cross-border, multi-currency, or much larger.** Re-evaluate spend permissions, custody, FX, sanctions, limits, tax, and payout batching. Do not extend this one-off direct-tip design by inertia.
+
+# Commit gate
+
+Run a clickable production-surface pilot before a build commitment: 30–50 existing Coinbase users stratified by active/dormant and funded/unfunded, plus 10 cooks. Record screen-by-screen drop-off, recovery/re-verification incidence, funding method/minimum/fees, time to confirmed tip, cook claim rate, and time/cost to bank cash-out.
+
+Proceed with direct Base Pay only if the funded path needs no install and reliably completes in under a minute, a sufficiently large share is already funded (or will pre-fund), $1/$3/$5 all work, cooks knowingly accept USDC, and legal review approves direct transfers. Otherwise the product should become ordinary fiat tipping with batched cook payouts; “many readers once opened Coinbase” is not enough evidence.

tokens used
54,665
Created [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-004/2026-07-30T201900Z-codex-no-skill-3/workspace/plan.md). Covers complete reader/cook flows, funding branch, Base Pay recommendation, invalidation conditions, and pilot commit gate.
