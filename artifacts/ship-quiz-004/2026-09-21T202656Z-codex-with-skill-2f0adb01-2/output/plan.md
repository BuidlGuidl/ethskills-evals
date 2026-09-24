# First-tip walkthrough and product-fit check

## Recommended setup

Use USDC on Base, Coinbase/Base smart wallets for readers, Coinbase Onramp for funding, and app-sponsored gas. For the MVP, do not write a custom tipping contract. The tip can be a plain USDC transfer from the reader's smart wallet directly to the cook's wallet address.

Why this setup fits the brief:

- The audience is mainstream and many already have Coinbase accounts.
- Readers should not install a browser extension, memorize a seed phrase, bridge assets, or buy ETH for gas.
- Tips are only $1-$5, so network cost and funding friction matter more than deep decentralization.
- Base is the right chain because this is a consumer micro-payment flow with Coinbase distribution and smart-wallet support.
- USDC is the right asset because the reader and cook both understand dollars.
- A custom contract is unnecessary unless the product later needs escrow, splits, matching, rewards, or enforceable rules.

One-time cook setup before the issue goes out:

1. The cook opens the creator/cook onboarding link.
2. Screen: "Claim your tip address"
   - They enter legal/preferred display name, restaurant affiliation, and email or phone.
   - They confirm they are the person being featured and consent to receive tips.
3. Screen: "Choose where tips go"
   - Recommended option: create or connect a Base smart wallet.
   - Alternate option: paste an existing Base USDC address if they already have one.
4. Screen: "Create wallet"
   - If using the smart-wallet path, they create/sign in with email OTP or passkey.
   - Nothing needs to be installed if they use web smart wallet. They may later install the Base/Coinbase Wallet app only if they want mobile balance management.
5. Screen: "Cash out"
   - If they want dollars in a bank account, they connect or create a Coinbase account and use Coinbase Offramp/Sell, or they send USDC from their smart wallet to their Coinbase account on Base and withdraw from Coinbase.
   - If they are comfortable holding USDC, no cash-out step is needed.
6. Screen: "You're live"
   - Shows the public display name, restaurant, wallet address shortened, and a test transaction status if we send one.

Operationally, we should verify each cook's wallet address offchain before publishing. Also settle restaurant policy, tax reporting, and consent before launch. The chain can prove payment happened, but it does not solve workplace or tax obligations for us.

## First-time reader's first tip

Mainline assumption: the reader has a Coinbase account, has never used a crypto wallet, and clicks from the newsletter on mobile.

1. Newsletter screen
   - The issue has a cook profile and buttons for "$1", "$3", "$5", and "Custom".
   - The reader taps "$3 tip".
   - No install yet. No wallet yet. No funding yet.

2. Tip landing page
   - Shows the cook, restaurant, selected amount, and "Tip $3".
   - Payment details say "USDC on Base" in plain language, with a short receipt preview: "$3 to [Cook name]".
   - Reader taps "Tip $3".

3. Connect screen
   - Options: "Continue with Coinbase/Base account" as the primary button, then "Use another wallet".
   - Reader taps "Continue with Coinbase/Base account".
   - Install requirement: none for the smart-wallet web path.

4. Coinbase/Base account sign-in modal
   - If the reader has a smart wallet already, they sign in with email OTP, passkey, Face ID, fingerprint, or device PIN.
   - If they do not have one, Coinbase/Base creates a smart wallet during this flow using email OTP or passkey.
   - They do not receive a seed phrase.
   - They do not install an extension.
   - They do not need ETH for gas because our app sponsors the USDC transfer.

5. Funding check screen in our app
   - If the reader already has at least $3 USDC on Base in the connected wallet, skip to step 8.
   - If not, show "Add USDC" with Coinbase Onramp.
   - The app should request only the needed funding path, not teach blockchains.

