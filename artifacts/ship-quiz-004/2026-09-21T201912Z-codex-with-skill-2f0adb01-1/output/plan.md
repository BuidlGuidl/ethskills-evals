# First-tip walkthrough and setup decision

## Recommended setup

Use **Base Pay / Base Account on Base, paying USDC directly to the cook's wallet**.

For the MVP, do **not** write a tipping smart contract. The product should create a signed payment intent for a specific cook, issue, amount, and newsletter attribution, then use Base Pay to send USDC on Base to the cook's address. Our backend records the intent and verifies the completed transaction. The value transfer itself is just a USDC payment from the reader to the cook.

Why this setup fits the facts:

- Readers are non-crypto users, so the flow needs to look like checkout, not like DeFi.
- Many readers already have Coinbase accounts, so Coinbase/Base rails reduce the first funding step.
- Tips are small, so Base's sub-cent/near-instant payment profile matters more than mainnet composability.
- Bursts after each issue are fine because every payment is independent; there is no pooled contract that has to be operated or drained.
- "Directly to the cook" is credible: settlement is to the cook's own Base address, not to our treasury.

The cook must be onboarded before the issue goes out. They need a Base Account/Base app or another EVM wallet that can receive **USDC on Base**, a saved recovery method/passkey, and a plan for cashing out if they want dollars in a bank account. If they cash out through Coinbase or another offramp, they may need identity verification and bank linking there. Until then, what they have received is USDC in a wallet, not payroll cash.

## First-time reader's first tip

Assume the reader taps a newsletter link on their phone and wants to tip `$3`.

### 1. Newsletter

Screen: the restaurant story in the email.

The call to action is something like:

> Tip Ana, line cook at North Street Grill

The link contains the issue id, cook id, default amount, and source attribution. The reader does not install anything from the email.

### 2. Tip page

Screen: our hosted tip page.

The page shows:

- cook name, restaurant, and why they are being tipped
- preset amounts: `$1`, `$3`, `$5`
- optional custom amount, probably capped for launch
- "Pay with Base Pay"
- plain disclosure: "Paid in USDC on Base directly to Ana's wallet."

No wallet is connected yet. The reader chooses `$3` and taps **Pay with Base Pay**.

### 3. Base Pay checkout opens

Screen: Base Pay modal or redirect.

It shows:

- amount: `$3.00 USDC`
- recipient: Ana's wallet, displayed as a name plus shortened address
- app/requesting site: the newsletter
- action button: continue/pay

If the reader already has a Base Account with enough USDC, they can skip to step 7.

### 4. Base Account sign-in or creation

Screen: Base Account sign-in.

The reader is asked to sign in or create a Base Account, usually with a passkey/email-style account flow. They do **not** need to install a browser extension or learn a seed phrase for the happy path.

What they may have to do:

- create or use a passkey
- confirm on the same phone, Face ID, Touch ID, device PIN, or a password manager
- sign in to an existing Base/Coinbase-related account if they already have one

What they should not have to do:

- install MetaMask
- write down a seed phrase
- bridge assets manually
- buy ETH for gas before tipping

### 5. Funding screen, if the Base Account has no USDC

Screen: add funds / Coinbase Onramp.

This is the friction point. The reader needs USDC on Base before the cook can receive the tip.

If they already have a Coinbase account:

- they sign in to Coinbase if not already signed in
- choose an existing Coinbase balance, saved bank account, debit card, PayPal, Apple Pay, or other available method
- buy or transfer USDC on Base into their Base Account
- confirm the funding transaction

If they do not have a Coinbase account:

- they may be able to use guest checkout with card or Apple Pay where available
- otherwise they must create a Coinbase account
- Coinbase may require identity verification, payment method setup, or fraud checks

Important product caveat: Coinbase-hosted onramp flows have historically enforced a minimum transaction amount, commonly `$5`. That means a first-time `$1` or `$3` tip may require the reader to fund `$5`, send `$3`, and leave `$2` in their Base Account for later. This is tolerable only if we expect repeat tipping or if we default first-time readers to `$5`.

### 6. Return to payment

Screen: back to the Base Pay checkout.

The reader now has enough USDC. The payment screen again shows:

- `$3.00 USDC`
- Ana as the recipient
- the shortened destination address
- any network fee, if one is shown

For launch, we should sponsor or hide gas wherever the tooling permits. If a fee is shown, it should be a tiny Base network fee, not an ETH-buying chore.

### 7. Final authorization

Screen: passkey/payment confirmation.

The reader confirms the payment with the device passkey/biometric/PIN. This is the moment that actually authorizes the USDC transfer.

