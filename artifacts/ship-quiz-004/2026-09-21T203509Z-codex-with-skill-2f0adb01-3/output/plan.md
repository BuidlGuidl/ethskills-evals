# First-time tipping walkthrough

Recommended setup: build the tipping flow on Base, use USDC for $1-$5 tips, use Coinbase Smart Wallet/passkey onboarding for readers, sponsor gas, and send the tip directly to the cook's Base address. For the MVP, do not ship a custom smart contract unless we need escrow, splits, matching funds, refunds, or public campaign accounting. The newsletter app can keep restaurant/cook profiles, receipts, fraud controls, and analytics offchain; the onchain action is just the value transfer.

Precondition before any reader sees the flow: the cook has already been onboarded. They have either a Coinbase account that can receive Base USDC or a non-custodial wallet on Base, and we have verified the receiving address with them. If that is not true, the reader can complete a payment-looking flow but the product is not actually delivering "directly to the cook."

## The first tip, screen by screen

### 1. Newsletter article

The reader opens the restaurant story from the newsletter. Near the cook's name is a button: "Tip Maya $3" with optional $1, $3, and $5 choices.

What the reader has installed: nothing new.

What the reader has signed up for: nothing new.

What the reader has funded: nothing yet.

### 2. Tip amount screen

The reader lands on our tip page. It shows the cook, the restaurant, the selected amount, and that the tip is paid in USDC on Base. It should say plainly that the cook receives the tip directly, and that our service fee, if any, is separate and visible.

The reader taps "$3" and then "Continue."

What the reader has installed: nothing.

What the reader has signed up for: nothing.

What the reader has funded: nothing.

### 3. Wallet choice screen

The page asks how they want to pay:

- "Use Coinbase" as the primary path.
- "Use another wallet" as the secondary path.

For this audience, the primary path should use Coinbase Smart Wallet or Coinbase's embedded/onramp flow rather than asking them to install a browser extension. The user should be able to continue with a passkey, Face ID/Touch ID, or their Coinbase account.

What the reader has installed: usually nothing. If they are on mobile and choose the Coinbase app path, they may need the Coinbase app installed. The product should avoid making that mandatory by supporting browser-based Smart Wallet.

What the reader has signed up for: if they already have Coinbase, no new exchange account. If they do not, Coinbase account creation and KYC may be required before funding.

What the reader has funded: nothing yet.

### 4. Coinbase sign-in / wallet creation

The reader sees a Coinbase-hosted sign-in or wallet creation screen.

If they already have Coinbase:

1. They enter email/phone or open Coinbase.
2. They complete 2FA.
3. They create or unlock a Smart Wallet with a passkey if they have not used one before.

If they do not have Coinbase:

1. They create a Coinbase account.
2. They complete identity verification if required.
3. They add a payment method if they want to fund from card/bank.
4. They create or unlock a Smart Wallet with a passkey.

What the reader has installed: no extension; possibly Coinbase mobile app if they prefer app auth.

What the reader has signed up for: a Coinbase account only if they did not already have one; a Smart Wallet/passkey either way if they have not used it.

What the reader has funded: still nothing, unless they already have USDC or USD available in Coinbase.

### 5. Funding screen

This is the painful screen, and it decides conversion.

The app checks whether the reader's wallet has enough Base USDC for the tip. Because we sponsor gas, they do not need ETH for gas. They only need the tip amount, plus any clearly disclosed fee if we charge one.

If they already have Base USDC in the Smart Wallet, this screen is skipped.

If they have USD or USDC in Coinbase but not in the Smart Wallet, Coinbase should offer a "Move $3 USDC to Base" flow. The user confirms the transfer from Coinbase to their Base wallet.

If they have no Coinbase funds, they must buy or add funds first. That means choosing a payment method, confirming the purchase/deposit, and waiting for Coinbase availability rules. Card funding may be fast; bank funding may not be. For a $1-$5 impulse tip, this is the biggest drop-off point.

What the reader has installed: still no required wallet extension.

What the reader has signed up for: no additional account beyond Coinbase/Smart Wallet.

What the reader has funded: their Base wallet now needs at least the tip amount in USDC. The product should not ask them to buy ETH.

### 6. Tip confirmation screen

The app shows:

- Cook: Maya, line cook at the restaurant.
- Amount: $3.00 USDC.
- Network: Base.
- Gas: paid by us.
- Recipient: shortened verified address, with "verified by [newsletter name]."
- Total: $3.00, or $3.00 plus a separately disclosed fee.

The reader taps "Send tip."

