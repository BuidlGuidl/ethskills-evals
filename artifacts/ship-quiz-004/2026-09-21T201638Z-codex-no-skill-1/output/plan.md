# First Tip Walkthrough

## Recommended Setup

Use a Base USDC tipping flow with Coinbase-friendly onboarding:

- The cook receives tips to a Base USDC address they control or to the Base USDC receive address in their Coinbase account.
- The reader pays through our tip page using a Coinbase smart wallet/Base Account plus Coinbase Onramp.
- We sponsor network fees so the reader is choosing a tip amount, not managing gas.
- The tip is sent onchain directly from the reader's wallet to the cook's receive address; we do not custody the tip.

This is the best fit for the current product because tips are tiny, readers are mostly crypto-new, many already trust Coinbase, and bursts after a newsletter issue make card-style per-tip fees painful. Base USDC keeps the asset stable, the network cheap, and the Coinbase account path familiar.

## First-Time Reader, First Tip

Assumptions for this walkthrough:

- The reader has a Coinbase account, but no wallet app or browser extension.
- The reader is in a Coinbase-supported region.
- The cook has already completed their receiving setup before the newsletter goes out.
- The app sponsors network fees on Base.
- The tip is denominated in dollars and paid as USDC on Base.

### Before the reader arrives

The cook has to do this once:

1. Create or use an existing Coinbase account.
2. Complete Coinbase identity checks if not already complete.
3. Add a bank account if they want to cash out tips to dollars.
4. Open Coinbase's receive flow, choose USDC, choose the Base network, and copy the receive address.
5. Give that address to us through the cook onboarding form.
6. Confirm a test payment before we publish the first live tip link.

The cook does not need to install a separate wallet if they are comfortable receiving into Coinbase. If they want self-custody instead, they can use a Coinbase smart wallet/Base Account or another Base-compatible wallet, but that adds recovery and support burden.

### Screen 1: Newsletter

The reader sees a block in the restaurant story:

> Tip Maya, line cook at Example Bistro
> $1, $3, or $5. Tips go directly to Maya in USDC.

They tap `Tip $3`.

What they install: nothing.

What they sign up for: nothing yet.

What they fund: nothing yet.

### Screen 2: Tip Landing Page

The reader lands on our page. It shows:

- Cook name, restaurant, and photo or verified staff badge.
- Selected amount, for example `$3`.
- A note that the tip is sent as USDC on Base.
- A clear statement that network fees are paid by us.
- Buttons for `$1`, `$3`, `$5`, and custom.
- Primary button: `Continue with Coinbase`.

This page should not lead with crypto language. It should lead with "tip the cook" and explain the payment rail only where needed.

What they install: nothing.

What they sign up for: nothing yet.

What they fund: nothing yet.

### Screen 3: Coinbase Wallet Connection

After tapping `Continue with Coinbase`, the reader sees a Coinbase wallet connection sheet.

If they already have a smart wallet/Base Account on this browser or phone, they choose it.

If they do not, Coinbase creates one with a passkey. The reader sees an operating-system passkey prompt, such as Face ID, Touch ID, Windows Hello, Android screen lock, or password manager passkey.

They approve creating the passkey wallet.

What they install: nothing. Coinbase smart wallet flows do not require a browser extension or separate app.

What they sign up for: a passkey-based wallet/Base Account if they do not already have one.

What they fund: nothing yet.

### Screen 4: Link Coinbase Account

Because the reader has a Coinbase.com account, the flow asks them to sign in to Coinbase.

They enter their Coinbase email/password or use their saved Coinbase login. Coinbase may ask for two-factor authentication.

Coinbase then shows a permission screen explaining that our app/wallet flow can request a purchase or transfer, but cannot move funds without the reader's approval.

The reader taps `Allow`.

What they install: nothing.

What they sign up for: no new Coinbase.com account if they already have one. If they do not, this is the first major drop-off: they must create a Coinbase account and complete any required identity checks before paying.

What they fund: still nothing unless they have no usable Coinbase balance or payment method.

### Screen 5: Choose Funding Source

The reader sees a Coinbase Onramp payment screen for a `$3` USDC payment on Base.

Funding options may include:

- Existing USDC or crypto balance in Coinbase.
- Existing fiat balance in Coinbase.
- Debit card or credit card, where supported.
- ACH bank account in the US, if already linked and available.

The best first-tip path is:

1. Reader selects an existing Coinbase cash balance, USDC balance, or already-linked card.
2. Coinbase previews any Coinbase fee, spread, or conversion detail.
3. The network fee line says it is sponsored by us or shows zero to the reader.

