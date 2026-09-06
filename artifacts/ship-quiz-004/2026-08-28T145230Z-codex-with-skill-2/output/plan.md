# Direct tips: recommended first release

## Decision

Use **Base Pay on Base mainnet to send native USDC directly to a Base address controlled by the cook**. Do not deploy a tipping contract for the first release. Keep the cook's name, story, restaurant, issue, eligibility, and payout address in our database; the only onchain act is the reader's USDC transfer.

This is the best crypto version of the product as currently described:

- USDC keeps a $1 tip recognizably worth about $1.
- Base Pay supports a specified dollar amount and recipient address, returns an onchain transaction ID, and advertises no payment fee to payer or recipient.
- Base is a particularly good launch chain here because Base Pay, Base Accounts, Coinbase Onramp, and gas-sponsored USDC transfers form one path, and many readers already have a Coinbase funding relationship.
- Direct transfer means we do not custody, pool, batch, allocate, or later release tips. The cook receives each successful tip immediately.
- Zero custom contracts means no escrow, withdrawal transaction, owner key, upgrade path, or contract audit is needed.

This is not the absolute lowest-friction way to move $1. A card/Apple Pay tipping service would be easier for a wallet-naive reader. It is the right setup only if direct, onchain receipt is a real product requirement.

## What must exist before a reader can tip

### The cook

Before publication, the cook must:

1. Accept the program terms and complete whatever identity/tax onboarding our counsel and payout policy require. This is offchain.
2. Create or use an account that can receive native USDC on Base. The recommended novice path is a verified Coinbase account with a Base-network USDC receive address; a self-custodied Base Account is also acceptable if the cook understands recovery.
3. Prove control of the destination. For a self-custodied account, sign a challenge. For a Coinbase deposit address, verify it through a small test deposit and confirmation procedure; do not ask an exchange account to sign.
4. Confirm the exact asset/network pair: **native USDC on Base**, not USDbC, Ethereum USDC, or another network.
5. Receive and cash out a small test tip end to end before their newsletter issue ships.

The database stores the verified address and an immutable version of the issue-to-cook mapping. Address changes require re-verification and a cooling-off/review step. Readers never type or paste an address.

### Us

The tip page needs the cook's verified address, fixed choices of $1/$3/$5, Base Pay integration, server-side recording of issue/cook/amount/transaction ID, and confirmation based on Base payment status. We should sponsor any gas exposed by the chosen Base Account integration. There is no newsletter account requirement and no separate “connect wallet” screen before the reader expresses intent.

## First-time reader's first tip: every screen

The walkthrough below is the honest worst-normal first-time path for a reader who has a Coinbase account but has never created a Base Account and has no USDC in it. Exact Coinbase wording can vary by device, region, and account state; this flow must be verified on production-like mobile devices before launch.

### 1. Newsletter

The issue contains a card for the featured cook: photo, first name, restaurant, the sentence “100% of this tip goes to Ana as USDC,” and buttons **$1**, **$3**, and **$5**. It also says “First tip takes about two minutes; later tips take seconds” and “Requires creating a free Base Account.”

The reader taps **Tip $3**. Nothing is installed yet.

### 2. Mobile web tip page

The browser opens our HTTPS page. It repeats the cook, amount, and plain-language disclosures:

- Ana receives 3.00 USDC directly on Base.
- We do not hold the money.
- The transfer is public and normally irreversible.
- The cook may need to convert USDC to dollars.

Primary action: **Pay $3 with Base**. Secondary action: cancel. Do not require newsletter login, wallet jargon, token selection, network selection, or an optional message before payment.

### 3. Base Pay sheet

Tapping the button opens Coinbase's Base Account/Base Pay UI. It shows our site, the destination, **3.00 USDC**, and Base as the network. A returning funded Base user can skip to step 7. A first-time reader chooses **Create or sign in to Base Account**.

Important: the reader's existing Coinbase exchange account is helpful for funding, but it is not the same thing as a funded Base Account. We must not advertise “works with your Coinbase account” as though no wallet is created.

### 4. Base Account sign-in/creation

The reader enters an email address and receives a six-digit one-time code, then enters that code. Depending on the current Coinbase flow and device, they may also be asked to create/save a passkey and approve it with Face ID, fingerprint, or device PIN.

What they sign up for: a Base Account (a self-custodial smart wallet). They do **not** create a newsletter password, install a browser extension, write down a seed phrase, buy ETH, or choose a chain. Email OTP sessions can persist, so this is principally a first-tip cost.

### 5. Insufficient-balance screen