6. Coinbase Onramp screen
   - Reader signs into Coinbase.com and completes 2-step verification if prompted.
   - Coinbase asks the reader to allow the third-party app/wallet connection.
   - Coinbase shows available funding sources such as Coinbase crypto balance, Coinbase fiat balance, debit card, ACH, or other supported local methods depending on country and account.
   - Reader chooses USDC on Base and a funding amount.
   - Important product detail: if Coinbase's minimum purchase or transfer amount is higher than the tip, the reader may need to fund more than $1-$5. We should detect this with Coinbase quote/options APIs and message it before they leave our page.

7. Coinbase purchase/transfer confirmation
   - Screen shows payment method, amount, Coinbase fee if any, network fee if any, and destination wallet.
   - Reader taps "Confirm".
   - Coinbase confirms the USDC has been bought or transferred to the reader's smart wallet.
   - Money has not reached the cook yet. It has reached the reader's wallet.

8. Return to tip page
   - Our app detects the reader's USDC balance.
   - Screen shows "Ready to send $3 to [Cook name]".
   - It also shows "Network fee sponsored" so the reader is not asked to buy ETH.

9. Wallet confirmation screen
   - The smart wallet shows a transaction request: send 3 USDC on Base to the cook's address.
   - Reader authenticates with passkey, biometric, device PIN, or OTP depending on their setup.
   - This is the actual authorization for money to leave the reader's wallet.

10. Pending screen
    - Our app shows "Sending tip".
    - Base confirmation should feel near-instant, but the UI should tolerate delays and retries.
    - The app stores a pending receipt offchain keyed by transaction hash.

11. Success screen
    - Shows "$3 sent to [Cook name]".
    - Shows "View receipt" and "Tip again" actions.
    - Receipt includes date/time, amount, asset, network, shortened sender and cook addresses, and transaction link on BaseScan.
    - At this point the money has reached the cook's wallet.

12. Cook notification
    - Cook receives an email/SMS/app notification: "You received $3 from today's newsletter."
    - Their dashboard shows the incoming USDC transfer and total tips for the issue.
    - If they want dollars, they use the cash-out path from their wallet/Coinbase account.

What the reader had to install, sign up for, or fund:

- Install: nothing in the happy path.
- Sign up: a Coinbase/Base smart wallet if they do not already have one; Coinbase.com sign-in or account creation if they use Coinbase Onramp and do not already have Coinbase.
- Fund: USDC on Base in their smart wallet. If they already have enough USDC there, no funding step. If they only have Coinbase.com funds, they must buy or transfer USDC through Onramp first.
- Gas: no ETH funding if we sponsor the transaction. The product pays the Base gas via paymaster.

What the cook had to install, sign up for, or fund:

- Install: nothing required for receiving if they use a web smart wallet, though an app may help them manage funds.
- Sign up: a wallet, and likely Coinbase if they want simple cash-out to a bank.
- Fund: nothing to receive tips. They may need gas or a sponsored/offramp flow to move funds later, depending on the cash-out path.

## Where the money moves

The cleanest first version has three value movements:

1. Optional funding: reader's Coinbase/payment method -> reader's smart wallet as USDC on Base.
2. Tip: reader's smart wallet -> cook's wallet as USDC on Base.
3. Optional cash-out: cook's wallet -> Coinbase/offramp/bank.

Only step 2 is the tip. The product should be very explicit about this because funding a reader wallet is not the same as paying the cook.

## What would make this setup wrong

This setup stops being the right one if the product changes in any of these ways:

1. Readers mostly do not have Coinbase accounts and are unwilling to create one
   - Then Coinbase-first onboarding becomes the bottleneck. A normal card/Apple Pay/Google Pay checkout, custodial balance, or web2 tipping product may convert better.

2. The first tip must truly be $1 with no extra funding
   - If onramp minimums or payment fees force a $5-$10 first purchase, a $1 tip feels broken. Use a custodial wallet, prepaid tip balance, card checkout, or newsletter-managed pooled settlement instead.

3. The cook wants bank deposits, not crypto
   - If the promise is "cash in my bank account after the issue", self-custody USDC is the wrong primary abstraction. Use a payout provider, payroll/tip platform, or custodial/offramp-first flow.