If the reader has no Coinbase balance and no linked payment method, they must add one. That is a bad first-tip moment for a $1-$5 payment, so the product should avoid making the user discover that late. The tip page should detect likely readiness where possible or say up front that Coinbase funding is required.

What they install: nothing.

What they sign up for: no new signup if their Coinbase account is ready.

What they fund: either they spend an existing Coinbase balance or they buy/transfer enough USDC through Coinbase Onramp.

### Screen 6: Coinbase Preview

Coinbase shows a review screen:

- Tip amount: `$3.00`.
- Asset: `USDC`.
- Network: `Base`.
- Recipient: Maya's verified receive address, abbreviated.
- Coinbase/conversion fees, if any.
- Network fee: paid by us or zero to reader.
- Total paid by reader.

The reader taps `Confirm`.

For a mainstream audience, this screen is the moment of trust. We should show the cook identity and restaurant context before handing off to Coinbase, and Coinbase should show the final amount before confirmation.

What they install: nothing.

What they sign up for: nothing new.

What they fund: Coinbase buys or transfers the USDC needed for the tip if the reader is not already holding it.

### Screen 7: Wallet Approval

The wallet asks the reader to approve the send.

They use the same passkey method they used earlier: Face ID, Touch ID, device PIN, password manager, or equivalent.

The transaction is submitted on Base.

What they install: nothing.

What they sign up for: nothing new.

What they fund: the `$3` USDC leaves the reader's Coinbase-funded wallet.

### Screen 8: Our Pending Receipt

The reader returns to our page.

We show:

- `Tip sent`
- `$3 to Maya`
- Status: `Confirming on Base`
- Transaction hash link
- A short note that the cook will see the tip after network confirmation and Coinbase crediting, if they receive into Coinbase.

The page should also invite, but not require, the reader to save an email receipt. If they are coming from our newsletter, we probably already have their email; do not create a new account just for receipts.

What they install: nothing.

What they sign up for: nothing.

What they fund: nothing else.

### Screen 9: Cook Receives the Tip

If the cook receives into Coinbase, Coinbase credits the cook's account after the Base transaction is confirmed and Coinbase recognizes the deposit.

The cook sees USDC in Coinbase. They can:

- Hold USDC.
- Convert or sell to dollars.
- Withdraw dollars to their bank account.

If the cook receives into a self-custody wallet, the USDC appears directly in that wallet after confirmation. They then need their own offramp path to cash out.

The reader's job is done once the transaction is confirmed. The cook's cash-out is a separate workflow.

## What The Reader Had To Install, Sign Up For, Or Fund

In the best case, where the reader already has Coinbase and a usable payment method:

- Install: nothing.
- Sign up: create a passkey wallet/Base Account if they do not already have one.
- Fund: spend existing Coinbase cash/USDC/crypto, or buy/transfer `$1-$5` of USDC through Coinbase Onramp.
- Extra verification: Coinbase login and possible two-factor authentication.

In the worse first-time case:

- Install: still ideally nothing.
- Sign up: Coinbase.com account, Coinbase identity verification, passkey wallet/Base Account.
- Fund: add a card or bank account, then buy USDC.
- Risk: this is too much work for a spontaneous $3 thank-you.

That worse case is why the launch segment should target readers likely to already have Coinbase accounts, and why the product should offer a non-crypto fallback if completion rate matters more than proving the onchain flow.

## Why This Setup Fits

It fits when the product is:

- Direct-to-person tipping, not restaurant checkout.
- Low-dollar and high-volume.
- Burst-driven after each issue.
- Mostly US-based or in Coinbase-supported regions.
- Built around recipients who can pass Coinbase onboarding or provide a Base-compatible address.
- Comfortable denominating tips in dollars but settling in USDC.
- Willing to sponsor Base network fees as a customer acquisition/support cost.
- Trying to avoid custody of reader funds.

The key product bet is that "I already have Coinbase" is common enough among readers to overcome the wallet novelty, and that a passkey wallet plus Coinbase Onramp is much less scary than asking people to install a wallet extension, write down a seed phrase, bridge funds, or manage ETH for gas.

## What Would Make This The Wrong Setup

This setup becomes wrong if any of these product facts change.

### Tips need to work for everyone, not mostly Coinbase-ready readers

If the goal becomes maximum conversion from a mainstream newsletter audience, crypto should not be the primary first-tip rail. Use Apple Pay, Google Pay, cards, Cash App, Venmo, PayPal, or a standard payment processor, then handle cook payouts separately.

For a $1-$5 impulse tip, every extra screen hurts. Coinbase login, passkeys, asset choice, and funding are acceptable only if the audience already has Coinbase and understands the trust boundary.