The new account has 0 USDC. The payment sheet cannot complete and offers **Add funds**. We should preserve the selected $3 tip through this detour and make the required amount obvious.

If the production Base Pay sheet does not offer funding inline, it opens Coinbase Onramp and returns to our page afterward. That extra round trip is a launch-blocking UX test, not something to discover after sending the issue.

### 6. Fund with Coinbase

The reader chooses **Coinbase account** (the preferred branch for this audience), signs in or approves the existing Coinbase session, and completes any Coinbase two-factor challenge. They select an existing USD/USDC balance or linked bank/debit method, review the onramp/transfer quote and any disclosed fee, and confirm enough native USDC on Base to cover the $3 tip.

If their Coinbase account has no funded balance or payment method, they must first link one and may face identity verification, bank authorization, funding minimums, fees, or a settlement hold. If their country/account is not eligible, the offered fallback may be guest debit card/Apple Pay with its own details, verification, minimum, and fee. **We must measure the minimum purchasable amount:** if a reader has to buy materially more than the tip, that should be stated before step 3 and is a serious reason not to launch this flow.

What they fund: USDC in their Base Account on Base. They do not need ETH if gas is sponsored/no-fee as promised by Base Pay.

### 7. Payment review and authorization

After funding completes, the reader returns to the Base Pay review showing **Pay 3.00 USDC to Ana**, the Base network, and the total/fee (expected payment fee: $0). They tap **Confirm** and authorize with the email session/passkey or device biometric. This is the irreversible value-transfer consent; it must not be hidden inside the funding confirmation.

### 8. Processing

Our page displays **Sending tip…** and polls the payment status by transaction ID. It must handle close/reopen, duplicate taps, rejected authorization, insufficient balance, and a pending transaction without initiating a second payment.

At this point the USDC transfer is broadcast directly from the reader's Base Account to the cook's verified address. There is no later claim or sweep.

### 9. Success

After confirmation, show **Ana received $3**, the transaction ID/link, and “We never held your tip.” Offer an optional offchain thank-you note only after success. Explain that the remaining Base Account balance stays under the reader's control and that the next tip will usually be: choose amount → review → authorize → success.

### What the reader installed, created, and funded

| Requirement | First tip | Later funded tip |
| --- | --- | --- |
| App or extension | Nothing, if web Base Account/Pay works as documented; never force Base app installation | Nothing |
| New account | Base Account via email OTP, and possibly a passkey | Reauthenticate only if session expired |
| Existing account used | Coinbase sign-in/2FA for the preferred funding route | Only when adding funds |
| Payment method | Existing Coinbase balance or linked bank/card; otherwise link/verify one | Only when adding funds |
| Crypto funded | Native USDC on Base, at least the tip amount and possibly an onramp minimum | Existing Base USDC balance |
| Gas token | No ETH if Base Pay/gas sponsorship applies | No ETH |

## Onchain boundary and state transitions

There is no custom contract and no application-controlled treasury.

| Transition | Caller | Why they act/pay | If nobody acts |
| --- | --- | --- | --- |
| Buy/transfer USDC into reader's Base Account | Reader through Coinbase Onramp | They need a spendable balance to tip | No funds move; tip remains incomplete |
| Transfer USDC to cook | Reader through Base Pay | They intend to tip; Base Pay/paymaster covers the advertised network cost | No tip exists; nobody else can charge them |
| Convert/withdraw USDC | Cook through their wallet/exchange | They want dollars or another asset | USDC remains in the cook-controlled account |

Offchain, our server observes and indexes transfers for receipts and aggregate displays. Any “$842 tipped” number is derived from confirmed transfers, not maintained in a contract. We must never mark a tip successful solely from a client callback.

## What would make this the wrong setup

These are product changes or discoveries that reverse the recommendation, not merely implementation details.

1. **“Direct” no longer means onchain.** If the real outcome is simply that the cook gets dollars, use card/Apple Pay and a regulated payout provider. For $1–$5, familiar checkout will convert better than forcing a first-time wallet and prefunding.

2. **The reader must pay exactly $1 from a bank/card with no stored balance.** If Onramp imposes a minimum, fee, KYC step, or hold disproportionate to the tip, use conventional payments or let the newsletter sponsor/preload the first tip. Do not disguise a $10 crypto purchase as a $1 tip.

3. **Tips must arrive as fiat in the cook's bank account automatically.** Direct USDC is then the wrong recipient experience. Use a custodial/regulated payment processor, or a compliant off-ramp and payout system; that adds custody, identity, sanctions, tax, failure/reversal, and reconciliation work.