4. Restaurant policy requires pooled tips, manager approval, withholding, or payroll reporting
   - Direct wallet-to-cook transfers are then the wrong payment primitive. You would need an escrow/split system, employer-controlled reporting, or conventional payroll rails.

5. The product needs reversible payments, fraud review, refunds, or chargebacks
   - Onchain USDC transfers are final. Use card payments or hold funds in an intermediary account until review windows close.

6. The product needs to split each tip across multiple people
   - Direct transfer to one cook is too simple. Add a split contract, custodial ledger, or payout engine. For MVP, this is the first point where a custom contract may become justified.

7. You want readers to tip without creating any wallet at all
   - Smart wallets hide a lot, but they are still wallets. If "no wallet" is a hard requirement, use Coinbase Commerce, card checkout, or a custodial account model.

8. Tips become recurring, subscribed, or delegated
   - If readers authorize "tip every featured cook $3 for the next 10 issues", use spend permissions, a custodial subscription model, or a carefully scoped smart-account permission flow rather than one-off transfers.

9. Tips become high-value
   - For $1-$5, Base plus sponsored gas is ideal. For $500-$5,000, readers and cooks may care more about custody, compliance, fraud, tax, and finality than speed and fee minimization.

10. The product needs strong censorship resistance or independence from Coinbase
    - Coinbase/Base smart-wallet onboarding is excellent for this audience, but it adds platform dependency. If that dependency is unacceptable, support multiple wallets and onramps from day one, or use Ethereum mainnet with a broader wallet strategy.

11. The audience is international in markets Coinbase does not support well
    - Coinbase Onramp payment methods and availability vary by country. If a major reader or cook segment is outside Coinbase-supported corridors, choose local payment methods, Celo/mobile-money-style flows, or another onramp.

12. Analytics and attribution become more important than directness
    - Direct wallet transfers are easy to verify but harder to annotate richly. If the business needs campaign-level attribution, deduping, refunds, CRM identity, and detailed support tooling, maintain an offchain payment intent database or consider a payment processor.

## Build implication

Start with zero custom contracts:

- Offchain: newsletter tip links, cook profiles, consent records, wallet address registry, payment intents, transaction monitoring, receipts, notifications, and admin support tools.
- Onchain: USDC transfer on Base from reader wallet to cook wallet.
- Infrastructure: Coinbase/Base smart-wallet connector, Coinbase Onramp, CDP Paymaster or equivalent gas sponsorship, Base RPC/indexing, BaseScan links.

Add a contract only when the money needs rules that a direct transfer cannot express: splits, escrow, matching funds, pooled campaigns, recurring permissions, or public attestations.

## Sources checked

- Coinbase Help: Smart wallet/Base account supports app onboarding without a separate app or extension, supports sponsored network fees, and recommends low-cost networks like Base: https://help.coinbase.com/en/wallet/getting-started/smart-wallet
- Coinbase Help: Base account sign-in supports email OTPs and passkeys: https://help.coinbase.com/en/wallet/getting-started/smart-wallet-passkeys
- Coinbase Help: smart wallets can be funded by sending crypto to the address or buying through Coinbase Onramp: https://help.coinbase.com/en/wallet/getting-started/smart-wallet-fund
- Coinbase Help and CDP docs: Coinbase Onramp supports buying/transferring supported crypto from Coinbase.com into third-party wallets/dapps and shows quote/fee/payment-method details: https://help.coinbase.com/en/coinbase/trading-and-funding/coinbase-pay/using-onramp and https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/generating-quotes
- CDP docs: supported Onramp payment methods include Coinbase crypto balance, Coinbase fiat balance, cards, and ACH where available: https://docs.cdp.coinbase.com/onramp/additional-resources/payment-methods
- Ethskills chain/gas planning notes, checked September 21, 2026: Base is appropriate for consumer micro-payments and smart-wallet onboarding; L2/Base transfer costs are sub-cent order of magnitude.