What the reader has installed: nothing else.

What the reader has signed up for: nothing else.

What the reader has funded: enough USDC for this tip.

### 7. Wallet authorization screen

Coinbase Smart Wallet asks the reader to approve the transaction. Ideally this is one authorization: send 3 USDC to the cook on Base. Avoid an approve-then-transfer flow for the MVP; use a direct transfer from the reader wallet to the cook wallet, or a payment primitive that does not require an unlimited token approval.

The reader confirms with passkey/Face ID/Touch ID.

What the reader has installed: nothing else.

What the reader has signed up for: nothing else.

What the reader has funded: no ETH; USDC only.

### 8. Pending screen

The app shows "Sending..." for a few seconds. Base blocks are fast and the gas cost is sub-cent, especially compared with the $1-$5 tip size. We wait for transaction confirmation before showing success.

If the transaction fails, show the exact fix: insufficient USDC, wallet rejected, Coinbase funding still pending, or network issue.

### 9. Success receipt

The reader sees a receipt:

- "Maya received $3.00."
- Transaction hash with a Base explorer link.
- Optional share/save receipt.
- Optional "Tip again after future stories" preference.

At this point the money has reached the cook's Base address. The cook may leave it as USDC, transfer it to Coinbase, or cash out through Coinbase depending on their own setup.

## Why this setup fits

This product is a consumer impulse-payment product. The users are newsletter readers, not crypto users; the amounts are small; the payments arrive in bursts; and many readers already have Coinbase accounts. Base plus Coinbase Smart Wallet is the best default because it minimizes new concepts, avoids wallet-extension installation, keeps gas negligible, supports sponsored gas, and matches the existing Coinbase distribution you already have in the audience.

USDC is the right payment asset because the tip is described in dollars. Asking a reader to understand ETH balances, gas, slippage, or token prices would be fatal for a $3 thank-you.

The product should pay gas. Even if gas is tiny, asking first-time users to acquire ETH creates a second funding problem and makes the experience feel like crypto instead of tipping.

## What would make this setup wrong

This setup becomes wrong if most readers do not have Coinbase accounts, or if your acquisition shifts to an audience that strongly prefers Apple Pay, cards, Cash App, Venmo, or another local payment method. In that world, the primary flow should become a card or wallet checkout, with crypto settlement hidden or omitted.

It becomes wrong if the cook cannot or does not want to manage a crypto balance. If cooks need automatic cash-out to a bank account, payroll-style reporting, tax withholding, or employer-mediated disbursement, the product starts looking more like Stripe Connect, payroll, or a custodial marketplace ledger than direct onchain tipping.

It becomes wrong if tips need reversibility, dispute resolution, fraud holds, chargebacks, sanctions screening before release, or pooled escrow. Direct transfers are good when finality is a feature. They are bad when the business needs to claw funds back.

It becomes wrong if the product needs to aggregate tips and split them among a kitchen team, restaurant, charity, or matching sponsor. Then we may need a simple contract or a custodial balance system so splits, caps, matching, refunds, and accounting are deterministic.

It becomes wrong if public onchain visibility is unacceptable. A direct Base transfer creates a public transaction graph. If cooks, restaurants, or readers need privacy around who tipped whom and how much, we need a different design: custodial aggregation, privacy-preserving rails, delayed batch settlement, or a non-crypto payment processor.

It becomes wrong if the main product promise changes from "tip this person now" to "earn rewards, memberships, collectibles, loyalty status, or governance." Then we may need a contract, token, NFT, or points ledger. That is a different product, with more regulatory and UX surface.

It becomes wrong if the average transaction becomes much larger than a few dollars. For $1-$5 tips, convenience matters more than maximum decentralization. For large payments, users may care more about custody, recovery, compliance, and settlement guarantees.

It becomes wrong if you need to launch across many cities or countries where Coinbase is unavailable, poorly supported, or not the dominant account. Then Base may still be technically fine, but Coinbase-first onboarding is no longer the right wedge.

It becomes wrong if the newsletter wants to be chain-neutral or wallet-native for crypto users. In that case, keep Base as one option but add WalletConnect, multiple chains, and perhaps recipient-specific addresses. That is not the right first version for this audience.

The decision rule is simple: if the core job is "a non-crypto reader with a Coinbase account sends a $3 dollar-denominated thank-you to a verified cook in under a minute," use Base, USDC, Coinbase Smart Wallet, and sponsored gas. If the core job becomes payroll, refunds, privacy, complex splits, international coverage, or non-Coinbase checkout, this setup stops being the center of gravity.
