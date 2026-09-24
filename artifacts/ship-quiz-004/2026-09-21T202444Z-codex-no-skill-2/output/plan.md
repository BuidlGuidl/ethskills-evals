# First-tip walkthrough and decision boundary

## Recommended setup

Build the tip flow as a Coinbase-native onchain payment:

- USDC on Base.
- Reader wallet: Coinbase/Base smart wallet created with a passkey inside the tip flow.
- Funding: Coinbase Onramp, preferring the reader's existing Coinbase account and saved payment methods.
- Gas: sponsored by us via a paymaster, so the reader does not need ETH.
- Recipient: the cook receives USDC directly to a Base address they control.

This is the right default because the audience is crypto-new but Coinbase-familiar, the payment amounts are tiny, and the product promise is "tip this person directly" rather than "pay the newsletter and we distribute later." The product should avoid seed phrases, browser extensions, ETH-for-gas, manual network selection, and copied wallet addresses.

The important caveat: if a first-time reader has no usable Coinbase balance, no linked payment method, and no onchain USDC, their first `$1-$5` tip may require a funding step that is larger than the tip. Coinbase's Onramp docs list a `$5` minimum for guest debit-card checkout, so a `$1-$4` first tip should be designed as "add at least `$5`, send the tip now, keep the rest for future tips," unless the live Coinbase-account flow allows a lower funded amount in our integration.

## First-time reader's first tip

### Before the reader clicks

The cook has already completed recipient setup:

1. The cook creates or connects a wallet that can receive USDC on Base.
2. We verify that the address belongs to the intended cook and restaurant profile.
3. We show the cook what they will receive: USDC, not dollars in a bank account.
4. If the cook wants cash, they separately need a way to sell or cash out USDC, typically a Coinbase account with KYC and a bank/debit payout method.

The reader does not need to install anything in the ideal path. They need a modern browser/device that supports passkeys and either an existing Coinbase account, Apple Pay/debit card guest checkout where available, or enough USDC already in the new wallet.

### Screen-by-screen reader flow

1. **Newsletter CTA**

   The issue has a button like `Tip Maya $3`. The email should name the cook, restaurant, suggested amount, and that the tip goes directly to the cook in USDC on Base.

2. **Tip page**

   The reader lands on our hosted page. It shows:

   - Cook name and restaurant.
   - Preset buttons: `$1`, `$3`, `$5`, plus optional custom amount.
   - A short line: "Paid in USDC on Base. Coinbase account works. No crypto app required."
   - Primary button: `Continue`.

3. **Choose or create payment wallet**

   We show `Continue with Coinbase/Base wallet`.

   If this is their first time, Coinbase/Base opens a smart-wallet/passkey flow. The reader is not asked for a seed phrase, browser extension, or separate wallet app.

4. **Create passkey**

   The browser or operating system shows the native passkey sheet: Face ID, Touch ID, Windows Hello, Android screen lock, password manager, or security key.

   The reader approves. A smart wallet is created for them. This is the first thing they "sign up for" if they have never used a wallet before: a passkey-backed wallet identity.

5. **Return to tip page: balance check**

   Our page checks whether the new wallet can send the selected USDC amount.

   - If it has enough USDC, skip to screen 10.
   - If it has no USDC, show `Add funds with Coinbase`.

6. **Coinbase Onramp start**

   The reader enters the Coinbase-hosted Onramp screen. For a reader who already has Coinbase, they choose `Sign in with Coinbase`.

   A reader without Coinbase uses guest checkout if eligible, or creates a Coinbase account. Creating a full Coinbase account may require email/phone verification, identity verification, and linking a payment method before the first tip can be funded.

7. **Coinbase sign-in and permissions**

   Coinbase asks the reader to sign in and complete normal account security, such as 2FA.

   Coinbase then asks the reader to allow the connected app/onramp flow to buy or transfer crypto to the destination wallet. Coinbase says the app cannot move funds without the reader approving the transaction.

8. **Choose funding source**

   The reader chooses a Coinbase balance, linked bank account, debit card, Apple Pay, PayPal, or another supported payment method depending on country/account eligibility.

   For the smoothest first tip, we should default the onramp quote to USDC on Base and to the minimum fundable amount needed for the selected tip. If the selected tip is below the funding minimum, this screen should say plainly: "Add `$5`; send `$3` now; keep `$2` for later tips."

9. **Coinbase preview and confirm**

   Coinbase shows the purchase/transfer preview: amount, USDC, Base network, payment method, fees, and destination wallet.

   The reader taps `Confirm`. Coinbase buys or transfers USDC to the reader's smart wallet. Buying/transferring USDC on Base is advertised by Coinbase as free in the Onramp product, but the live preview is the source of truth for any fee.

10. **Return to tip review**

   Our page now shows:

   - Tip amount.
   - Recipient.
   - Payment asset: USDC on Base.
   - Network fee: `$0` to reader, sponsored by us.
   - Button: `Send tip`.

11. **Approve the tip**

   The browser/OS passkey sheet opens again. The reader approves with Face ID, Touch ID, device lock, password manager, or security key.

   This signs the USDC transfer. The reader still does not install an app, write down a seed phrase, choose a chain, or buy ETH.

