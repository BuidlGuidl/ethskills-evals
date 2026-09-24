# First-tip walkthrough and fit test

## Recommended setup

Use USDC on Base, with a Coinbase/CDP embedded smart wallet or Base Account for the reader, Coinbase Onramp for funding, and a direct USDC transfer to the cook's verified Base address. The newsletter pays gas through a paymaster. Do not build a custom tipping contract for the MVP.

Why this setup fits the stated product:

- The tip amounts are tiny, so the reader should never have to buy ETH for gas.
- Most readers are crypto-new, so the flow must avoid seed phrases, browser extensions, network pickers, and contract approvals that look like developer tools.
- Many readers already have Coinbase accounts, so Coinbase-hosted funding is the best chance of turning "I want to send $3" into a completed tip.
- The product's core promise is value transfer to a named worker, not escrow, voting, matching, leaderboards, or complex settlement. A plain token transfer is enough.
- Base is the natural first chain because Coinbase distribution, Coinbase onramp support, USDC liquidity, smart account support, and gas sponsorship all line up around this use case.

What is onchain:

- The reader's USDC transfer on Base.
- The cook's receiving address.
- The transaction hash, amount, token, sender address, recipient address, and timestamp.

What stays offchain:

- Cook profiles, restaurant names, newsletter issue metadata, photos, eligibility, search, receipt emails, analytics, fraud review, and any editorial curation.
- Any "top tipped" or "most supported" ranking. Compute rankings from indexed transfer events, not contract storage.

Custom contracts for MVP: zero.

The first release should use direct USDC transfers. Add a contract only if the product later needs escrow, pooled matching, conditional release, splits, refunds, or programmable campaign rules.

## First-time reader's first tip

Assume the reader has a Coinbase account, has never used a crypto wallet, and clicks from the newsletter on a phone.

### 1. Newsletter click

The reader taps `Tip Jordan $3` under the restaurant blurb.

They see a normal browser page, not a wallet app. Nothing is installed. No app store handoff happens.

### 2. Tip page

Screen contents:

- Cook name, restaurant, and a short verification note from the newsletter.
- Preset buttons: `$1`, `$3`, `$5`.
- A custom amount field capped for the MVP.
- Primary button: `Tip with Coinbase`.
- Secondary copy that says the cook receives USDC on Base.

Reader action: choose `$3` and tap `Tip with Coinbase`.

Behind the scenes: the app creates or looks up a draft tip intent offchain with issue id, cook id, amount, and recipient address. No money has moved yet.

### 3. Reader account screen

Screen contents:

- `Continue with Coinbase`
- Possibly `Continue with email` as a fallback for an embedded wallet.
- Terms and privacy links.

Reader action: tap `Continue with Coinbase`.

Required signup/install at this point:

- If the reader already has a Coinbase account: no new account signup.
- If the reader does not have a Coinbase account and chooses the Coinbase-authenticated path: they must create one and complete whatever identity, payment, and regional checks Coinbase requires.
- If guest checkout is enabled for fallback card or Apple Pay funding: they may not need a Coinbase account, but they still provide payment and verification details in the hosted onramp flow.
- No browser extension, seed phrase, or separate crypto wallet app should be required.

### 4. Wallet creation / connection

Screen contents:

- A short app screen: `Create your tipping wallet`.
- System passkey prompt or Coinbase/Base Account approval prompt.

Reader action: approve with Face ID, Touch ID, device passcode, or the Coinbase account approval flow.

What gets created:

- A user-controlled EVM smart account or Base Account.
- The reader does not receive or manage a seed phrase.
- The wallet starts with no ETH requirement because gas will be sponsored.

What the reader has to fund:

- USDC for the tip amount.
- No ETH for gas.

### 5. Balance check

If the reader already has enough USDC on Base, skip to step 8.

For most first-time readers, the wallet has no USDC. The app shows a funding screen.

Screen contents:

- `Add USDC for this tip`
- Amount: `$3.00 USDC`
- Any Coinbase/onramp fee and total before the reader confirms.
- Payment options returned by Coinbase for that user and region, such as Coinbase cash balance, crypto balance, bank transfer, debit card, or Apple Pay where supported.

Important product choice: the app should encourage adding a small tip balance, for example `$10`, rather than forcing a fresh onramp for every `$1-$5` tip. The first tip still sends only `$3`; the leftover balance stays in the reader's wallet for future newsletter issues.

### 6. Coinbase-hosted funding

The reader is sent to a Coinbase-hosted onramp screen.

Possible screens inside Coinbase:

- Sign in, if not already signed in.
- Payment method selection.
- Quote screen showing the USD total, USDC amount, fees, destination network `Base`, and destination wallet.
- Bank, card, Apple Pay, or Coinbase balance confirmation.
- 2FA, passkey, bank authentication, or card verification if Coinbase requires it.
- Processing screen.

Required signup/install/funding here:

- Existing Coinbase user with a funded Coinbase cash or crypto balance: usually no new funding source, just a Coinbase confirmation.
- Existing Coinbase user without funds: must use an available payment method or add one.
- New Coinbase user: must create an account and complete Coinbase's required checks before funding.
- Guest checkout user, if enabled: must provide payment details, billing details, phone/email verification, and pass any card or Apple Pay checks.
- No ETH purchase should be required.

Money has not reached the cook yet. The reader has only funded their own wallet with USDC on Base.

### 7. Return to the newsletter tip page

Screen contents:

- `Ready to send Jordan $3`
- Recipient: cook name and restaurant.
- Amount: `$3.00 USDC`
- Network: `Base`
- Gas: `Paid by us`
- Final button: `Send tip`

Reader action: tap `Send tip`.