They are not approving an unlimited allowance, not depositing into our contract, and not giving us custody. The payment goes to the cook's Base address.

### 8. Pending screen

Screen: our tip page, waiting state.

The page says the tip is being confirmed. It should show a spinner for a few seconds and then resolve. Base is fast enough that this should feel closer to a checkout confirmation than to a traditional crypto transaction.

Behind the scenes, our backend checks the returned payment id or transaction hash and verifies:

- expected amount
- expected recipient
- Base network
- USDC token
- not already used for another tip receipt

### 9. Success screen

Screen: receipt.

The reader sees:

- "Ana received `$3.00 USDC`"
- restaurant/cook
- issue/source attribution
- transaction link on Basescan
- optional "Tip another cook" or "Save for next issue"

The cook can see the incoming USDC in their wallet. If they want dollars in their bank, they still need to cash out through Coinbase/Base app or another offramp. That cash-out step is the cook's step, not the reader's.

## What the reader had to install, sign up for, or fund

Happy path for an existing Coinbase/Base user with funded USDC:

- installs: nothing
- signs up: nothing new
- funds: nothing
- confirms: one payment with passkey/device auth

Likely first-time path for a Coinbase user with no Base Account and no USDC:

- installs: ideally nothing; possibly the Base app only if web/passkey recovery or cash-management prompts push them there
- signs up: create/sign into Base Account; sign into Coinbase for funding
- funds: buy or transfer at least the minimum USDC amount on Base
- confirms: Coinbase funding confirmation, then Base Pay payment confirmation

Hardest path for a reader with no Coinbase account:

- installs: still ideally nothing
- signs up: Base Account plus Coinbase account or guest checkout identity/payment flow
- funds: card/Apple Pay/bank purchase of USDC on Base, subject to availability, limits, fraud checks, and minimums
- confirms: funding confirmation, then payment confirmation

## What we should build around this

Keep the product thin:

- cook onboarding and address verification
- payment-intent creation
- Base Pay integration
- server-side payment verification
- receipt and attribution
- abuse controls, caps, and refund/support policy
- export for cooks and for our own reporting

Avoid for MVP:

- a custom tipping contract
- pooled custody
- a newsletter token
- reader wallets controlled by us
- bridging
- multi-chain support

## When this setup would be the wrong one

This setup is wrong if **the reader's first successful tip must be `$1-$4` with no leftover balance**. The onramp minimum/funding step becomes larger than the gesture. In that product, use card checkout or a custodial balance and batch payouts.

It is wrong if **"money reaches the cook" means dollars in their bank account immediately**. USDC in a self-custody wallet is not the same as payroll or cash. Use Stripe Connect, payroll rails, Venmo/Cash App-style payouts, or a custodial stablecoin payout product.

It is wrong if **cooks do not want to manage wallets, passkeys, taxes, or cash-out**. Direct self-custody shifts real operational burden to the lowest-paid participant. If that burden is unacceptable, the product should handle compliant custodial payouts instead.

It is wrong if **the restaurant must pool, allocate, or report tips under employer-controlled tip-pooling rules**. Direct reader-to-cook payments could fight payroll, tax, and labor compliance. In that world, the recipient should be the employer/payroll system or a regulated payout intermediary, not an individual wallet.

It is wrong if **privacy matters more than public verifiability**. Onchain payments reveal recipient addresses, timing, and total visible tip flow. If public income trails create safety or employment risks, avoid direct public-wallet payments or use a privacy-preserving/custodial design.

It is wrong if **most readers are outside Coinbase/Base-supported regions or cannot pass onramp checks**. The recommendation relies heavily on Coinbase distribution. A broader global audience may need card-first checkout, local payment methods, or multiple regional payment providers.

It is wrong if **readers will tip only once ever**. A wallet/funding flow makes more sense when the leftover balance and account setup will be reused. For pure one-off generosity, normal card checkout will probably convert better.

It is wrong if **we need chargebacks, reversals, customer-service refunds, or fraud controls that feel like card payments**. Direct USDC transfers are final. We can send a compensating refund, but we cannot pull the original payment back.

It is wrong if **the product becomes subscriptions, recurring support, or a monthly tab**. Then we should re-evaluate smart-account spend permissions, subscriptions, or a custodial ledger rather than single-shot Base Pay calls.

## Sources checked

- Base Pay / Base Account SDK: https://github.com/base/account-sdk
- Base Pay playground: https://base.github.io/account-sdk/pay-playground
- Base payments overview: https://www.base.org/payments
- Coinbase Onramp: https://www.coinbase.com/developer-platform/products/onramp
- Coinbase smart wallet/Base Account help: https://help.coinbase.com/en/wallet/getting-started/smart-wallet
