# Direct line-cook tips: recommended setup and first-use walkthrough

## Recommendation

Use **Base Pay to send native USDC on Base directly to a Base address controlled by the cook**. Give each story a mobile web tip page with preset $1, $3, and $5 buttons. Do not ask readers to connect a generic wallet, choose a chain, buy ETH, or handle a seed phrase. Base Pay works without a prior wallet connection, quotes the amount in dollars, and sends USDC on Base; a Base Account is a self-custodial smart wallet that can be accessed with email authentication or a passkey and requires no browser extension or app install ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account), [Base Pay reference](https://docs.base.org/base-account/reference/base-pay/pay)).

This is a good fit because the payment is tiny, the cook should receive it rather than the newsletter taking custody, Base transactions are inexpensive, USDC keeps the displayed amount dollar-denominated, and the audience's existing Coinbase accounts provide the shortest funding path. The newsletter should pay any network cost and should not deduct a platform fee from a $1 tip. Base Pay currently describes payments as fee-free to payer and recipient.

“Direct” must be stated precisely: the onchain transfer goes from the reader's Base Account to the cook's wallet address, without passing through the newsletter. The cook receives **USDC, not cash in a bank account**. Converting or withdrawing it is a separate action.

Before launch, each cook must:

1. Create or sign in to a Base Account, using email OTP or a device passkey. No Base app is required; the account can be used on the web. Coinbase documents email OTP, passkey, and recovery-phrase access ([sign-in help](https://help.coinbase.com/en-gb/wallet/getting-started/smart-wallet-passkeys)).
2. Give us their Base address and complete a signed challenge so we know they control it. Staff must verify the mapping with the cook out of band; a wrong address is not reversible.
3. Choose whether to keep USDC or cash out. For cash, link the Base Account to Coinbase (or send USDC over the Base network to a Coinbase USDC deposit address), then sell/withdraw through the cook's verified Coinbase account and linked bank. Eligibility, holds, tax treatment, and withdrawal fees vary. We should test this exact path in the cook's jurisdiction before featuring them.
4. Receive a small test payment and successfully withdraw it. The public page should show the cook's name and restaurant, not the hexadecimal address, while the backend pins that identity to the verified address.

## A reader's first-ever $3 tip

The exact Coinbase-hosted wording may change; this is the screen contract we should design and test, including every branch a genuinely new reader can encounter.

### 1. Newsletter

The reader sees “Tip Ana, the line cook — $1 / $3 / $5” beneath the story and taps **Tip Ana**. Nothing has been installed or created yet.

### 2. Our tip page

The page shows Ana's photo/name, restaurant, “Ana receives 3.00 USDC (about $3) directly,” the three amount choices, and plain disclosures: payment is on Base, it is final, the newsletter never holds the funds, and cash-out is Ana's choice. The reader selects **$3** and taps **Pay $3 with Base**. We request no wallet connection and no newsletter account.

### 3. Base Pay account sheet

A Coinbase/Base-hosted sheet opens. A returning Base Account user can authenticate immediately. This first-time reader chooses **Continue with email** (or the offered Coinbase/Base sign-in route), enters an email address, and sees an **email verification** screen. They open the six-digit OTP email, return, and enter the code. If their account uses TOTP, they also enter that code. On devices where the product offers passkey creation, the next screen asks to save a passkey and the operating system shows its Face ID, fingerprint, or device-PIN prompt.

Result: a self-custodial Base Account and address now exist. The reader has installed **nothing**, downloaded no extension or mobile app, written down no seed phrase, selected no network, and bought no ETH. They have, however, created a new onchain account distinct from their ordinary Coinbase exchange account and authenticated it. We should not label this step merely “sign in to Coinbase.”

### 4. Balance check

The payment sheet shows **Pay 3.00 USDC to Ana** and the available USDC balance on Base.

- **If at least 3 USDC is already in the Base Account:** skip to confirmation.
- **The likely first-use case—zero balance:** show **Add funds**. This is the major conversion break, not an edge case.

### 5A. Funding for an existing Coinbase customer

The Coinbase-hosted onramp opens. The reader selects **Coinbase**, signs in to their existing Coinbase account, completes its password/passkey and 2FA screens, and authorizes the connection. They then see a source picker: eligible Coinbase cash/crypto balance or an already-linked bank/debit-card method; review the quote, fees, amount, destination Base address, and network; and tap **Confirm**. Coinbase says authenticated customers can use fiat/crypto balances and linked payment methods in its hosted onramp ([hosted onramp overview](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)). Any account restriction, regional eligibility check, insufficient balance, new payment-method verification, or transfer hold appears here.

The USDC arrives in the reader's Base Account. This is a transfer to self, not yet the tip. The sheet returns to the $3 payment review.

### 5B. Funding without a usable Coinbase account

Where guest checkout is available, the reader chooses debit card, Apple Pay, or Google Pay, enters and verifies a phone number by OTP if requested, chooses the payment method, reviews the quote and fees, and confirms. Guest onramp is currently limited by country and has a **$5 minimum**, so a new reader cannot buy exactly $1 or $3; they must fund at least $5 and retain the remainder. Coinbase currently documents guest availability in the US, UK, and Canada, with a $500 weekly baseline in the US ([onramp FAQ](https://docs.cdp.coinbase.com/onramp/additional-resources/faq), [hosted onramp overview](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview)). If guest checkout is unavailable, the fallback is creating and verifying a Coinbase account—email/phone, identity/KYC, payment method, and funding—or abandoning the tip. Do not hide this branch.

### 6. Final authorization

Back in Base Pay, the reader reviews **3.00 USDC**, Ana's verified recipient identity, “Base network,” and the final/irreversible warning. The UI should show no separate gas charge. They tap **Pay**, then approve with email reauthentication or the saved passkey (Face ID/fingerprint/device PIN). Base Pay submits the USDC transfer; the reader never handles ETH. Base Pay exposes the transaction hash and completed/pending/failed status ([status reference](https://docs.base.org/base-account/reference/base-pay/getPaymentStatus)).

### 7. Receipt

Our page first shows **Sending**, then only after confirmed status shows **Ana received 3.00 USDC**, a receipt/reference and optional block-explorer link. A timeout remains “pending,” never “failed—try again,” until status is resolved, to prevent double tips. Email receipt and newsletter signup are optional and unchecked; neither gates payment.

### 8. What the cook experiences

Ana's Base Account balance increases by 3 USDC as soon as the transfer settles. Bursts after publication produce many independent transfers to the same address; they do not require Ana to be online and do not require us to batch or distribute funds later. Ana opens the Base web/app account to see the payment. If she wants dollars in her bank, she separately transfers/deposits USDC on the **Base network** to a compatible Coinbase account, sells if needed, and withdraws to her linked bank. Only after that off-ramp clears has cash reached her bank.

## What would make this the wrong setup?

The recommendation is conditional, not ideological. Change the product in any of these ways and reevaluate:

- **“Money reaches the cook” must mean bank cash immediately.** Direct USDC fails that requirement and pushes onboarding, price/asset explanation, accounting, and off-ramp work onto a lower-wage recipient. Use ordinary card/ACH tipping through a regulated payments or payroll/payout provider, accept that the platform/payment provider temporarily intermediates funds, and show settlement timing and fees.
- **Most cooks cannot or will not pass exchange KYC, use Base, safely control an account, or off-ramp locally.** The recipient side then dominates the decision. Use local fiat payout rails rather than giving them an illiquid balance.
- **Most readers lack a funded Base Account or usable Coinbase relationship, and first-tip conversion is the primary metric.** A $5 minimum funding flow for a $1 tip is a structural mismatch. Card/Apple Pay/Google Pay checkout with aggregated fiat payouts will probably convert better. Validate this with a funnel test: newsletter click → account completion → funding completion → confirmed tip.
- **The average payment becomes large enough that card/ACH fixed costs are negligible** (for example, donations rather than $1–$5 tips). Base's microtransaction advantage matters less; familiar fiat, chargeback handling, receipts, and consumer support may matter more.
- **Tips become recurring or one-click repeat behavior rather than occasional issue-driven bursts.** Then a carefully capped, revocable spend permission or subscription could beat approving every transfer; conversely, if readers demand explicit approval every time, do not add delegated spending. Base documents spend permissions as allowing later transactions within a time and amount limit ([permissions help](https://help.coinbase.com/en/wallet/getting-started/smart-wallet-permissions)).
- **The newsletter must split, pool, refund, moderate, escrow, match, withhold taxes, or allocate one payment among a kitchen team.** A direct address-to-address transfer no longer models the product. Use a purpose-built audited contract only when onchain composability is essential; otherwise use a ledger plus regulated payouts. Either choice changes the claim that we never control funds.
- **Tips must be reversible or protected against mistaken/unauthorized payments.** Onchain transfers are final. Use card rails and define disputes/refunds instead.
- **The target audience or geography shifts away from Coinbase/Base support.** Choose the dominant local wallet and stablecoin rail, or fiat. Do not make readers bridge assets or choose networks.
- **The cook needs privacy from public payment graphs.** A fixed public address exposes balance and transaction history and may correlate income with publication bursts. Prefer fiat, unique deposit addresses routed by a compliant custodian, or a privacy design reviewed by counsel; merely hiding the address in the UI does not solve it.
- **Volume becomes operationally or economically material enough to attract abuse.** The bursts described should be easy for Base, but 200,000 reachable users create spam, sanctions, fraud, support, and address-substitution risk. If controls require custody or screening that contradicts “direct,” change the promise or the architecture.

## Go/no-go test before building fully

Prototype one cook and a few hundred readers. Ship only if (1) the cook completes setup and a real bank withdrawal without staff custody, (2) the median new reader can finish without installing an app, (3) the all-in first-tip funnel—including funding—beats the fiat alternative, and (4) at least 90% of the nominal tip reaches the cook after their typical cash-out costs. Track existing-funded Base users separately from existing Coinbase-but-unfunded users; combining them would conceal the decisive onboarding step.

