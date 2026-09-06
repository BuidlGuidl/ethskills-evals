# Direct line-cook tipping: pre-build decision

## Recommendation

Launch one narrow path: **Base Pay sends native USDC on Base directly from a reader's Base Account to the cook's Base Account**. Use no custom contract, no pooled newsletter wallet, no token, and no reader account of our own.

This is the best onchain version of the product: the amount stays dollar-denominated, the cook—not the newsletter—receives and controls the money, and Base Pay currently advertises no payment fee for payer or recipient. It also removes wallet extensions, seed phrases, network selection, ETH acquisition, and gas prompts from the intended flow. Base Account is self-custodial and passkey/OTP based; the SDK handles gas and settlement. ([Base Account overview](https://docs.base.org/base-account/overview/what-is-base-account), [Base Pay API](https://docs.base.org/base-account/reference/base-pay/pay))

The uncomfortable truth is that “has Coinbase” does **not** mean “is ready to tip.” A Coinbase.com account is custodial and distinct from a Base Account. A new payer still needs a Base Account and spendable USDC there. ([Coinbase versus Base](https://help.coinbase.com/en/wallet/getting-started/what-s-the-difference-between-coinbase-com-and-wallet)) The product should say “Pay with Base,” not “Pay with Coinbase,” and should measure conversion at the account-creation and funding steps before committing beyond a pilot.

## Preconditions before any reader sees a tip button

The featured cook completes a one-time recipient flow:

1. Open our secure cook-onboarding link; see their name, restaurant, “Receive tips as USDC on Base,” and plain-language self-custody/cash-out disclosure.
2. Choose **Create or connect Base Account**. If new, enter an email, enter the six-digit emailed OTP, and optionally create/confirm a device passkey with Face ID, fingerprint, or device PIN. No app or browser extension and no seed phrase should be required for this path. Base says web login supports email OTP, passkey, or recovery phrase. ([Base sign-in help](https://help.coinbase.com/en-gb/wallet/getting-started/smart-wallet-passkeys))
3. Approve sharing/connecting the public address with us.
4. See a verification screen showing their name, shortened address, “USDC on Base,” and a test amount. We send a small test payment; the cook confirms receipt.
5. See **Ready to receive**, with recovery and cash-out instructions. We store the verified address and cook/issue mapping offchain. A second staff member verifies that the person and address match before publication.

At this point a tip “reaches the cook” when USDC settles in that self-custodial Base Account. Cash in a bank is a later, separate action: the cook may need to link/sign into Coinbase, transfer the USDC there on the Base network, and withdraw to a linked bank. We must not label onchain receipt as “cash in your bank.”

## First-time reader's first tip, screen by screen

This is the honest worst-normal first-use path for a reader with a Coinbase account but **without** an existing funded Base Account. Exact Coinbase-hosted labels may change; the states and disclosures may not.

1. **Newsletter story.** Under the cook profile: “Tip Ana directly,” preset **$1 / $3 / $5** buttons, “Paid in USDC to Ana's account,” and a “How it works” link. The reader taps **$3**. No sign-in is required to read or select an amount.
2. **Our confirmation sheet.** It says “Ana receives 3.00 USDC (about $3) on Base,” identifies the restaurant, shows “Newsletter fee: $0,” and warns that blockchain payments are final. Primary action: **Pay $3 with Base**. We do not request the reader's name, email, phone, or mailing address.
3. **Base Pay opens.** The hosted account surface shows our app identity, Ana's shortened recipient address, Base network, asset USDC, and amount. The reader chooses **Continue**. Base Pay does not require a prior wallet connection. ([Base Pay integration](https://docs.base.org/base-account/framework-integrations/wagmi/base-pay))
4. **Create/sign in to Base Account.** Because this is their first use, the reader enters an email and the six-digit OTP sent to it, then follows the device prompt to create or use a passkey (Face ID/fingerprint/PIN) if offered. They accept the Base Account terms. This creates a self-custodial smart-wallet account. It is a new account relationship even if the email is already used at Coinbase.com; no separate app, extension, recovery phrase, or newsletter password is installed/created in the intended web flow.
5. **Insufficient USDC.** The new Base Account has $0, so the payment cannot yet execute. The screen says **Add funds**. It must not imply the existing Coinbase balance is already in this wallet.
6. **Coinbase-hosted funding.** The reader chooses **Coinbase account**, signs into Coinbase if not already authenticated, completes its 2FA/device confirmation, and authorizes the connection. Existing linked bank/debit methods and eligible fiat or crypto balances appear. A reader without a usable Coinbase account would instead face Coinbase account/KYC setup or, where supported, guest debit/Apple Pay/Google Pay checkout.
7. **Funding quote.** Select **USDC on Base** and a payment source. Coinbase Onramp currently documents a **$5 minimum**, so a $1–$4 first tip requires buying/transferring at least $5; the screen must explicitly say that the tip is $3 and roughly $2 will remain in the reader's Base Account. It shows the final debit, any funding fee, exchange result, and timing before confirmation. Existing Coinbase users can use eligible balances or linked payment methods; availability varies by country and account. ([Coinbase-hosted Onramp](https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/overview))
8. **Authorize funding.** The reader confirms the $5 onramp and completes any bank/card/Coinbase authentication. A pending screen remains until the USDC is available; if settlement is delayed, offer **Email me when ready** and a safe return link, not repeated purchase attempts.
9. **Return to the $3 tip.** The payment review again shows **3.00 USDC to Ana**, Base, no newsletter fee, the resulting balance, and “Final once sent.” Funding is not consent to tip; this is a distinct approval.
10. **Passkey approval.** The reader taps **Pay** and approves with Face ID, fingerprint, or device PIN. Base Pay submits the USDC transfer and handles gas; the reader does not acquire ETH or choose a chain. Base documents `pay()` as sending USDC on Base and returning a transaction hash. ([Base Pay API](https://docs.base.org/base-account/reference/base-pay/pay))
11. **Processing.** Our page waits on payment status and disables duplicate submission. It displays “Sending—do not close” followed by either a retryable failure (with no success claim) or confirmed settlement.
12. **Receipt.** “Ana received 3.00 USDC,” timestamp, recipient, Base network, and transaction link. Offer an optional emailed receipt only after success. The approximately $2 remainder stays in the reader's Base Account for a future tip; it is not held by us.

Installed: **nothing** in the preferred web flow. Signed up for: **a Base Account**, plus Coinbase only if the reader did not already have a usable one. Funded: **at least $5 of USDC on Base today for a first $1–$4 tip**, subject to the live onramp quote. Approved: Coinbase/onramp funding, then the distinct $3 payment. The Coinbase or Base mobile app is an optional convenience, not a prerequisite.

Returning readers with a funded Base Account skip steps 4–8: amount → Base Pay review → passkey → receipt. That is the “one-tap” promise; it is not the first-tip promise.

## Product and system boundary

- **Onchain:** only the direct native-USDC transfer on Base, from reader to cook. Zero custom contracts. Base's payment transaction is the receipt.
- **Offchain:** cook identity and address verification, restaurant/editorial metadata, issue links, suggested amounts, analytics, payment-status cache, support records, and any “most tipped” aggregation. Rankings are derived from indexed transfers plus verified mappings, never contract storage.
- **No custody:** neither our frontend nor backend can redirect, hold, batch, refund, or sweep tips. The server creates short-lived onramp sessions and records transaction hashes; it never has reader or cook signing keys.
- **Recipient changes:** require reauthentication by the cook, an out-of-band staff check, a small test transaction, and two-person approval. Freeze tipping while a change is pending. This is the highest-risk operational surface.
- **Burst handling:** use a production Base RPC/provider and Coinbase payment-status API/webhooks where applicable; queue indexing and receipt work offchain. Each tip remains an independent transfer, so a newsletter burst cannot lock a shared pot.

### State transitions

| Transition | Caller | Why they act/pay | If nobody calls |
| --- | --- | --- | --- |
| Fund reader Base Account | Reader through hosted onramp | Enables this and later tips; reader accepts displayed funding cost | No funds move; tip remains incomplete |
| Send `N` USDC to cook | Reader through Base Pay, with passkey approval | Intends to tip; Base Pay currently handles gas | No funds move; no tip is claimed |
| Optional cook transfer/off-ramp | Cook | Wants funds in Coinbase/bank or another wallet | USDC remains under the cook's control in Base Account |

There is no keeper, owner settlement, claim function, escrow, or scheduled contract call.

## What would have to change for this to be the wrong setup?

These are decision triggers, not a generic feature wish list.

| Product reality changes to… | Why direct Base Pay becomes wrong | Replace it with… |
| --- | --- | --- |
| The primary goal becomes **maximum conversion from ordinary readers**, and a pilot shows unacceptable drop-off at Base Account creation/funding or users reject buying $5 to send $1 | Self-custody/onramp friction defeats the product; “direct onchain” is costing more tips than it protects | Familiar card/Apple Pay checkout via a regulated payments platform, with compliant pooled/batched payouts to cooks. This is no longer direct onchain tipping; disclose processor fees and payout timing |
| Readers must pay **exactly $1 from a card/bank with no prefunding or leftover balance** | The $5 hosted-onramp minimum and wallet funding step violate the core promise | Fiat checkout and aggregated payouts, or a provider that can lawfully execute sub-$5 purchase-and-send in one disclosed flow |
| Cooks need **USD in a bank account**, cannot or will not manage self-custody, or local labor/tip rules require payroll allocation, withholding, reporting, or employer distribution | Sending USDC to a personal wallet is not the actual required endpoint and may bypass required controls | Employer/payroll or a licensed payout platform; treat the restaurant/employer as the settlement participant where law requires it |
| A tip must be **split among a shift, pooled kitchen, charity, or newsletter** according to immutable rules | A transfer to one cook address cannot trustlessly enforce the split | One small audited splitter contract on Base, only after defining recipients, rounding, update authority, failure handling, and tests; or offchain regulated split payouts if recipients need fiat |
| Tips must be **refundable, chargeback-compatible, moderated, held until identity/shift verification, or released later** | Irreversible direct transfer has deliberately removed intervention and escrow | Conventional payment authorization/escrow. Use an onchain escrow only if trustless conditional release is itself a requirement and every release/refund caller is specified and incentivized |
| Tips become **recurring, automatic, or one approval must cover many future issues** | Per-tip passkey approval becomes the bottleneck | Explicit capped, expiring spend permissions/sub-accounts, with clear revoke UX and risk limits—not a blanket unlimited approval |
| Most readers already hold funds on another chain/wallet, or Base/Coinbase geographic coverage excludes a material share | Coinbase distribution is no longer the product-specific advantage; forcing Base creates bridging/onramp friction | Select the one chain/payment rail actually used by the audience after measuring wallet, stablecoin, fee, and off-ramp coverage; do not launch multichain by default |
| Tips grow large enough that readers need privacy, dispute support, sanctions screening, tax receipts, or enhanced compliance | A public, irreversible address-to-address transfer exposes amounts and provides little recourse | A regulated custodial/payment flow, or a privacy/compliance architecture designed with counsel; do not bolt identity data onto public transfers |
| The newsletter must take custody, guarantee payout, net fees, batch bursts, or pay cooks who never enroll | Zero-contract direct transfer no longer matches the business promise and creates treasury, accounting, and regulatory duties | Stop and redesign around a licensed custodian/payment processor; a custom contract does not by itself solve money-transmission, tax, or labor obligations |

Conversely, burst volume alone does **not** justify a contract, batching, or custody. Independent Base Pay transfers naturally fan out; scale the offchain status/indexing layer first.

## Go/no-go pilot before a full build

Run a small, geographically representative issue with a handful of verified cooks. Instrument, without collecting unnecessary wallet identity: tip-button views, Base Pay opens, Base Account completion, funding starts/completions, payment approvals, confirmed transfers, time to completion, support requests, repeat tips, and cook cash-out success.

Set thresholds before launch. At minimum, compare completed first tips against intent after amount selection, isolate abandonment caused by the $5 minimum, and interview cooks about whether “received in Base Account” felt like being paid. Also obtain local counsel's answer on tips, wage allocation, tax reporting, money transmission, sanctions obligations, and the copy needed to distinguish USDC from bank cash. If the winning requirement is “any reader can send $1 from Apple Pay and the cook gets bank dollars,” choose fiat processing; if the winning requirement is “the reader and cook control a direct, public, irreversible dollar transfer,” this Base Pay design is the smallest credible slice.