4. **The restaurant, employer, union, charity, or multiple workers must split each tip.** A direct single-address transfer no longer represents the obligation. Prefer a processor that supports split payouts. Consider a small audited splitter contract only if the split must be trustless, recipients accept USDC, and immutable/public allocation is valuable.

5. **Tips must be pooled, matched, refunded, held until a threshold/date, or reassigned when employment changes.** That introduces escrow and settlement state. A custom contract or custodial ledger may be justified, but every release/refund path needs a caller, incentive, timeout, and emergency policy. “We will run a cron job” is not sufficient onchain liveness.

6. **Readers need chargebacks, mistake refunds, fraud protection, or anonymous/private payments.** Public irreversible Base transfers conflict with those requirements. Use conventional payments for reversibility/privacy, or redesign around an explicitly custodial refund window.

7. **Cooks cannot or will not onboard to Coinbase/Base, hold USDC, manage account recovery, or handle conversion/tax records.** Optimize around the cook: fiat payouts are more important than onchain purity.

8. **Most readers do not actually have eligible Coinbase accounts, or the newsletter expands internationally.** Funding methods, KYC, fees, and availability vary by region. Re-run the chain/payment-provider decision from audience data; do not assume Coinbase distribution travels with the product.

9. **The newsletter wants a platform fee deducted from each tip.** The zero-contract direct path cannot silently skim it. Either charge the reader separately through a compliant payments flow, use a clearly disclosed splitter, or abandon “100% goes directly to the cook.” This also changes money-transmission and tax analysis.

10. **Tips become larger, recurring, or automatic.** For recurring tips, explicit cancellable spend permissions or subscription rails may beat one-off Base Pay, but the authorization cap, cadence, expiry, revocation, and failure behavior become core screens. For large tips, fraud, compliance, recovery, and recipient verification dominate the microtip design.

11. **The product needs multichain/token choice or composability.** Then Base-only native USDC may be too narrow. That benefit must outweigh presenting networks, bridging risk, liquidity fragmentation, and support burden to novices.

12. **Base Pay's production behavior contradicts the premise.** Do not ship this setup if tests show forced app installation, a non-inline funding dead end, unsponsored gas/ETH acquisition, material payment fees, poor mobile email-browser return, unreliable payment status, or no viable $1 funding path. In that event, choose embedded email wallets plus sponsored USDC transfers only if their onramp is better; otherwise use fiat rails.

## Go/no-go test before committing to the build

Run a concierge prototype with at least 20 wallet-naive readers across iOS/Android and Gmail/Apple Mail, half with Coinbase accounts and half without. Use real $1, $3, and $5 mainnet payments to a real cook test account. Record every screen, time to receipt, abandonment point, minimum funding amount, all fees, forced installs, KYC/2FA interruptions, duplicate attempts, and cash-out experience.

Proceed only if:

- no app/extension or ETH purchase is required;
- a Coinbase user can create/sign into a Base Account, fund it, return, and finish in one coherent session;
- the all-in cost and required prefunding are acceptable for a $1 tip and disclosed before payment;
- the cook can confirm and cash out a burst of small Base USDC deposits without operational pain;
- repeat tipping is materially faster than the first tip; and
- product leadership accepts that first-tip conversion will be worse than Apple Pay/card checkout in exchange for direct onchain receipt.

If any of the first four fail, stop treating crypto familiarity among “people with Coinbase accounts” as equivalent to wallet readiness.

## Primary references checked (28 August 2026)

- [Base Pay `pay`: native USDC on Base, recipient address, transaction ID, and advertised no-fee payment](https://docs.base.org/base-account/reference/base-pay/pay)
- [Base web quickstart: Base Pay works without prior site sign-in and requires user approval](https://docs.base.org/base-account/quickstart/web)
- [Coinbase: Base Account web sign-in via email OTP, passkey, or recovery phrase](https://help.coinbase.com/en-gb/wallet/getting-started/smart-wallet-passkeys)
- [Coinbase Onramp with user wallets: fund using a Coinbase account or guest debit checkout](https://docs.cdp.coinbase.com/wallets/using-wallets/onramp/cross-platform)
- [Coinbase demo architecture: smart accounts and gasless USDC transfers on Base](https://docs.cdp.coinbase.com/get-started/demo-apps/starter/onramp-demo-app)
- [Coinbase: funding a smart wallet by transfer or Onramp](https://help.coinbase.com/en/wallet/getting-started/smart-wallet-fund)

Provider documentation is evidence of intended behavior, not a substitute for the production go/no-go test above. Fees, eligibility, funding minimums, and screens can change.
