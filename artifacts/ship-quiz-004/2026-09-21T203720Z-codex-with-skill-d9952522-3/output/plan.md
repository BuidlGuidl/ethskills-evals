# First tip walkthrough and product-fit check

## Setup I would plan around

Use a Coinbase Onramp one-click session that sends USDC on Base directly to the
line cook's receiving address. The newsletter product stays mostly offchain:
issue links, cook profile, restaurant context, photo, display name, tip history,
thank-you page, abuse controls, and analytics live in our app. The onchain act is
only the value transfer to the cook.

For the MVP, this should require zero custom contracts. We generate a single-use
Coinbase Onramp URL with:

- `purchaseCurrency`: `USDC`
- `destinationNetwork`: `base`
- `destinationAddress`: the cook's wallet address
- `paymentAmount`: the reader's selected USD amount, if Coinbase permits that amount
- `paymentCurrency`: `USD`
- `partnerUserRef`: our anonymous or account-bound reader/session id
- `redirectUrl`: our receipt page

Coinbase's docs currently say existing Coinbase users can use Coinbase fiat or
crypto balances and linked payment methods, and the Onramp session API supports
sending the purchased crypto to a destination address on a chosen network. The
same docs also say hosted guest checkout was being discontinued on June 30, 2026,
so this recommendation is specifically strongest for readers who already have
Coinbase accounts.

## First-time reader's first tip

This is the happy path for a reader who has a Coinbase account, has completed
whatever Coinbase account checks are already required for that account, and has
either a Coinbase cash balance, a crypto balance, or a linked funding method.

1. The reader opens the newsletter issue.

   They see a story module for the restaurant and a "Tip the line cook" button.
   They do not install anything from the email. The email link opens our web
   page, ideally inside the phone's browser.

2. Our tip page opens.

   The page shows the cook's name or chosen display name, restaurant, a short
   note, and preset buttons like `$1`, `$3`, and `$5`. Before showing a final
   button, our backend either uses Coinbase's quote/session API or our cached
   configuration to know whether the selected amount is actually possible. If
   Coinbase will not process a `$1` onramp, we must not present `$1` as a
   Coinbase-powered option.

3. The reader picks an amount.

   Example: `$5`. Our app shows "Tip $5" and, if available from the quote,
   the estimated amount of USDC the cook receives plus any Coinbase/network fees.
   The reader does not need to know what Base is at this moment.

4. The reader taps the confirm button.

   Our backend creates a single-use Coinbase Onramp session for this tip and
   returns the hosted Coinbase URL. The destination address is already the cook's
   address; the reader does not paste an address or choose a network.

5. Coinbase opens.

   The screen is now a Coinbase-hosted payment/onramp screen. If the reader is
   not already logged in, they see Coinbase sign-in.

6. Coinbase sign-in.

   The reader enters their Coinbase email/password or uses their existing
   Coinbase app/session, then completes Coinbase's normal verification step if
   prompted. They still install nothing unless Coinbase itself sends them into an
   app-based authentication path they already use.

7. Coinbase payment method screen.

   The reader chooses from available Coinbase funding sources: Coinbase fiat
   balance, Coinbase crypto balance, linked bank account, debit card, Apple Pay,
   Google Pay, or whatever Coinbase makes available to that user in their
   jurisdiction. In the US, Coinbase docs say credit cards are not supported.

   If the reader has no usable funding source, the flow stops here until they
   add one or fund their Coinbase account. Adding a bank/card is a Coinbase
   flow, not ours, and may take extra verification or waiting time.

8. Coinbase review screen.

   Coinbase shows the asset, network, amount, fees, payment method, and
   destination. The reader confirms the purchase/send. This is the point where
   the reader authorizes money to move.

9. Coinbase processing screen.

   Coinbase processes the payment and sends USDC on Base to the cook's address.
   Our app watches Coinbase transaction status and/or Base transaction status.
   If the reader closes the tab, our backend can still reconcile using the
   `partnerUserRef` or status APIs.

10. Our receipt screen.

   Coinbase redirects back to our `redirectUrl`. We show "Tip sent" once we have
   a completed Coinbase status or observed onchain transfer. We can also show
   "Processing" if settlement is not final yet.

11. The cook receives the tip.

   The money reaches the cook as USDC on Base at the cook-controlled address. If
   the cook wants dollars in a bank account, that is a separate offramp step:
   they need a Coinbase account or other offramp, identity checks, a linked bank,
   and whatever timing/fees apply. That cash-out flow should not be hidden from
   cooks during onboarding.

## If the reader does not already have Coinbase ready

This is the cold path, and it is the path that decides whether the product is
too heavy for impulse tipping.

1. The reader taps "Tip the line cook" from the newsletter.

   They land on the same tip page and pick `$1`, `$3`, or `$5`.

2. Coinbase opens and asks them to sign in or create an account.

   If hosted guest checkout is unavailable, they cannot just type a card and
   leave. They need a Coinbase account or another payment path we provide.

3. Coinbase account creation starts.

   The reader enters email/phone, creates credentials, accepts Coinbase terms,
   and verifies email/phone. Coinbase may require identity verification before
   they can buy/send.

4. Funding setup starts.

   The reader adds a supported payment method or transfers funds into Coinbase.
   Depending on method and risk checks, this can be instant, delayed, or denied.

5. The reader returns to the tip.

   Only after the account and funding path are usable can they review and
   confirm the USDC-on-Base send to the cook. For a `$1-$5` emotional tip, this
   is a lot of ceremony; it should be treated as a fallback, not the core UX.

## What the reader had to install, sign up for, or fund

For the best path:

