# First-tip walkthrough and fit test

## Recommended setup

Use Base mainnet, USDC on Base, Coinbase Smart Wallet / Base Account for the reader, and gas sponsorship for the tip transaction. The newsletter app should not custody tips. The tip should settle directly from the reader's wallet to the cook's Base USDC address.

For the MVP, use zero custom contracts. The app creates a signed offchain tip intent with issue ID, restaurant ID, cook ID, amount, recipient address, and expiration, then asks the reader's wallet to send USDC on Base. If we need stronger duplicate-payment protection, exact-amount guarantees, optional operator fees, or richer onchain payment events, use Coinbase Commerce's deployed Onchain Payment Protocol on Base instead of writing our own contract.

Base is the right first chain because the audience already overlaps with Coinbase, Coinbase Smart Wallet can be created from a web app without an extension or seed phrase, apps can sponsor network fees, and Base fees are low enough for $1-$5 tips. Current fee trackers around September 2026 show Base ERC-20 transfer fees around fractions of a cent to roughly $0.001, but we should re-check gas during launch week because micro-payments are sensitive to fee spikes.

Sources checked: Coinbase Smart Wallet docs, Coinbase Onramp payment-method docs, Coinbase MagicSpend help, Coinbase Commerce Onchain Payment Protocol repo, BaseScan gas tracker.

## What is onchain

Onchain:

- The USDC transfer from the reader to the cook.
- The sender, recipient, amount, token, chain, transaction hash, and timestamp.
- If we use the Commerce protocol, the emitted payment event and unique payment identifier.

Offchain:

- Newsletter issue pages.
- Restaurant/cook profiles.
- Cook eligibility, display names, photos, schedules, and moderation.
- Tip button copy, suggested amounts, thank-you screens, receipts, analytics, and rankings.
- Any ranking such as "most tipped cooks this week"; rankings are derived from indexed onchain transfers plus offchain metadata, not stored in a contract.

Custom contracts:

- MVP: none.
- Possible later: only if we need pooled matching funds, escrow, fee splitting, or programmatic allocation among several workers. A custom contract is not justified for one reader tipping one cook.

## First-time reader's first tip

Assumptions for this walkthrough:

- The cook has already completed recipient onboarding.
- The cook has a Base USDC receiving address controlled by them, ideally a Coinbase/Base smart wallet or Coinbase account deposit address that supports USDC on Base.
- The newsletter pays gas through a Coinbase/CDP paymaster or similar sponsor policy.
- The reader has no existing crypto wallet but may already have a Coinbase account.

### Recipient setup before the reader ever tips

This is required before money can reach the cook directly:

1. Cook opens the private onboarding link from the newsletter.
2. Screen: "Claim your tip page."
   The cook confirms name, restaurant, role, and payout display name.
3. Screen: "Choose where tips go."
   The cook either connects/creates a Base smart wallet or enters a Coinbase/Base USDC receive address.
4. If creating a wallet:
   The cook creates a passkey using Apple, Google, Windows Hello, or a password manager. No browser extension or seed phrase is required for a smart wallet path.
5. If using Coinbase:
   The cook may have to sign in to Coinbase and, if not already verified, complete Coinbase account setup/KYC. This is Coinbase's signup burden, not ours, but it is still part of the real product.
6. Screen: "Verify ownership."
   The cook signs a message or receives a tiny test payment so we know the destination is theirs.
7. Screen: "Ready to receive tips."
   We store cook ID, wallet address, chain, token, legal/tax metadata, and whether the cook wants public recognition.

The tip reaches the cook when the Base USDC transfer confirms to that address. Cashing out to a bank account is a separate recipient action after receipt.

### Reader flow, happy path with an existing Coinbase account

1. Reader opens the newsletter issue.
   Screen: the restaurant story includes a "Tip the line cook" button and $1, $3, $5 suggested amounts.

2. Reader taps "$3".
   Screen: compact tip sheet showing cook name, restaurant, amount, "USDC on Base", and "Network fee paid by us." It also says the tip goes directly to the cook's wallet.

3. Reader taps "Continue."
   Screen: wallet connection. The default option is "Continue with Coinbase / Base Account." Secondary options can be hidden under "Other wallet" for crypto-native readers.

4. Reader creates a smart wallet.
   The Coinbase/Base wallet modal asks the reader to create or use a passkey. They use Face ID, Touch ID, Windows Hello, Android passkey, or a password manager.

   Install required: none for the smart-wallet path.

   Signup required: a passkey wallet is created. If the reader links Coinbase for funding, they also sign in to Coinbase.

5. Screen: "Choose how to pay."
   If the Coinbase-linked payment path can fund this transaction directly, the reader chooses "Pay with Coinbase." They sign in to Coinbase, approve linking, and select a Coinbase balance or funding method.

   If direct payment from Coinbase balance is not available for USDC on Base in the current Coinbase product state, the app falls back to Coinbase Onramp:

   - Screen: Coinbase Onramp opens.
   - Reader signs in to Coinbase.
   - Reader chooses USDC on Base.
   - Reader chooses funding source: Coinbase crypto balance, Coinbase fiat balance, debit card where supported, or ACH in the US.
   - Reader confirms purchase or transfer.
   - Onramp returns them to the newsletter app once the smart wallet has enough USDC.

   Funding required: enough USDC on Base for the tip amount. If Coinbase imposes a minimum purchase larger than the tip, the reader must top up more than $1-$5 and keep the remainder in the wallet.

6. Screen: "Confirm tip."
   The app shows:

   - Cook: name / restaurant.
   - Amount: $3.00 USDC.
   - Network: Base.
   - Fee: paid by newsletter.
   - Recipient: shortened address.