### Readers do not already have funded Coinbase accounts

If most readers must create Coinbase accounts, complete identity checks, or add payment methods, this setup is wrong for first tips. It may still work for repeat tippers, but it will fail as a spontaneous newsletter CTA.

The practical threshold: if fewer than roughly half of attempted tippers can complete with an existing Coinbase account and payment method, lead with cards/mobile wallets and make crypto optional.

### Cooks cannot or will not use Coinbase

If line cooks do not want Coinbase accounts, cannot pass KYC, lack bank accounts, are outside Coinbase-supported regions, or need cash immediately, direct Base USDC creates recipient burden.

In that case, the product should either:

- Pay out through payroll/tip distribution with the restaurant.
- Use a marketplace payout provider.
- Let cooks choose payout methods such as bank, debit card, Venmo, Cash App, or stablecoin.

### The product becomes custodial

If we aggregate tips, hold balances, batch payouts, reverse payments, split tips among staff, or decide when cooks get paid, we are no longer just providing a direct payment interface.

That may be the right product, but it changes the compliance, licensing, accounting, dispute, tax, and trust model. At that point, a regulated payments/payouts provider is likely a better core than a direct wallet-to-wallet flow.

### Tips become larger, recurring, or subscription-like

For one-time $1-$5 tips, low fees and low friction dominate.

If tips become $25-$100, recurring patronage, memberships, or paid content, users may tolerate more onboarding, but consumer protections, receipts, refunds, account management, and tax reporting matter more. The better setup might be a conventional checkout with stored payment methods and managed payouts.

### Refunds, disputes, or fraud controls become central

Onchain tips are final by default. That is clean for direct gratuities, but bad if the product needs chargebacks, reversals, buyer protection, fraud review, mistaken-tip recovery, or customer support intervention.

If refunds and disputes are core, use card rails or a custodial ledger where reversals are possible.

### Restaurant or labor rules require employer involvement

Direct tips to a line cook may conflict with restaurant policy, tip pooling, wage reporting, union rules, tax handling, or local labor law. If the restaurant must approve, pool, withhold, report, or redistribute tips, direct-to-cook crypto is the wrong default.

Then the recipient should probably be the restaurant or an employer-controlled payout program, not an individual wallet address.

### The product needs international coverage

Coinbase coverage, payment methods, asset support, and cash-out options vary by country. If the newsletter grows across countries or the cooks are international, Coinbase-first onboarding becomes patchy.

The right setup would become a payout-method abstraction: cards/mobile wallets in, multiple local payout options out, stablecoins only where they are actually easier.

### The brand cannot absorb crypto support

Even when nothing breaks, readers will ask:

- What is USDC?
- Why did Coinbase ask for a passkey?
- Did I just create a wallet?
- Can I undo the tip?
- Why is my bank/card not available?
- Where is my receipt?

If the team cannot support those questions, hide the crypto rail behind a familiar payment method or postpone the crypto build.

## Build Recommendation

Build a pilot, not a full platform:

1. Start with one restaurant and a small group of Coinbase-ready readers.
2. Use Base USDC, sponsored gas, and cook receive addresses verified before publication.
3. Instrument every step: newsletter click, landing page, Coinbase connect, Coinbase auth, funding selected, preview shown, confirmed, transaction confirmed, cook credited.
4. Set a hard go/no-go metric: first-tip completion rate among Coinbase-account readers.
5. Keep a card/mobile-wallet fallback ready if the Coinbase path loses too many readers at signup or funding.

The setup is right only if the first tip feels like a Coinbase confirmation, not like learning crypto.

## Current Coinbase Notes Checked

- Coinbase smart wallet/Base Account supports passkey-style wallet creation without a browser extension or app, and apps can sponsor network fees on supported flows: https://help.coinbase.com/en/wallet/getting-started/smart-wallet
- Coinbase Onramp lets supported third-party apps connect to Coinbase.com so users can buy or transfer supported crypto, with Coinbase sign-in and user approval: https://help.coinbase.com/en/coinbase/trading-and-funding/coinbase-pay/using-onramp
- Coinbase Onramp payment methods vary by country and can include Coinbase balances, fiat balances, cards, and ACH in the US: https://docs.cdp.coinbase.com/onramp/additional-resources/payment-methods
- Coinbase's merchant stack has been moving toward Coinbase Business, USDC, custody, bank offramps, and accounting features; that is useful context, but individual cook tipping should not assume every cook has or can get a business account: https://help.coinbase.com/en/transitioning-from-coinbase-commerce-to-coinbase-business