- Install: nothing.
- Sign up: no new signup if they already have Coinbase.
- Fund: no pre-funding if they already have a usable Coinbase balance or linked
  payment method. They do have to authorize Coinbase to use that balance or
  funding method for the tip.
- Wallet: no wallet creation, seed phrase, gas token, network switching, or
  wallet signature.

For a reader without a usable Coinbase setup:

- They may need to create a Coinbase account.
- They may need to complete Coinbase identity/account checks.
- They may need to add a debit card, bank account, wallet balance, Apple Pay, or
  Google Pay, depending on what Coinbase supports for them.
- They may be blocked by transaction minimums, state/country restrictions,
  funding-method restrictions, or compliance review.

For the cook before receiving tips:

- The cook needs a receiving address on Base that they control.
- The cook needs to understand they are receiving USDC, not a bank deposit.
- If they want cash, they need an offramp account and linked bank. This can be
  Coinbase, but it should be the cook's choice unless the product promises a
  Coinbase-only cash-out path.

## State transitions

| Transition | Caller | Why they pay gas or fees | If nobody calls |
| --- | --- | --- | --- |
| Create tip session | Our backend | No gas; needed to start checkout and bind amount/address/session | Reader cannot proceed |
| Authorize payment | Reader in Coinbase | They want to send the tip; Coinbase shows payment and network fees | No money moves |
| Send USDC to cook | Coinbase/onramp provider | Part of the paid onramp/send flow | Tip remains incomplete or failed |
| Reconcile receipt | Our backend worker or request path | No gas; needed for UX, analytics, support, and duplicate handling | Cook still receives funds if the onchain send happened; our UI may lag |
| Cash out to bank | Cook | They want dollars instead of USDC | Funds remain in the cook's wallet |

No owner-only cron job should be required for funds to move. Our automation is
only for status and display.

## When this setup becomes the wrong one

This setup is wrong if the product changes in any of these ways:

1. The real tip size is mostly below Coinbase's viable minimum.

   The stated range is `$1-$5`, and this is the first thing to test. If the
   provider minimum or effective fee makes `$1`, `$2`, or `$3` feel absurd, do
   not force direct per-tip onramp. Use an internal balance, card/ACH tipping,
   Apple Pay/Google Pay merchant payments, or aggregate/batch tips before
   converting to USDC.

2. Most readers are not already Coinbase users.

   If a large share of readers must create Coinbase accounts, pass identity
   checks, or add funding before tipping, the product becomes account
   acquisition for Coinbase instead of tipping a cook. Use ordinary card and
   wallet payments first, then optionally settle to cooks in crypto behind the
   scenes.

3. The product promise changes from "cook receives USDC" to "cook receives cash."

   Direct USDC is clean, but it is not the same as a bank payout. If the cook is
   supposed to receive dollars automatically, the right product is a payout
   system with tax, payroll/tip-law, and offramp handling, not just a direct
   onchain transfer.

4. Tips need to be split, escrowed, refunded, matched, or released conditionally.

   A direct transfer has almost no product surface after confirmation. If the
   newsletter, restaurant, or a sponsor needs matching funds, pooled tips,
   refunds, delayed release, or multi-cook allocation, then either a payment
   processor ledger or a small audited contract/escrow design becomes relevant.

5. The restaurant/employer must control distribution.

   If compliance, labor policy, or restaurant operations require employer
   reporting or pooled tip distribution, direct-to-cook transfers may create a
   legal and operational mess. The product should become a restaurant payout
   workflow, not a reader-to-wallet workflow.

6. Readers need chargebacks or normal consumer dispute handling.

   Onchain transfers are final. If the product needs easy refunds, mistaken-tip
   reversal, fraud review, or support-led chargebacks, use conventional payments
   or hold funds in a reversible ledger before settlement.

7. Privacy expectations are incompatible with public transfers.

   A cook's receiving address can accumulate public payment history. If public
   visibility of earnings, timing, or restaurant association is a problem, use
   rotating deposit addresses, a custodial payout ledger, or conventional
   payments.

8. Coinbase/Base distribution stops being the advantage.

   The recommendation depends on a lot of readers already having Coinbase and on
   Base/USDC being cheap and familiar enough. If your audience clusters around
   Cash App, Venmo, Apple Pay, Zelle, Solana wallets, or restaurant gift-card
   credits instead, follow the audience's existing money habit.

9. Bursts become operationally huge.

   Bursts after each issue are fine for direct transfers if the provider can
   handle checkout volume. If the burst causes rate limits, support spikes, or
   reconciliation delays, move to queued payment intents and batch settlement.

## Decision to validate before build

Run a live pilot with staff before building the whole product:

- Can a `$1`, `$3`, and `$5` tip be completed through Coinbase for the actual
  target states/countries and funding methods?
- What exact fee does the reader see for each amount?
- Does an existing Coinbase reader finish in under 60 seconds?
- What percentage of newsletter readers are actually logged-in Coinbase users
  with a usable funding source?
- Does the cook understand receiving USDC, and can they cash out comfortably?

If those answers are good, build the minimal direct-USDC path. If not, the
product should start with normal consumer payment rails and treat crypto
settlement as the cook-side payout layer, not the reader-facing experience.

## Sources checked

- Coinbase Onramp supported payment methods:
  https://docs.cdp.coinbase.com/onramp/additional-resources/payment-methods
- Coinbase-hosted Onramp overview:
  https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview
- Coinbase Onramp session API:
  https://docs.cdp.coinbase.com/api-reference/v2/rest-api/onramp/create-an-onramp-session
- Coinbase Onramp URL generation:
  https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/generating-onramp-url