7. Reader approves the wallet request.
   The wallet shows a transaction approval. With gas sponsorship, the reader does not need ETH. If USDC approval is required, the smart-wallet flow should batch approval and transfer where supported; otherwise the reader may see two approvals: first "allow USDC for this payment," then "send tip."

8. Screen: "Sending."
   The app waits for the Base transaction. It should show a cancel-safe pending state, not a spinner-only dead end.

9. Screen: "Tip sent."
   The app shows thank-you copy, transaction hash, amount, cook, restaurant, and receipt email option. The cook's balance has increased on Base once the transaction confirms.

10. Optional screen: "Tip again next issue faster."
    The reader can save the passkey wallet for future tips. Do not ask for a standing spending permission in the MVP unless we are explicitly building recurring tips.

### Reader flow when they do not have Coinbase

The same first screens apply, but the funding screen changes:

1. Reader creates the passkey wallet.
2. Coinbase Onramp asks them to create a Coinbase account or continue without one where supported.
3. They may need email, phone, identity verification, card/bank setup, and Coinbase availability in their region.
4. If they cannot complete KYC or their payment method is declined, the tip cannot be funded through this path.

This is the biggest weakness of the setup: the first successful $1 tip may require a financial-account onboarding flow that feels larger than the tip.

### Reader flow with an existing crypto wallet

1. Reader taps "Other wallet."
2. They connect MetaMask, Rainbow, Coinbase Wallet, or another EVM wallet.
3. They switch to Base if needed.
4. They need USDC on Base for the tip.
5. If gas is not sponsored for that wallet type, they also need ETH on Base for gas.
6. They approve and send.

This path is useful but should not be the primary flow for this audience.

## State transitions

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| Create reader smart wallet | Reader through wallet provider | No normal gas burden to reader if creation is sponsored/abstracted; otherwise they do it to tip | Reader cannot tip |
| Fund reader wallet / Pay with Coinbase | Reader through Coinbase Onramp or Coinbase-linked flow | They want to send the tip; Coinbase/payment fees may apply depending on method | Reader has no spendable USDC, so no tip is sent |
| Send USDC tip | Reader's wallet, sponsored by newsletter paymaster | Reader wants to tip; newsletter sponsors gas to remove friction | Cook receives nothing; no funds are moved |
| Index transaction and mark receipt | Newsletter backend/indexer | Offchain operating cost, needed for receipts and analytics | Onchain payment is still valid, but UI/receipt may lag |
| Cook cashes out later | Cook through Coinbase/Base app or exchange | Cook wants dollars in bank | Funds remain in cook's wallet |

No owner-only cron should be required for settlement. The only critical money-moving action is the reader's transaction.

## What would make this setup wrong

This Base/Coinbase smart-wallet setup is wrong if the product changes in any of these ways:

1. The real requirement is "reader pays with Apple Pay/card and never sees crypto."
   Then use a normal payments stack with marketplace payouts, or a custodial/stored-value ledger if legally supportable. Crypto can still be a backend settlement rail, but it should not be in the reader journey.

2. Cooks need dollars in bank accounts, not USDC in wallets.
   Then the recipient experience is the product. Use Stripe Connect, payroll integration, earned-wage/tip payout tooling, or a Coinbase Business/Coinbase Payments-style off-ramp flow. Direct onchain tips are a mismatch if every cook immediately has to learn wallet management and cash-out.

3. The average tip remains $1 and first-time readers must fund from scratch.
   If minimum buys, KYC, card declines, or funding latency dominate conversion, the product should batch or custodially aggregate small tips offchain and settle to cooks periodically. A $1 emotional impulse cannot carry a five-screen financial onboarding.

4. The newsletter wants to pool tips and distribute them by rules.
   If tips go into a common bucket, are split among kitchen staff, matched by sponsors, or adjusted after the fact, direct reader-to-cook transfer is no longer the primitive. We would need either an offchain allocation system with periodic payouts or a small audited splitter/escrow contract.

5. The product needs refunds, disputes, chargebacks, or fraud review before payout.
   Direct onchain settlement is final. If editorial mistakes, impersonation, employer disputes, or reader refunds must be handled after payment, use delayed settlement or a reversible fiat payment method.

6. The product needs tips to be private.
   Base transfers are public. We can avoid showing names in our UI, but sender/recipient addresses, amounts, and timing are visible. If privacy is a core promise, this setup is wrong.

7. The target market is mostly outside Coinbase-supported regions.
   Coinbase Onramp availability, payment methods, and KYC support vary by country. If many readers or cooks cannot use Coinbase, choose a broader payments/onramp strategy or region-specific fiat rails.

8. The restaurant, employer, or law requires tips to run through payroll.
   Direct-to-cook payments may create wage, tax, tip-pooling, reporting, or employer-policy issues. If payroll compliance is mandatory, the cook should not be the direct onchain merchant.

9. We need chain-neutral or non-EVM reach.
   Coinbase smart wallet is an EVM path. If the product must support Solana, Bitcoin, Venmo-like handles, bank accounts, or multiple international local rails, Base-only is too narrow.

10. We need automatic recurring tips.
    One-off direct transfers are simple. Recurring tips introduce spending permissions, cancellation UX, limits, notifications, and abuse controls. That may still be possible with smart accounts, but it is a different product and threat model.

## Decision

For the stated product, I would build the MVP on Base with Coinbase Smart Wallet/Base Account, USDC, sponsored gas, and direct cook settlement. I would avoid custom contracts until the product proves that direct one-to-one tips are not enough.

The main launch risk is not blockchain execution; it is conversion through first-time funding. Before committing to a full build, prototype the live Coinbase funding path with ten non-crypto readers and measure whether a $1-$5 impulse survives passkey creation, Coinbase login, and USDC funding.
