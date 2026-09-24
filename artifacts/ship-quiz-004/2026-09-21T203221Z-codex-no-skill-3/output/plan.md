# Reader tip walkthrough and reversal test

As of September 21, 2026, I would build this as a Base Pay / Coinbase Wallet SDK flow: the newsletter opens a lightweight tip page, the reader pays USDC on Base, and the recipient is the cook's own Base Account / Coinbase Wallet address. Do not make the newsletter the merchant of record or hold balances unless compliance forces that.

Why this setup fits: the tips are tiny, readers mostly do not know wallets, many already have Coinbase accounts, and the payment should land directly with the cook. Coinbase's current Wallet SDK positions Base Account/Base Pay as universal sign-in plus one-tap USDC payments, with a `pay()` call that sends USDC to a recipient. Coinbase also says smart wallets/Base Accounts can be created without an app or extension, using passkeys, and Base Pay is explicitly for USDC checkout.

## First-time reader's first tip

This is the honest happy path for a reader who has a Coinbase account but has never used a crypto wallet and does not already have USDC in a Base Account.

### Before the issue goes out

The cook needs a receiving account first.

1. The cook opens the onboarding link we send them.
2. They create or connect a Base Account / Coinbase Wallet.
3. They set up a passkey if they do not already have one.
4. We show them: "Tips arrive as USDC on Base."
5. They optionally link Coinbase or another off-ramp if they want to turn USDC into dollars later.
6. We store only the cook's public receiving address, display name, restaurant, and any required consent/tax metadata.

Money has not moved yet. The important product fact is that the cook must have a wallet/address before tips can be "direct."

### Screen 1: newsletter

The reader sees a module under the story:

`Tip Maria, line cook at ___`

Buttons: `$1`, `$3`, `$5`, `Custom`.

Below it, short plain copy: `Paid in USDC on Base. The tip goes to Maria's wallet.`

The reader taps `$3`.

### Screen 2: hosted tip page

The page opens in the browser, not inside Coinbase.

It shows:

`Tip Maria $3`

Fields or controls:

- Amount: `$3`, editable within allowed bounds.
- Optional note.
- Primary button: `Tip with Base Pay`.
- Secondary context: `You may need to sign in to Coinbase or add USDC the first time.`

No wallet jargon yet. No seed phrase. No "choose network."

### Screen 3: Base Pay opens

The Base Pay / Base Account modal appears.

If the reader already has a Base Account, they authenticate with their passkey and skip to the funding check.

If they do not, the modal explains that a Base Account will be created. They continue with a passkey prompt from the device:

- iPhone: Face ID / Touch ID / device passcode passkey sheet.
- Android: Google Password Manager / biometric prompt.
- Desktop: browser/OS passkey prompt.

What they install: nothing, if their browser and device support passkeys. No Coinbase Wallet app or browser extension should be required for this setup.

What they sign up for: a Base Account / smart wallet, controlled by their passkey. If they already have Coinbase Wallet smart wallet history, they may be using that same account. This is separate from merely having the Coinbase exchange app.

### Screen 4: permission / payment review

The reader sees a payment review:

- Recipient: Maria / public wallet address.
- Amount: `3.00 USDC`.
- Network: Base.
- Fee: should be zero or abstracted from the reader in the Base Pay flow; the app should not ask them to acquire ETH for gas.
- Button: `Pay`.

If they have enough USDC in their Base Account, they confirm with passkey. Skip to Screen 8.

If they do not have enough USDC, Base Pay cannot complete the tip yet. This is the main first-use friction.

### Screen 5: insufficient USDC

The modal says they need USDC to pay.

Options we should present, in this order:

1. `Transfer from Coinbase`
2. `Buy USDC`
3. `Use another wallet`

For this audience, the expected path is `Transfer from Coinbase` or `Buy USDC`.

### Screen 6: Coinbase sign-in / onramp

The reader signs into Coinbase.com if not already signed in.

They may have to complete:

- Coinbase email/password or passkey login.
- 2-step verification.
- "Allow" authorization so the dapp/wallet can use Coinbase Onramp.
- Identity verification if their Coinbase account is not fully verified.
- Payment-method setup if they have no usable payment method.

What they install: still nothing by default.

What they sign up for: no new Coinbase account if they already have one; otherwise a Coinbase account with Coinbase's KYC flow, which is too much friction for a casual $1-$5 tip and should be treated as a fallback, not the core path.

What they fund: enough USDC on Base to cover the tip. Ideally we let them buy or transfer a small round amount such as `$5` or `$10`, not force a large preload.

### Screen 7: Coinbase purchase or transfer confirmation

Coinbase shows the funding details:

- Asset: USDC.
- Network: Base.
- Destination: reader's Base Account address.
- Payment method: Coinbase cash balance, linked bank, debit card, Apple Pay, PayPal, or crypto balance depending on account eligibility.
- Fees/spread/network fees, if any.
- Button: `Preview` / `Confirm`.

The reader confirms. The USDC arrives in the reader's Base Account. This can be quick, but we should design for a pending state because payment method, limits, fraud review, or account holds can delay the ability to send off-platform.

### Screen 8: final tip confirmation

The reader is returned to the tip payment.

They see:

- `Tip Maria 3.00 USDC`
- `Pay`