12. **Confirmation**

   Our page shows `Tip sent`, the cook's name, the amount, and a transaction link. It also shows the remaining wallet balance if the reader funded more than they tipped.

13. **Cook receives funds**

   The cook's Base wallet receives USDC directly. We may notify the cook by SMS/email/dashboard, but the money has not passed through the newsletter's custody if we implement this as a direct onchain transfer.

## Everything the reader may have to install, sign up for, or fund

Ideal existing-Coinbase path:

- Install: nothing.
- Sign up: create a passkey-backed smart wallet/Base account.
- Fund: buy or transfer USDC through Coinbase Onramp if their wallet has no USDC.

Existing Coinbase account but no linked payment method:

- Install: nothing.
- Sign up: passkey-backed wallet.
- Fund setup: add or select a Coinbase payment method before the first tip.

No Coinbase account:

- Install: nothing in the best case.
- Sign up: passkey-backed wallet.
- Fund setup: guest checkout if eligible, or Coinbase account creation with identity/payment setup.
- Funding minimum may exceed a `$1-$4` tip.

Passkey or browser failure path:

- The reader may need to switch browser/device, use a password manager/security key, or install/use the Base/Coinbase Wallet app. This should be treated as a recovery path, not the core funnel.

## What would make this setup wrong

This setup is wrong if the product changes in any of these ways:

1. **The primary goal becomes maximum conversion from non-crypto readers, not direct onchain payment.**

   If "reader taps once with Apple Pay/card and never sees wallet language" matters more than direct-to-cook settlement, use a normal payments stack and pay cooks out later through payroll, Stripe Connect, Cash App, Venmo, or ACH.

2. **Tips must really be `$1-$4` with no preload, balance, or leftover funds.**

   A wallet plus onramp is clumsy when the funding step can be bigger than the tip. If most readers tip once, at `$1`, and never return, card/Apple Pay aggregation beats onchain direct tips.

3. **The cook needs dollars in a bank account immediately.**

   USDC in a wallet is not the same as payroll cash. If the promise becomes "cook receives spendable USD today," we need a payout/offramp product and likely a custodial or marketplace payments model.

4. **The newsletter must handle disputes, refunds, tax forms, compliance, or tip pooling.**

   Direct onchain tips are hard to unwind and hard to reassign. If restaurants require pooled tips, employer reporting, chargebacks, receipts, or wage-law controls, the product should become a managed tipping/payment platform instead of peer-to-peer wallet transfers.

5. **Most readers do not actually have Coinbase accounts or are outside supported geographies.**

   The recommendation depends on Coinbase familiarity and Onramp availability. If the audience is mostly non-Coinbase, international, underbanked, or blocked by local support/KYC, choose local payment methods first and crypto only as an optional rail.

6. **Recipient onboarding is the bigger bottleneck than reader onboarding.**

   If cooks do not want wallets, lose passkeys, need shared restaurant administration, or cannot comfortably cash out USDC, direct wallets become support debt. In that case, use managed recipient accounts and fiat payouts.

7. **The product needs private, anonymous, or cash-like tipping.**

   Coinbase Onramp brings KYC, account history, and a traceable onchain transaction. That is a feature for compliance and a drawback for anonymity.

8. **The product becomes high-frequency or subscription-like.**

   If readers tip every issue or maintain balances, a wallet starts making more sense. If instead this becomes recurring patronage, memberships, or scheduled contributions, account-based billing may be cleaner than repeated onchain confirmations.

9. **The product wants to support many assets or non-EVM ecosystems.**

   Coinbase/Base smart-wallet flow is strongest for EVM/Base. If cooks demand Bitcoin, Solana, Venmo, bank deposits, or cash cards, do not force Base USDC as the main rail.

10. **We are unwilling to sponsor gas and support wallet recovery edge cases.**

    The reader experience only works if gas is invisible and support is prepared for passkey/device confusion. If we will not own that support surface, we should not put crypto in the critical path.

## Build implication

The MVP should be brutally narrow:

- One asset: USDC.
- One network: Base.
- One reader path: Coinbase/Base smart wallet plus Coinbase Onramp.
- One recipient path: verified cook-owned Base address.
- One clear escape hatch: "Need dollars instead?" for cooks, handled before launch.

Do not build a general wallet, multi-chain tipping app, token picker, or restaurant treasury product yet. The product either proves that Coinbase-familiar readers will tolerate one passkey plus one funding step to tip a cook directly, or it tells us to move the core flow back to fiat payments.

## Sources checked

- Coinbase Smart Wallet / Base account help: https://help.coinbase.com/en/wallet/getting-started/smart-wallet
- Coinbase Base account passkey sign-in help: https://help.coinbase.com/en/wallet/getting-started/smart-wallet-passkeys
- Coinbase Onramp overview and minimum/USDC notes: https://docs.cloud.coinbase.com/onramp-%26-offramp/onramp-apis/onramp-overview
- Coinbase Onramp user flow and permissions: https://help.coinbase.com/en/coinbase/trading-and-funding/coinbase-pay/using-onramp
- Coinbase Paymaster/gasless Base product page: https://www.coinbase.com/developer-platform/products/paymaster