This second confirmation matters. Funding a wallet is not the same as tipping the cook, and the reader should not be surprised by the final transfer.

### 8. Transaction approval

Screen contents:

- Passkey, Coinbase/Base Account approval, or embedded wallet signing prompt.

Reader action: approve the USDC transfer.

Behind the scenes:

- The app submits a sponsored user operation or transaction.
- The call transfers `$3` USDC from the reader's wallet to the cook's verified Base address.
- The newsletter's paymaster pays gas.
- The backend records the transaction hash against the offchain tip intent.

### 9. Pending screen

Screen contents:

- `Sending tip...`
- Cook name, amount, and a pending state.
- A link to the transaction once available.

The reader should be able to close this screen. The backend should reconcile transaction status asynchronously.

### 10. Success screen

Screen contents:

- `Jordan received your $3 tip`
- Receipt details: amount, network, date, transaction link.
- Remaining wallet balance, if the reader loaded more than the tip amount.
- Optional `Tip another cook` action.

What the cook sees:

- The USDC arrives at the cook's Base address.
- The cook dashboard or email notification shows amount, issue, reader display name if provided, and transaction hash.
- If the cook uses Coinbase, they can see the received USDC there. If they want dollars in a bank account, they still need to sell/offramp through Coinbase or another service.

## State transitions

| Transition | Caller | Why they pay gas or fees | If nobody calls |
| --- | --- | --- | --- |
| Create reader wallet | Reader, through Coinbase/CDP flow | Needed to hold USDC and send the tip | No wallet exists; no tip can be sent |
| Fund reader wallet | Reader, through Coinbase Onramp | Reader wants USDC for the tip; reader pays any payment/onramp fees | Reader has no USDC; no tip can be sent |
| Send USDC tip | Reader signs; app submits with paymaster | Reader wants the cook paid; newsletter pays gas to reduce friction | Funds remain in reader wallet |
| Index tip for receipts/dashboard | App backend/indexer | Needed for receipt, cook dashboard, and newsletter analytics | Onchain transfer still happened; UI may lag |
| Cook offramps to dollars | Cook | Cook wants bank-account dollars instead of USDC | Cook keeps USDC |

## What would make this setup wrong

This setup is wrong if the product needs the first tip to feel exactly like a normal card checkout. If the north star is "tap from email, Apple Pay, done" with no wallet creation, no crypto wording, and no later wallet balance, use a conventional payments/tipping product and pay cooks out through bank rails. A $1 tip cannot tolerate much onboarding friction.

It is wrong if each tip must be a one-off $1-$5 purchase with no stored balance. Onramp minimums, payment checks, and fixed fees can dominate tiny tips. In that version, aggregate fiat tips offchain and batch payouts to cooks, or let readers preload a balance explicitly.

It is wrong if cooks need spendable dollars immediately. USDC on Base is not the same as cash in a bank account. If "directly" means "available in the cook's bank account after the issue," then the product needs automatic offramps, payroll/tip compliance, or a fiat payout provider.

It is wrong if most readers are outside Coinbase-supported markets or do not have Coinbase accounts. The chosen advantage is Coinbase distribution. If the audience shifts to non-Coinbase users, tourists, international readers, or regions with weak onramp coverage, the product should prioritize cards, Apple Pay, local payment methods, or a different wallet/onramp mix.

It is wrong if the newsletter, restaurant, or employer must control disbursement. Direct USDC transfers reduce custody by sending reader to cook. If restaurants need approval, pooling, tip-share rules, payroll reporting, withholding, reversals, or employer-managed allocation, direct transfers are the wrong primitive.

It is wrong if refunds, chargebacks, or buyer protection are a core promise. Onchain transfers are final. You can build goodwill refunds as a separate payment, but the original transfer will not reverse like a card transaction.

It is wrong if the product needs campaign mechanics instead of simple tips. Matching funds, goal thresholds, pooled tips, multi-cook splits, delayed settlement, fraud holds, raffles, or public campaign accounting may justify a small custom contract or an escrow provider. Until then, a tipping contract is extra surface area.

It is wrong if the compliance answer depends on the newsletter touching user funds. The MVP should avoid taking custody. If the business later holds balances, pools funds, decides payouts, or moves money on behalf of users, the legal, tax, and money-transmission analysis changes materially.

It is wrong if readers strongly need privacy from public transaction graphs. Base transfers are public. The app can hide names offchain, but wallet addresses, amounts, timing, and recipient addresses remain visible.

It is wrong if the cook cannot realistically manage a Coinbase account or wallet. The recipient side matters as much as the reader side. If cooks churn often, lack IDs required by offramps, share devices, or need cash immediately after a shift, a crypto payout path may create support burden instead of empowerment.

## Decision

Build the MVP as a Coinbase/Base USDC tipping flow with no custom contract, sponsored gas, reader-controlled wallets, and verified cook recipient addresses.

The most important product risk is not the transfer itself. It is the funding step. Before full build, prototype the first-tip flow with real non-crypto readers and measure completion from newsletter click to funded wallet to sent tip. If too many readers stall at funding, switch to fiat collection with batched payouts before building more onchain machinery.

## References checked

- Coinbase Onramp payment methods: https://docs.cdp.coinbase.com/onramp/additional-resources/payment-methods
- Coinbase Onramp quotes and hosted flow: https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/generating-quotes
- Coinbase Onramp order fields, including Base and USDC examples: https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/get-an-onramp-order-by-id
- CDP wallet account types and smart accounts: https://docs.cdp.coinbase.com/server-wallets/v2/using-the-wallet-api/managing-accounts
- CDP paymaster and sponsored transactions: https://docs.cdp.coinbase.com/paymaster/guides/wagmi-viem-integration