They approve with passkey.

The app calls Base Pay / Wallet SDK `pay()` with the amount and the cook's recipient address. The transaction is submitted on Base.

### Screen 9: processing

The tip page shows:

`Sending tip...`

We poll payment status server-side and client-side. The user should not need to understand block explorers.

### Screen 10: success

The page shows:

`Tip sent`

Details:

- `Maria received 3.00 USDC`
- Timestamp
- Optional transaction link
- `Tip again` / `Share`

At this point the money has reached the cook's wallet. If the cook wants dollars in a bank account, that is the cook's separate off-ramp step, not part of the reader's payment.

### Failure and edge screens we should design on day one

- Reader closes the Coinbase/onramp window before funding finishes.
- Coinbase account exists but has no available payment method.
- Coinbase account buy/send limits block a tiny purchase.
- Payment method creates a hold and USDC cannot be sent immediately.
- Reader creates a Base Account but loses access to the passkey.
- Reader funds USDC on the wrong network through an external wallet.
- Cook's receiving address is missing, changed, sanctioned, or wrong.
- Transaction succeeds onchain but our UI times out.
- Duplicate taps after newsletter bursts.

For 200,000 subscribers, the product needs idempotent payment IDs, rate limits, duplicate-payment protection, server-side verification of amount/recipient, and a support view that can answer "did my tip arrive?" without asking a reader or cook to decode a wallet transaction.

## What must be true for this to be the right setup

This setup is right if most of these remain true:

- The product promise is "tip this specific cook directly," not "donate to the restaurant" or "add to payroll."
- Tips stay small, mostly `$1-$5`.
- The reader base is US-heavy or otherwise Coinbase-supported.
- A meaningful share of readers already have Coinbase accounts.
- We can tolerate first-tip friction in exchange for very low marginal payment costs afterward.
- The cook can receive and manage USDC, or at least can be onboarded once.
- We can sponsor/abstract gas and keep readers away from ETH, seed phrases, network switching, and wallet extensions.
- Settlement in USDC is acceptable to the cook, even if cash-out is a separate step.

## What would make this setup wrong

Use a different setup if any of these become central to the product.

### If conversion matters more than direct settlement

If the actual goal becomes "maximize the number of readers who leave $1 after reading," crypto is probably the wrong default. Use Apple Pay, Google Pay, cards, Venmo/Cash App, or a normal tipping processor, then pay cooks out in batches. The first-time funding step for USDC will lose casual readers.

### If tips must arrive as dollars

If cooks need spendable USD immediately, or the restaurant wants no worker to touch crypto, direct USDC is wrong. Use fiat collection and payroll/tip-distribution rails, or a stablecoin processor that automatically cashes out to the cook's bank account.

### If the newsletter must handle compliance centrally

If legal review says these tips are wages, taxable reported tips, tip-pool money, employer-controlled gratuities, or subject to restaurant tip-credit rules, do not send directly to private wallets as the core flow. The product should become a compliant tip reporting and payout system with restaurant/payroll integration.

### If recipients change constantly or cannot onboard

If each issue features many cooks, temporary staff, undocumented recipient details, or people who will not complete wallet setup, direct wallet tipping becomes operationally brittle. In that case, collect centrally and disburse after recipient verification.

### If most readers do not have Coinbase or are outside supported regions

If the audience shifts away from Coinbase-supported users, Base Pay's advantage shrinks. A card-first checkout with optional crypto would be better.

### If tips become larger or recurring

For larger gifts, subscriptions, memberships, or repeated patronage, the flow needs receipts, saved payment methods, refunds, chargebacks/disputes, account management, tax forms, fraud controls, and possibly spend permissions. At that point this is no longer a tiny direct-tip flow; it is a payments product.

### If editorial trust requires reversibility

Onchain tips are final. If readers expect refunds because the wrong cook was listed, a restaurant disputes the identity, or a story correction changes context, direct onchain settlement is a poor fit. Use a reversible payment method or escrow-like delay.

### If the product becomes restaurant-facing instead of cook-facing

If restaurants become the customer and want reporting, pooled tips, manager dashboards, or local-currency settlement, Coinbase Commerce / Payment Acceptance or a conventional restaurant tip platform may fit better than per-cook direct Base Pay.

## Practical recommendation

Prototype Base Pay for the direct-tip promise, but measure the first-tip funnel separately from repeat tips. The build should make three numbers visible before a full launch:

- Newsletter click to tip page.
- Tip page to funded Base Account.
- Funded Base Account to completed tip.

If the funding step is the cliff, keep Base Pay as an optional "direct to cook" method and put a fiat express checkout first. If repeat tippers convert strongly after the first setup, keep Base Pay as the primary path for Coinbase-heavy segments.

## Sources checked

- Coinbase Wallet SDK overview: https://docs.cdp.coinbase.com/coinbase-wallet/overview
- Coinbase smart wallet help: https://help.coinbase.com/en/wallet/getting-started/smart-wallet
- Coinbase Onramp help: https://help.coinbase.com/en/coinbase/trading-and-funding/coinbase-pay/using-onramp
- Base Pay / Base Account announcement: https://blog.base.org/a-new-day-one
- Base Pay SDK playground: https://base.github.io/account-sdk/pay-playground
